// Types and helpers that the modules of the exclusions audit (audit.ts) share.
import type { Bundle } from "../../inspect/mcp/src/ast.ts";
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import { compare } from "./coverage.ts";

export type Evidence = Record<string, unknown>;
export interface Verdict {
	ok: boolean;
	evidence: Evidence;
}

export interface Found {
	version: string;
	from: "embedded" | "range-max" | "dated";
	source: string;
	/** Other releases the program may hold: the floor of each range, or for a dated pick the highest release of each of the last four minors of its major. */
	also?: string[];
}

export interface Ctx {
	version: string;
	root: string;
	bundle: Bundle;
	items: Map<string, SurfaceItem>;
	sweep: Record<string, unknown>;
	endpointRows: Map<string, string>;
	/** The library package -> { version, source } that the audit used. */
	libraries: Record<string, Found>;
}

export const reEscape = (s: string) =>
	s.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);
/** The name and text of each file of the program, in bundle order. */
export const allText = (c: Ctx) =>
	[...c.bundle.texts].map(([name, text]) => ({ name, text }));

/** Whether a value is a list of strings. */
export const isStrings = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((x: unknown) => typeof x === "string");

/** Run `run` on each item in order, one after the other, and give the first result that is not `undefined`. */
export const firstOf = async <T, R>(
	list: T[],
	run: (item: T) => Promise<R | undefined>,
): Promise<R | undefined> => {
	const [head, ...rest] = list;
	if (head === undefined) {
		return undefined;
	}
	return (await run(head)) ?? firstOf(rest, run);
};

/** Run `run` on each item in order, one after the other. */
export const eachOf = async <T>(
	list: T[],
	run: (item: T) => Promise<void>,
): Promise<void> => {
	const [head, ...rest] = list;
	if (head === undefined) {
		return;
	}
	await run(head);
	await eachOf(rest, run);
};

/** The strings in byte order, as a new array. */
export const sorted = (list: Iterable<string>): string[] => {
	const out = [...list];
	out.sort(compare);
	return out;
};
