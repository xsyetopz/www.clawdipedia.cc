// Disk cache for fetched files. Layout under the root:
//   site/llms-manifest.json, site/llms.txt, site/pages/<route>.md, site/schemas/<name>.json
//   platform/llms.txt, platform/pages/<path>.md
//   code/llms.txt, code/pages/<path>.md
//   claude-resources/sitemap.xml, claude-resources/pages/<path>.html
// Every body file has a sibling <file>.meta.json. Writes are atomic (temp file, then rename).
// If the folder cannot be written, the cache lives in memory only.
import {
	mkdir,
	readdir,
	readFile,
	rename,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, join } from "node:path";

import {
	type Cached,
	cacheRoot,
	capBytes,
	type FileInfo,
	inside,
	isMeta,
	type Meta,
	pickVictims,
	sha,
} from "./cache-meta.ts";

const readMeta = async (file: string): Promise<Meta | undefined> => {
	try {
		const m: unknown = JSON.parse(await readFile(`${file}.meta.json`, "utf8"));
		return isMeta(m) ? m : undefined;
	} catch {
		// A body without a valid meta stays usable but has no validators.
		return undefined;
	}
};

const present = (v: string | undefined): v is string =>
	v !== undefined && v !== "";

export class DiskCache {
	private readonly root: string;
	private readonly memory: Map<string, Cached> | undefined;
	private approx: number | undefined;

	private constructor(root: string, memory: Map<string, Cached> | undefined) {
		this.root = root;
		this.memory = memory;
	}

	/** Opens the cache. If the folder cannot be written, the cache lives in memory only. */
	static async open(root = cacheRoot()): Promise<DiskCache> {
		try {
			await mkdir(root, { recursive: true });
			const probe = join(root, `.probe.${process.pid}`);
			await writeFile(probe, "");
			await rm(probe);
			return new DiskCache(root, undefined);
		} catch {
			return new DiskCache(root, new Map());
		}
	}

	private file(rel: string): string | undefined {
		return inside(this.root, rel);
	}

	/** The cached body, or undefined for a miss. A corrupt entry is deleted and counts as a miss. */
	async get(rel: string): Promise<Cached | undefined> {
		if (this.memory) {
			return this.memory.get(rel);
		}
		const file = this.file(rel);
		if (file === undefined) {
			return undefined;
		}
		let buf: Buffer;
		try {
			buf = await readFile(file);
		} catch {
			return undefined;
		}
		const meta = await readMeta(file);
		if (meta && (buf.length !== meta.bytes || sha(buf) !== meta.sha256)) {
			await this.delete(rel);
			return undefined;
		}
		return { body: buf.toString("utf8"), meta };
	}

	/** Replaces body and meta. Never throws. */
	async put(
		rel: string,
		body: string,
		v: { url: string; etag?: string; lastModified?: string },
	): Promise<void> {
		const buf = Buffer.from(body, "utf8");
		const meta: Meta = {
			url: v.url,
			...(present(v.etag) ? { etag: v.etag } : {}),
			...(present(v.lastModified) ? { lastModified: v.lastModified } : {}),
			fetchedAt: new Date().toISOString(),
			status: 200,
			bytes: buf.length,
			sha256: sha(buf),
		};
		if (this.memory) {
			this.memory.set(rel, { body, meta });
			this.pruneMemory(rel);
			return;
		}
		const file = this.file(rel);
		if (file === undefined) {
			return;
		}
		try {
			let before = 0;
			try {
				const st = await stat(file);
				before = st.size;
			} catch {
				// New file.
			}
			await this.atomic(file, buf);
			await this.atomic(`${file}.meta.json`, JSON.stringify(meta));
			this.approx =
				this.approx === undefined
					? await this.total()
					: this.approx + buf.length - before;
			if (this.approx > capBytes()) {
				await this.prune(rel);
			}
		} catch {
			// A read-only cache only costs the cache.
		}
	}

	/** 304: the body is still good. Only fetchedAt moves. */
	async touch(rel: string): Promise<void> {
		const c = await this.get(rel);
		if (!c?.meta) {
			return;
		}
		const meta = { ...c.meta, fetchedAt: new Date().toISOString() };
		if (this.memory) {
			this.memory.set(rel, { body: c.body, meta });
			return;
		}
		const file = this.file(rel);
		if (file === undefined) {
			return;
		}
		try {
			await this.atomic(`${file}.meta.json`, JSON.stringify(meta));
		} catch {
			// Ignore.
		}
	}

	async delete(rel: string): Promise<void> {
		if (this.memory) {
			this.memory.delete(rel);
			return;
		}
		const file = this.file(rel);
		if (file === undefined) {
			return;
		}
		try {
			await rm(file, { force: true });
			await rm(`${file}.meta.json`, { force: true });
		} catch {
			// Ignore.
		}
	}

	private async atomic(file: string, data: Buffer | string): Promise<void> {
		await mkdir(dirname(file), { recursive: true });
		const tmp = `${file}.${process.pid}.tmp`;
		try {
			await writeFile(tmp, data);
			await rename(tmp, file);
		} catch (error) {
			await rm(tmp, { force: true });
			throw error;
		}
	}

	private async fileInfo(rel: string): Promise<FileInfo | undefined> {
		try {
			const path = join(this.root, rel);
			const s = await stat(path);
			if (!s.isFile()) {
				return undefined;
			}
			const meta = await readMeta(path);
			return {
				rel,
				size: s.size,
				at: meta ? Date.parse(meta.fetchedAt) : s.mtimeMs,
			};
		} catch {
			// Gone already.
			return undefined;
		}
	}

	private async files(): Promise<FileInfo[]> {
		let names: string[];
		try {
			names = await readdir(this.root, { recursive: true });
		} catch {
			return [];
		}
		const wanted = names.filter(
			(rel) => !rel.endsWith(".meta.json") && !rel.endsWith(".tmp"),
		);
		const infos = await Promise.all(wanted.map((rel) => this.fileInfo(rel)));
		return infos.filter((i) => i !== undefined);
	}

	private async total(): Promise<number> {
		const all = await this.files();
		return all.reduce((n, f) => n + f.size, 0);
	}

	/** Same rules as prune(), for the in-memory fallback. */
	private pruneMemory(keep: string): void {
		const mem = this.memory;
		if (!mem) {
			return;
		}
		const all = [...mem].map(([rel, c]) => ({
			rel,
			size: Buffer.byteLength(c.body),
			at: c.meta ? Date.parse(c.meta.fetchedAt) : 0,
		}));
		for (const f of pickVictims(all, keep)) {
			mem.delete(f.rel);
		}
	}

	/** Deletes the least recently fetched files (pages of platform, code, and claude-resources first, then site pages) until under the cap. */
	private async prune(keep: string): Promise<void> {
		const all = await this.files();
		const victims = pickVictims(all, keep);
		await Promise.all(victims.map((f) => this.delete(f.rel)));
		this.approx =
			all.reduce((n, f) => n + f.size, 0) -
			victims.reduce((n, f) => n + f.size, 0);
	}
}
