// The shared stub of a pty probe run, the {HOME}/{CFG}/{PROJ} substitution, and the base case result.
import { PROMPT } from "../../../lib/env.ts";
import { allocPort } from "../../../lib/ports.ts";
import type { CaseResult, Data } from "../../../lib/results.ts";
import type { Sandbox } from "../../../lib/sandbox.ts";
import { type LoggedRequest, startStub, type Stub } from "../../../lib/stub.ts";
import type { PtyCase, PtyCtx } from "./types.ts";

let stubP: Promise<Stub> | null = null;
const open = async (): Promise<Stub> => startStub(await allocPort());
export const getStub = (): Promise<Stub> => {
	stubP ??= open();
	return stubP;
};
export const stopStub = async (): Promise<LoggedRequest[]> => {
	const p = stubP;
	stubP = null;
	if (p === null) {
		return [];
	}
	const stub = await p;
	return stub.stop();
};

export const subst = (s: string, sb: Sandbox): string =>
	s
		.split("{HOME}")
		.join(sb.home)
		.split("{CFG}")
		.join(sb.cfg)
		.split("{PROJ}")
		.join(sb.proj);

/** `subst` over every string value of a JSON-like value. */
export const deepSubst = (v: unknown, sb: Sandbox): unknown => {
	if (typeof v === "string") {
		return subst(v, sb);
	}
	if (Array.isArray(v)) {
		return v.map((x) => deepSubst(x, sb));
	}
	if (typeof v === "object" && v !== null) {
		return Object.fromEntries(
			Object.entries(v).map(([k, x]) => [k, deepSubst(x, sb)]),
		);
	}
	return v;
};

export const baseResult = (
	ctx: PtyCtx,
	c: Pick<PtyCase, "id" | "facts" | "notes" | "promptReason">,
	o: Partial<CaseResult> & { data: Record<string, Data> },
): CaseResult => {
	const note = [c.promptReason, c.notes, o.notes]
		.filter((n) => n !== undefined && n !== "")
		.join(" ");
	return {
		schema: 1,
		id: `pty.${c.id}`,
		group: "pty",
		version: ctx.version,
		prompt: PROMPT,
		args: [],
		envSet: [],
		exit: null,
		timedOut: false,
		facts: c.facts ?? [],
		...o,
		...(note === "" ? {} : { notes: note }),
	};
};
