// B3-specific helpers on top of run.ts (runCase, oneCase, baseResult, msgs, events, dispose).

import type { CaseResult, Data } from "../../../lib/results.ts";
import type { LoggedRequest } from "../../../lib/stub.ts";
import {
	arr,
	baseResult,
	type Case,
	dispose,
	events,
	msgs,
	obj,
	oneCase,
	pathExists,
	type Run,
	runCase,
} from "../run.ts";
import type { PrintCtx } from "../types.ts";
import { mapInOrder } from "./seq.ts";

export { msgs, type Run } from "../run.ts";

/** A run.ts Case plus `stub` sugar for the canned reply (seq, respHeaders, text, tool, toolInput). */
export type Spec = Case & {
	stub?: Pick<Case, "seq" | "respHeaders" | "text" | "tool" | "toolInput">;
};

/** Run once; the sandbox lives until `fn` returns. */
export const withRun = async <T>(
	ctx: PrintCtx,
	spec: Spec,
	fn: (r: Run) => Promise<T> | T,
): Promise<T> => {
	const { stub, ...c } = spec;
	const r = await runCase(ctx.bin, { ...c, ...stub });
	try {
		return await fn(r);
	} finally {
		await dispose(r);
	}
};

// ---- request and event helpers -------------------------------------------------------------

interface Body {
	model?: string;
	system?: { text?: string }[] | string;
	tools?: { name: string }[];
	messages?: { role?: string; content?: unknown }[];
	[k: string]: unknown;
}
const isBody = (x: unknown): x is Body =>
	typeof x === "object" && x !== null && !Array.isArray(x);
export const bodyOf = (q: LoggedRequest): Body =>
	isBody(q.body) ? q.body : {};
const bodyField = (q: LoggedRequest, key: string): unknown => obj(q.body)[key];
export const toolNames = (q: LoggedRequest): string[] =>
	arr(bodyField(q, "tools")).map((t) => String(obj(t)["name"]));
export const sysText = (q: LoggedRequest): string => {
	const s = bodyField(q, "system");
	if (Array.isArray(s)) {
		return s
			.map((x) => {
				const t = obj(x)["text"];
				return typeof t === "string" ? t : "";
			})
			.join("\n");
	}
	return typeof s === "string" ? s : "";
};
export const json = (v: unknown): string => JSON.stringify(v) ?? "";
export const initEvent = (r: Run) =>
	events(r).find((e) => e["subtype"] === "init");
/** Text of any value: objects as JSON, the rest through String. */
export const show = (v: unknown): string =>
	typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
/** The value when it is a string, number or boolean; null otherwise. */
export const scalar = (v: unknown): Data =>
	typeof v === "string" || typeof v === "number" || typeof v === "boolean"
		? v
		: null;
export const evKinds = (r: Run): string =>
	events(r)
		.map((e) => `${show(e["type"])}/${show(e["subtype"] ?? "")}`)
		.join(" ");
const resultContents = (message: unknown): string[] =>
	arr(obj(message)["content"])
		.filter((c) => obj(c)["type"] === "tool_result")
		.map((c) => json(obj(c)["content"]));
/** The distinct tool_result contents the program sent back (JSON text). */
export const toolResultTexts = (r: Run): string[] => {
	const out = msgs(r).flatMap((q) =>
		arr(bodyField(q, "messages")).flatMap((m) => resultContents(m)),
	);
	return [...new Set(out)];
};
export const readCfg = async (r: Run, name: string): Promise<string> => {
	try {
		return await Bun.file(`${r.sb.cfg}/${name}`).text();
	} catch {
		return "";
	}
};
/** Replace the sandbox root and its dash-encoded form with a fixed token, so sizes do not depend on the tmp path. */
export const fixed = (r: Run, s: string): string =>
	s
		.split(r.sb.root)
		.join("<SB>")
		.split(r.sb.root.replaceAll(/[^A-Za-z0-9]/gu, "-"))
		.join("<SB>");

/** Is the program under test older than `v`? A case may accept a missing feature as a result only there, so a failure on a version that has the feature stays invalid. */
export const olderThan = (ctx: PrintCtx, v: string): boolean =>
	ctx.version.localeCompare(v, undefined, { numeric: true }) < 0;

// ---- case definitions ----------------------------------------------------------------------

export interface Out {
	data: Record<string, Data>;
	samples?: Record<string, string>;
	notes?: string;
	// Supplies prompt, args, envSet, exit and the request summary.
	from?: Run;
}
export interface CaseDef {
	// The case id is print.<group>.<name>.
	name: string;
	/** A file the case needs. When it is missing the case does not run: its result has `data.skipped` (the reason) and no `precondition: false`. */
	requires?: { path: string; reason: string };
	run: (ctx: PrintCtx) => Out | Promise<Out>;
}

const runDef = (
	ctx: PrintCtx,
	group: string,
	d: CaseDef,
): Promise<CaseResult[]> => {
	const id = `print.${group}.${d.name}`;
	return oneCase(ctx, id, async () => {
		if (d.requires !== undefined && !(await pathExists(d.requires.path))) {
			return baseResult(ctx, id, null, {
				data: {
					skipped: `${d.requires.reason} (missing ${d.requires.path})`,
				},
			});
		}
		const o = await d.run(ctx);
		return baseResult(ctx, id, o.from ?? null, {
			data: o.data,
			samples: o.samples,
			...(o.notes !== undefined && o.notes !== "" ? { notes: o.notes } : {}),
		});
	});
};

/** Each def goes through oneCase (selection, dry, probe-invalid on throw); index.ts writes the results. */
export const runCases = async (
	ctx: PrintCtx,
	group: string,
	defs: CaseDef[],
): Promise<CaseResult[]> => {
	const groups = await mapInOrder(defs, (d) => runDef(ctx, group, d));
	return groups.flat();
};
