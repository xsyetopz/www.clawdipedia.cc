// Shared helpers for the server tests: a client for dist/server.js and readers for its answers.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { mockSite } from "./mocks.ts";

export const SERVER = join(import.meta.dir, "..", "..", "dist", "server.js");
export const clients: Client[] = [];
export const stops: (() => unknown)[] = [];

const given = (v: string | undefined): v is string =>
	v !== undefined && v !== "";

/** A temp folder that the cleanup removes. */
export const tempDir = async (): Promise<string> => {
	const dir = await mkdtemp(join(tmpdir(), "ccdocs-test-"));
	stops.push(() => rm(dir, { recursive: true, force: true }));
	return dir;
};

export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const firstText = (content: unknown): string | undefined => {
	if (!Array.isArray(content)) {
		return undefined;
	}
	const first: unknown = content[0];
	const t = isRecord(first) ? first["text"] : undefined;
	return typeof t === "string" ? t : undefined;
};

/** Starts a client on dist/server.js. A test passes its own cache folder to share it between processes. */
export const connect = async (env: Record<string, string> = {}) => {
	const c = new Client({ name: "test", version: "0" });
	const clean = Object.fromEntries(
		Object.entries(process.env).filter(
			(e): e is [string, string] => typeof e[1] === "string",
		),
	);
	const site = given(env["CLAWDIPEDIA_BASE_URL"]) ? undefined : mockSite();
	const cache = given(env["CLAWDIPEDIA_CACHE_DIR"])
		? env["CLAWDIPEDIA_CACHE_DIR"]
		: await tempDir();
	stops.push(() => site?.stop());
	await c.connect(
		new StdioClientTransport({
			command: "bun",
			args: [SERVER],
			env: {
				...clean,
				...(given(env["CLAUDE_PLUGIN_DATA"])
					? {}
					: { CLAWDIPEDIA_CACHE_DIR: cache }),
				...(site ? { CLAWDIPEDIA_BASE_URL: site.url } : {}),
				...env,
			},
		}),
	);
	clients.push(c);
	const call = async (name: string, args: Record<string, unknown>) => {
		const r = await c.callTool({ name, arguments: args });
		const text = firstText(r.content) ?? "";
		const structured = isRecord(r.structuredContent)
			? r.structuredContent
			: undefined;
		return {
			error: r.isError === true,
			text,
			structured,
			// Claude Code 2.1.309 (`ds` in chunk-gf8e163f.js) shows the model only structuredContent when set.
			seen: structured ? JSON.stringify(structured) : text,
		};
	};
	return { call, cache };
};

type Called = Awaited<ReturnType<Awaited<ReturnType<typeof connect>>["call"]>>;
interface SourceData {
	origin: string;
	state: string;
	line?: string;
}

/** The structured `source` of a search or list answer: origin and state (live, cached, stale-offline). */
export const sourceOf = (r: Called): SourceData => {
	const s = r.structured?.["source"];
	if (
		!isRecord(s) ||
		typeof s["origin"] !== "string" ||
		typeof s["state"] !== "string"
	) {
		throw new TypeError("answer has no structured source");
	}
	const line = s["line"];
	return {
		origin: s["origin"],
		state: s["state"],
		...(typeof line === "string" ? { line } : {}),
	};
};

/** Integers in the structured Source line, without the origin and the first parenthesized state. Pins counts only, not wording. */
export const sourceNumbers = (r: Called): number[] => {
	const { origin, line = "" } = sourceOf(r);
	const bare = line.replace(origin, "").replace(/\([^)]*\)/u, "");
	return [...bare.matchAll(/\b\d+\b/gu)].map((m) => Number(m[0]));
};

/** The structured `pages` of a list answer: each route, with title and description when it has them. */
export const pagesOf = (
	r: Called,
): { route: string; title: string; description: string }[] => {
	const pages = r.structured?.["pages"];
	if (!Array.isArray(pages)) {
		throw new TypeError("answer has no structured pages");
	}
	return pages.map((p: unknown) => {
		if (!isRecord(p) || typeof p["route"] !== "string") {
			throw new TypeError("page has no route");
		}
		const { title, description } = p;
		return {
			route: p["route"],
			title: typeof title === "string" ? title : "",
			description: typeof description === "string" ? description : "",
		};
	});
};

export const cleanup = async (): Promise<void> => {
	await Promise.all(clients.splice(0).map((c) => c.close()));
	await Promise.all(stops.splice(0).map((f) => f()));
};
