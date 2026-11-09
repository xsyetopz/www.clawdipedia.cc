import { type CaseResult, redact, writeCase } from "../../../lib/results.ts";
import { baseResult, type LiveCase, type LiveCtx } from "../harness.ts";

export const messageOf = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/** One attempt; a throw becomes an invalid result with the redacted message. */
export const runSafely = async (
	c: LiveCase,
	x: LiveCtx,
): Promise<CaseResult[]> => {
	try {
		return await c.run(x);
	} catch (error) {
		return [
			baseResult(x, c.id, {
				data: {
					precondition: false,
					error: redact(`case failed: ${messageOf(error)}`).slice(0, 300),
				},
			}),
		];
	}
};

export const markWarm = (
	r: CaseResult,
	c: LiveCase,
	suspectWarm: boolean,
): CaseResult =>
	c.coldSensitive === true && suspectWarm && r.cacheWarm === undefined
		? {
				...r,
				cacheWarm: true,
				notes:
					`${r.notes ?? ""} Previous live run under 1 h ago: cache may be warm.`.trim(),
			}
		: r;

const warmTag = (r: CaseResult): string => {
	if (r.cacheWarm === undefined) {
		return "";
	}
	return r.cacheWarm ? " cacheWarm" : " cold";
};

/** Writes the result file and prints its line; true when the probe is invalid. */
export const record = async (
	runDir: string,
	r: CaseResult,
	dry: boolean,
): Promise<boolean> => {
	await writeCase(runDir, r);
	const bad = r.data["precondition"] === false;
	const why = bad
		? ` (${String(r.data["error"] ?? r.data["precondition.detail"] ?? "")})`
		: "";
	if (dry) {
		console.info(`      data: ${JSON.stringify(r.data)}`);
	}
	console.info(`  ${bad ? "INVALID" : "ok     "} ${r.id}${warmTag(r)}${why}`);
	return bad;
};
