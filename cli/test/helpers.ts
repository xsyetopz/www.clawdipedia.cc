// Shared helpers of the cli tests: temp folders, mock doc servers, and runners for the bundle and the MCP server.
import { afterAll } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { searchIndexJson } from "../../plugin/mcp/src/search.ts";

export const ROOT = join(import.meta.dir, "..", "..");
export const BIN = join(ROOT, "cli", "bin", "clawdipedia");
const FIXTURES = join(ROOT, "plugin", "mcp", "test", "fixtures");
const SITE = join(FIXTURES, "site");
const PLATFORM = join(FIXTURES, "platform");

const stops: (() => unknown)[] = [];
afterAll(async () => {
	await Promise.all(stops.map((f) => f()));
});

/** True when the path exists, as a file or a folder. */
export const pathExists = async (path: string): Promise<boolean> => {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
};

const isFile = async (path: string): Promise<boolean> => {
	try {
		const info = await stat(path);
		return info.isFile();
	} catch {
		return false;
	}
};

/** The routes that a text output names as "route `x`". */
export const routesInText = (text: string): string[] =>
	[...text.matchAll(/route `([^`]+)`/gu)].map((m) => m[1] ?? "");

export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null;

/** Reads a JSON file as unknown data. */
export const readJson = async (path: string): Promise<unknown> => {
	const v: unknown = await Bun.file(path).json();
	return v;
};

export const hitRoutesOf = (hits: unknown): string[] => {
	if (!Array.isArray(hits)) {
		throw new TypeError("hits is not an array");
	}
	const list: unknown[] = hits;
	return list.map((h) => {
		if (!isRecord(h) || typeof h["route"] !== "string") {
			throw new TypeError("a hit has no route");
		}
		return h["route"];
	});
};

/** The routes of the hits in a `--json` search output. */
export const hitRoutes = (json: string): string[] => {
	const data: unknown = JSON.parse(json);
	if (!isRecord(data)) {
		throw new TypeError("the output is not an object");
	}
	return hitRoutesOf(data["hits"]);
};

/** Makes a temp folder that is removed after the file. */
export const tmp = async (): Promise<string> => {
	const d = await mkdtemp(join(tmpdir(), "ccdocs-cli-test-"));
	stops.push(() => rm(d, { recursive: true, force: true }));
	return d;
};

interface ManifestEntry {
	route: string;
	title: string;
	description: string;
}

const manifestOf = (text: string): ManifestEntry[] => {
	const data: unknown = JSON.parse(text);
	if (!Array.isArray(data)) {
		throw new TypeError("the manifest is not an array");
	}
	const list: unknown[] = data;
	return list.map((e) => {
		if (
			!isRecord(e) ||
			typeof e["route"] !== "string" ||
			typeof e["title"] !== "string" ||
			typeof e["description"] !== "string"
		) {
			throw new TypeError("a manifest entry is malformed");
		}
		return {
			route: e["route"],
			title: e["title"],
			description: e["description"],
		};
	});
};

const siteIndex = async (manifest: string): Promise<string> => {
	const pages = await Promise.all(
		manifestOf(manifest).map(async (e) => ({
			route: e.route,
			title: e.title,
			description: e.description,
			text: await Bun.file(
				join(SITE, e.route === "/" ? "index.md" : `${e.route.slice(1)}.md`),
			).text(),
		})),
	);
	return searchIndexJson("test", pages);
};

const siteResponse = async (req: Request): Promise<Response> => {
	const url = new URL(req.url);
	const manifest = await Bun.file(join(SITE, "manifest.json")).text();
	if (url.pathname === "/llms-manifest.json") {
		return new Response(
			manifest.replaceAll("https://clawdipedia.cc", url.origin),
		);
	}
	if (url.pathname === "/llms.txt") {
		return new Response("# T\n\n> Docs for Claude Code 2.1.305.\n");
	}
	if (url.pathname === "/llms-search-index.json") {
		return new Response(await siteIndex(manifest));
	}
	const file = join(SITE, url.pathname.slice(1));
	if (url.pathname.includes("..") || !(await isFile(file))) {
		return new Response("no", { status: 404 });
	}
	return new Response(Bun.file(file));
};

/** Mock docs site: the fixture manifest (URLs rewritten), pages, schemas, and a llms-search-index.json. */
export const mockSite = () => {
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: siteResponse,
	});
	stops.push(() => srv.stop(true));
	return {
		url: `http://127.0.0.1:${srv.port}`,
		stop: () => srv.stop(true),
	};
};

const platformResponse = async (req: Request): Promise<Response> => {
	const url = new URL(req.url);
	if (url.pathname === "/llms.txt") {
		const text = await Bun.file(join(PLATFORM, "llms.txt")).text();
		return new Response(
			text.replaceAll("https://platform.claude.com", url.origin),
		);
	}
	const m = /^\/docs\/en\/([a-z0-9/-]+)\.md$/u.exec(url.pathname);
	const file = m ? join(PLATFORM, `${m[1]?.replaceAll("/", "__")}.md`) : "";
	return m && (await isFile(file))
		? new Response(Bun.file(file))
		: new Response("no", { status: 404 });
};

/** Mock platform.claude.com: llms.txt and the fixture pages. */
export const mockPlatform = () => {
	const srv = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: platformResponse,
	});
	stops.push(() => srv.stop(true));
	return { url: `http://127.0.0.1:${srv.port}` };
};

/** The environment of a run: the real one without the clawdipedia settings, plus `env`. */
export const envOf = (env: Record<string, string>): Record<string, string> => {
	const clean = Object.fromEntries(
		Object.entries(process.env).filter(
			(e): e is [string, string] =>
				typeof e[1] === "string" &&
				!/^(CLAWDIPEDIA_|CLAUDE_RESOURCES_|CODE_DOCS_|CLAUDE_PLUGIN_DATA|PLATFORM_DOCS_)/u.test(
					e[0],
				),
		),
	);
	return { ...clean, ...env };
};

/** Runs the bundle. Async, so the mock servers of this process keep answering. */
export const cc = async (args: string[], env: Record<string, string> = {}) => {
	const p = Bun.spawn(["bun", BIN, ...args], {
		env: envOf(env),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	return { code, out, err };
};

/** A mock site, a fresh cache folder, and the env that points the bundle at both. */
export const withSite = async () => {
	const site = mockSite();
	const cache = await tmp();
	return {
		site,
		cache,
		env: { CLAWDIPEDIA_BASE_URL: site.url, CLAWDIPEDIA_CACHE_DIR: cache },
	};
};
