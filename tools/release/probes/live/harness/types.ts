import { PROMPT } from "../../../lib/env.ts";
import type { Mitm } from "../../../lib/mitm.ts";
import type { CaseResult, Data } from "../../../lib/results.ts";
import type { Stub } from "../../../lib/stub.ts";

export interface LiveCtx {
	version: string;
	bin: string;
	/** captures/<v>, or a temp dir in dry mode */
	runDir: string;
	token: string;
	dry: boolean;
	/** Dry only: local stub that stands in for the API. */
	stub?: Stub;
	stubBase?: (id: string) => Promise<string>;
}

export interface LiveCase {
	/** Inside the group: "live.<name>" is the CaseResult id. */
	id: string;
	title: string;
	coldSensitive?: boolean;
	/** Rough model-request count, for the plan. */
	requests: string;
	/** Extra plan line (side effects). */
	note?: string;
	run: (x: LiveCtx) => Promise<CaseResult[]>;
}

export interface EnvOpts {
	mitm?: Mitm;
	tty?: boolean;
	allowNonessential?: boolean;
	featureGates?: boolean;
	/** Dry: route the program at the local stub (print cases). */
	caseId?: string;
}

export const baseResult = (
	x: LiveCtx,
	id: string,
	o: Partial<CaseResult> & { data: Record<string, Data> },
): CaseResult => ({
	schema: 1,
	id: `live.${id}`,
	group: "live",
	version: x.version,
	prompt: PROMPT,
	args: [],
	// name only
	envSet: ["CLAUDE_CODE_OAUTH_TOKEN"],
	exit: null,
	timedOut: false,
	facts: [],
	...o,
});
