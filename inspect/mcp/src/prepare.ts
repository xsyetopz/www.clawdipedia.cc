// Prepares one install for diffs: each JS module cleaned (`clean.ts`), and an index of its code units (`units.ts`), cached on disk.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readdir, rename, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { basename, join } from "node:path";

import { mapSeq, Module } from "./ast.ts";
import { listInstalls, program } from "./binary.ts";
import { renameChunks, renamer } from "./clean.ts";
import { exists } from "./fs.ts";
import { isRecord } from "./json.ts";
import { type Unit, unitsOf } from "./units.ts";

export { type Unit, unitsOf } from "./units.ts";

/** Raise when the cleaning or the units change, so an older cache is cleaned again. */
export const FORMAT = 2;

export interface Index {
	/** `FORMAT` of the code that wrote it */
	format?: number;
	version: string;
	binary: { size: number; mtime: number };
	/** modules that do not parse as JavaScript, with the parser's message */
	skipped: Record<string, string>;
	/** old chunk file name to the stable one */
	chunks: Record<string, string>;
	units: Unit[];
}

const sha = (s: string, n: number) =>
	createHash("sha1").update(s).digest("hex").slice(0, n);

/** Where cleaned installs live: `CC_INSPECT_CACHE`, else `./captures` when it exists, else `~/.cache/cc-inspect`. */
export const cacheRoot = async (): Promise<string> => {
	const captures = join(process.cwd(), "captures");
	return (
		process.env["CC_INSPECT_CACHE"] ??
		((await exists(captures))
			? captures
			: join(homedir(), ".cache", "cc-inspect"))
	);
};

const binaryStat = async (path: string) => {
	const st = await Bun.file(path).stat();
	return { size: st.size, mtime: Math.round(st.mtimeMs) };
};

/** Formats every file in `dir` with one `bun fmt` run, from a temp folder so no project config applies. */
const formatDir = async (files: Map<string, string>, out: string) => {
	const tmp = await mkdtemp(join(tmpdir(), "cc-inspect-fmt-"));
	try {
		await Promise.all(
			[...files].map(([f, text]) => Bun.write(join(tmp, f), text)),
		);
		const proc = Bun.spawn([process.execPath, "fmt", "--no-script", "."], {
			cwd: tmp,
			env: { PATH: process.env["PATH"] ?? "" },
			stdout: "ignore",
			stderr: "pipe",
		});
		const [stderr, exitCode] = await Promise.all([
			new Response(proc.stderr).text(),
			proc.exited,
		]);
		if (exitCode !== 0) {
			throw new Error(`bun fmt failed: ${stderr.slice(0, 300)}`);
		}
		await mkdir(out, { recursive: true });
		const names = await readdir(tmp);
		await Promise.all(names.map((f) => rename(join(tmp, f), join(out, f))));
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

interface Cleaned {
	units: Unit[];
	texts: Map<string, string>;
	literals: Map<string, string[]>;
	skipped: Record<string, string>;
}

/** The parsed module, or the parser's message when the text is not JavaScript. */
const parsed = async (x: {
	name: string;
	text: string;
}): Promise<Module | string> => {
	try {
		return await Module.parse(x.name, x.text);
	} catch (error) {
		return (error instanceof Error ? error.message : String(error)).slice(
			0,
			120,
		);
	}
};

const cleanModules = async (
	js: { name: string; text: string }[],
): Promise<Cleaned> => {
	const out: Cleaned = {
		units: [],
		texts: new Map(),
		literals: new Map(),
		skipped: {},
	};
	// One module at a time: its syntax tree stays inside this call, so it is freed before the next parse.
	const cleaned = await mapSeq(js, async (x) => {
		const name = x.name.split("/").pop() ?? x.name;
		const m = await parsed(x);
		if (typeof m === "string") {
			return { name, error: m };
		}
		const render = renamer(m);
		const units = unitsOf(name, m, render);
		return { name, units, text: render(0, m.text.length) };
	});
	for (const c of cleaned) {
		if ("error" in c) {
			out.skipped[c.name] = c.error;
			continue;
		}
		out.units.push(...c.units);
		out.texts.set(c.name, c.text);
		out.literals.set(
			c.name,
			[...new Set(c.units.flatMap((u) => u.f))].toSorted(),
		);
	}
	return out;
};

// A chunk's stable name comes from its literals, which keep their text between builds.
const chunkNames = (literals: Map<string, string[]>): Map<string, string> => {
	const chunks = new Map<string, string>();
	for (const [name, lits] of literals) {
		if (/^chunk-[a-z0-9]+\.js$/u.test(name)) {
			chunks.set(name, `chunk@${sha(lits.join("\n"), 8)}.js`);
		}
	}
	return chunks;
};

// Gives each unit the one string of each text. Three of five units have the text of another unit, and a
// property name such as `.length` is in the fingerprint of thousands of units.
const shareStrings = (units: Unit[]): void => {
	const pool = new Map<string, string>();
	const one = (s: string): string => {
		const first = pool.get(s);
		if (first !== undefined) {
			return first;
		}
		pool.set(s, s);
		return s;
	};
	for (const u of units) {
		u.t = one(u.t);
		u.h = one(u.h);
		u.f = u.f.map((x) => one(x));
	}
};

const isIndex = (x: unknown): x is Index =>
	isRecord(x) &&
	typeof x["version"] === "string" &&
	isRecord(x["binary"]) &&
	Array.isArray(x["units"]);

const readCache = async (
	file: string,
	binary: Index["binary"],
): Promise<Index | undefined> => {
	const cached = Bun.file(file);
	if (!(await cached.exists())) {
		return undefined;
	}
	const index: unknown = JSON.parse(await cached.text());
	if (
		!isIndex(index) ||
		index.format !== FORMAT ||
		index.binary.size !== binary.size ||
		index.binary.mtime !== binary.mtime
	) {
		return undefined;
	}
	shareStrings(index.units);
	return index;
};

/**
 * Cleans the JS modules of an install and writes `<root>/<version>/clean/index.json` and `modules/`.
 * A second call for the same binary reads the cache and parses nothing (`parsed: 0`).
 */
export const prepare = async (
	version: string,
	binaryPath: string,
	modules: { name: string; text: string }[],
	root?: string,
): Promise<{ dir: string; index: Index; parsed: number; ms: number }> => {
	const t0 = performance.now();
	const dir = join(root ?? (await cacheRoot()), version, "clean");
	const file = join(dir, "index.json");
	const binary = await binaryStat(binaryPath);
	const cached = await readCache(file, binary);
	if (cached) {
		return {
			dir,
			index: cached,
			parsed: 0,
			ms: Math.round(performance.now() - t0),
		};
	}
	const js = modules.filter((x) => /\.m?js$/u.test(x.name));
	const { units, texts, literals, skipped } = await cleanModules(js);
	const chunks = chunkNames(literals);
	for (const u of units) {
		u.t = renameChunks(u.t, chunks);
		u.h = sha(u.t, 12);
	}
	shareStrings(units);
	const index: Index = {
		format: FORMAT,
		version,
		binary,
		skipped,
		chunks: Object.fromEntries(chunks),
		units,
	};
	await mkdir(dir, { recursive: true });
	await rm(join(dir, "readable"), { recursive: true, force: true });
	await formatDir(
		new Map([...texts].map(([n, t]) => [n, renameChunks(t, chunks)])),
		join(dir, "modules"),
	);
	await Bun.write(file, JSON.stringify(index));
	return {
		dir,
		index,
		parsed: js.length - Object.keys(skipped).length,
		ms: Math.round(performance.now() - t0),
	};
};

const preparedCache = new Map<string, ReturnType<typeof prepare>>();

/** `prepare` for a version or path, kept in memory for the server's life. */
export const prepared = async (
	binary?: string,
): Promise<Awaited<ReturnType<typeof prepare>>> => {
	const p = await program(binary);
	const installs = await listInstalls();
	const version =
		installs.find((i) => i.path === p.path)?.version ?? basename(p.path);
	const hit = preparedCache.get(p.path);
	if (hit) {
		return hit;
	}
	const pending = prepare(
		version,
		p.path,
		p.modules.map((m) => ({ name: m.name, text: m.source })),
	);
	preparedCache.set(p.path, pending);
	try {
		return await pending;
	} catch (error) {
		preparedCache.delete(p.path);
		throw error;
	}
};
