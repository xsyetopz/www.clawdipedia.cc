// Shared state of the code adapter (code.ts): the arguments, the program bundle, the resolver, the notes,
// and the helpers every surface builder uses.
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";

import {
	Bundle,
	type Fn,
	isFn,
	type Module,
	type Node,
} from "../../../inspect/mcp/src/ast.ts";
import { extractModules } from "../../../inspect/mcp/src/bunfs.ts";
import { type Entry, Resolver } from "../../../inspect/mcp/src/resolve.ts";
import { CLAUDE_CODE_VERSION } from "../../../src/version.ts";

export type Json = Record<string, unknown>;
export type Src = Module;

export const ROOT = resolve(import.meta.dir, "../../..");
const BASE_URL = "https://clawdipedia.cc/schemas";

export const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
	const i = argv.indexOf(name);
	return i === -1 ? undefined : argv[i + 1];
};
export const BIN =
	arg("--bin") ??
	join(homedir(), ".local/share/claude/versions", CLAUDE_CODE_VERSION);
export const OUT = arg("--out") ?? join(ROOT, "schemas");
export const VERSION = /^\d+\.\d+\.\d+/u.exec(basename(BIN))?.[0] ?? "unknown";
export const CAPTURES = arg("--captures") ?? join(ROOT, "captures", VERSION);

export const report: string[] = [];
export const note = (s: string) => report.push(s);

// ---------------------------------------------------------------- program access

const { modules: binModules } = await extractModules(BIN);
export const bundle = new Bundle(
	binModules
		.filter((m) => /\.m?js$/u.test(m.name))
		.map((m) => ({ name: m.name, text: m.source })),
);
export const mods: Src[] = [...bundle.modules.values()];
export const R = new Resolver();
/** Modules whose text contains `needle`. */
const withText = (needle: string): Src[] => bundle.withText(needle);
export const only = (needle: string): Src => {
	const hit = withText(needle);
	if (hit.length === 0) {
		throw new Error(`anchor not found: ${needle}`);
	}
	if (hit.length > 1) {
		throw new Error(`anchor in ${hit.length} modules: ${needle}`);
	}
	const [first] = hit;
	if (first === undefined) {
		throw new Error(`anchor not found: ${needle}`);
	}
	return first;
};
export const idx = (src: Src, needle: string | RegExp): number => {
	const i =
		typeof needle === "string"
			? src.text.indexOf(needle)
			: needle.exec(src.text)?.index;
	if (i === undefined || i < 0) {
		throw new Error(`anchor not found in ${src.name}: ${needle}`);
	}
	return i;
};
/** Entries of the object literal that starts at the `{` that ends the regex match. */
export const literalAfter = (
	src: Src,
	re: RegExp,
): { entries: Entry[]; at: number } => {
	const m = re.exec(src.text);
	if (!m) {
		throw new Error(`anchor not found in ${src.name}: ${re}`);
	}
	const at = m.index + m[0].length - 1;
	return { entries: R.objectAt(src, at), at };
};
/** The innermost function around index `pos` that passes `test`. */
export const fnAround = (
	src: Src,
	pos: number,
	test: (f: Fn) => boolean,
): Fn | undefined => {
	for (let n: Node | undefined = src.nodeAt(pos); n; n = src.parent(n)) {
		if (isFn(n) && test(n)) {
			return n;
		}
	}
	return undefined;
};
export const isJson = (v: unknown): v is Json =>
	typeof v === "object" && v !== null;

const readOptional = async (path: string): Promise<Json | undefined> => {
	const file = Bun.file(path);
	if (!(await file.exists())) {
		return undefined;
	}
	const parsed: unknown = await file.json();
	return isJson(parsed) ? parsed : undefined;
};
/** The JSON files the builders read, loaded once at start-up (the builders are synchronous). */
const PRELOAD = [
	join(OUT, "claude-code-stream-json.json"),
	join(CAPTURES, "print/transcripts.lines.json"),
	join(CAPTURES, "pty/statusline.refresh-interval.json"),
	join(CAPTURES, "pty/statusline.subagent-tick.json"),
];
const preloaded = new Map<string, Json | undefined>(
	await Promise.all(
		PRELOAD.map(async (p): Promise<[string, Json | undefined]> => [
			p,
			await readOptional(p),
		]),
	),
);
export const readJson = (path: string): Json | undefined => {
	if (!preloaded.has(path)) {
		throw new Error(`readJson: ${path} is not preloaded`);
	}
	return preloaded.get(path);
};
export const esc = (id: string) => id.replaceAll("$", String.raw`\$`);

// "const": a string literal is the only value; "default": it is the default value; "plain": just a string.
export type Mode = "const" | "default" | "plain";
export const UNVERIFIED: Json = { "x-unverified": true };

export const header = (file: string, title: string, comment: string): Json => ({
	$schema: "https://json-schema.org/draft/2020-12/schema",
	$id: `${BASE_URL}/${file}`,
	title: `${title} (Claude Code ${VERSION})`,
	$comment: `${comment} A field that is still x-unverified may carry x-observed-type: the JSON types that real payloads had there, from the fixtures in tools/schemas/observed/ (stub probes and local files, no value kept). It is a note, not a check.`,
});

const isProps = (v: unknown): v is Record<string, Json> => isJson(v);

/** The live `properties` object of a schema (a detached empty object when there is none). */
export const props = (s: Json): Record<string, Json> => {
	const p = s["properties"];
	return isProps(p) ? p : {};
};

/** Mark properties named in `keys` as observed, and add the ones the code did not show. */
export const markObserved = (schema: Json, keys: string[]): number => {
	const p = props(schema);
	for (const k of keys) {
		p[k] = { ...(p[k] ?? { ...UNVERIFIED }), "x-observed": true };
	}
	schema["properties"] = p;
	return keys.length;
};

export const countProps = (s: unknown): number => {
	if (!isJson(s)) {
		return 0;
	}
	let n = 0;
	for (const [k, v] of Object.entries(s)) {
		if (k === "properties" && isJson(v)) {
			for (const sub of Object.values(v)) {
				n += 1 + countProps(sub);
			}
		} else if (k === "$defs" && isJson(v)) {
			for (const sub of Object.values(v)) {
				n += countProps(sub);
			}
		} else {
			n += countProps(v);
		}
	}
	return n;
};

/** Capture group `i` of a match; throws when the group did not take part. */
export const group = (m: RegExpMatchArray, i: number): string => {
	const g = m[i];
	if (g === undefined) {
		throw new Error(`regex group ${i} missing in match`);
	}
	return g;
};

export const isStringArray = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((x) => typeof x === "string");

/** Parse JSON text that holds an array of strings. */
export const parseStrings = (text: string): string[] => {
	const v: unknown = JSON.parse(text);
	if (!isStringArray(v)) {
		throw new Error(`not a string array: ${text}`);
	}
	return v;
};

/** The `data.stdinKeys` list of a probe fixture, or an empty list. */
export const stdinKeys = (probe: Json | undefined): string[] => {
	const data = probe?.["data"];
	if (!isJson(data)) {
		return [];
	}
	const keys = data["stdinKeys"];
	return isStringArray(keys) ? keys : [];
};

/** Keys in `localeCompare` order (an insertion sort, as the lib has no toSorted and lint bans sort). */
export const sortedKeys = (o: Record<string, unknown>): string[] => {
	const keys: string[] = [];
	for (const k of Object.keys(o)) {
		const at = keys.findIndex((x) => x.localeCompare(k) > 0);
		keys.splice(at === -1 ? keys.length : at, 0, k);
	}
	return keys;
};
