import { PROMPT } from "../../../lib/env.ts";
import { type CaseResult, type Data, normalise } from "../../../lib/results.ts";
import type { PrintCtx } from "../types.ts";
import { msgs } from "./events.ts";
import { obj, type Run } from "./types.ts";

export const requestSummary = (r: Run): NonNullable<CaseResult["requests"]> => {
	const m = msgs(r)[0];
	const beta = m?.headers["anthropic-beta"];
	return {
		count: r.reqs.length,
		paths: [...new Set(r.reqs.map((x) => x.path))].toSorted(),
		...(beta !== undefined && beta !== "" ? { betas: beta.split(",") } : {}),
		...(m ? { bodyKeys: Object.keys(obj(m.body)) } : {}),
	};
};

/** Does this case id (full, `print.<group>.<case>`) match the --only list? Prefix match on dotted segments, both ways. */
export const selected = (ctx: PrintCtx, id: string): boolean => {
	if (!ctx.only) {
		return true;
	}
	return ctx.only.some((raw) => {
		const o = raw.startsWith("print.") ? raw : `print.${raw}`;
		return o === id || id.startsWith(`${o}.`) || o.startsWith(`${id}.`);
	});
};

const hasText = (s: string | undefined): boolean => s !== undefined && s !== "";

export const baseResult = (
	ctx: PrintCtx,
	id: string,
	run: Run | null,
	o: {
		data: Record<string, Data>;
		samples?: Record<string, string> | undefined;
		notes?: string;
		facts?: string[];
	},
): CaseResult => ({
	schema: 1,
	id,
	group: "print",
	version: ctx.version,
	prompt: run ? run.prompt || "(none)" : PROMPT,
	args: run ? normalise(run.args) : [],
	envSet: run ? run.envSet : [],
	exit: run ? run.code : null,
	timedOut: run ? run.timedOut : false,
	data: normalise(o.data),
	...(o.samples ? { samples: o.samples } : {}),
	...(run ? { requests: requestSummary(run) } : {}),
	facts: o.facts ?? [],
	...(hasText(run?.promptReason) || hasText(o.notes)
		? { notes: [run?.promptReason, o.notes].filter(Boolean).join(" ") }
		: {}),
});

/**
 * Run one case under the selection and dry rules. `build` does the work; a throw becomes a
 * `precondition: false` result so one broken probe never stops the run.
 */
export const oneCase = async (
	ctx: PrintCtx,
	id: string,
	build: () => Promise<CaseResult>,
): Promise<CaseResult[]> => {
	if (!selected(ctx, id)) {
		return [];
	}
	if (ctx.dry) {
		return [baseResult(ctx, id, null, { data: {} })];
	}
	try {
		return [await build()];
	} catch (error) {
		return [
			baseResult(ctx, id, null, {
				data: {
					precondition: false,
					error: error instanceof Error ? error.message : String(error),
				},
				notes: "probe invalid: threw before producing data",
			}),
		];
	}
};
