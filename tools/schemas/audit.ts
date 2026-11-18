// The audit of hand-read types: for each field that was "x-unverified" at a git ref, whether tools/schemas/manual/
// types it now, whether the program still has the code the entry was read from, and whether real payloads agree.
// A 0 count of "x-unverified" only shows the marks are gone; this shows, field by field, what each type rests on.
import { type ManualFixture, missedObserved } from "./manual.ts";
import type { Seen } from "./observed.ts";

/** What one field's type rests on, from weakest to strongest. */
export type Verdict =
	"no entry" | "anchor gone" | "conflict" | "code only" | "samples agree";

/** The audit of one formerly unverified field. */
export interface AuditRow {
	path: string;
	verdict: Verdict;
	/** The anchors of the entry that the program does not have. */
	missing: string[];
	/** The types real payloads had that the entry does not allow. */
	missed: string[];
	/** The number of real payload values seen at the field. */
	samples: number;
}

/**
 * Audit each path against the manual fixture. `has` tells if an anchor is in the program, and `seen` holds the
 * type counts of real payloads per path. A field passes as "code only" or "samples agree".
 */
export const auditFields = (
	paths: string[],
	manual: ManualFixture | undefined,
	has: (anchor: string) => boolean,
	seen: Record<string, Seen>,
): AuditRow[] =>
	paths.map((path) => {
		const entry = manual?.fields[path];
		const counts = seen[path] ?? {};
		const samples = Object.values(counts).reduce((a, c) => a + c, 0);
		if (entry === undefined) {
			return { path, verdict: "no entry", missing: [], missed: [], samples };
		}
		const missing = entry.anchors.filter((a) => !has(a));
		const missed = missedObserved(entry.schema, counts);
		let verdict: Verdict = samples > 0 ? "samples agree" : "code only";
		if (missed.length > 0) {
			verdict = "conflict";
		}
		if (missing.length > 0 || entry.anchors.length === 0) {
			verdict = "anchor gone";
		}
		return { path, verdict, missing, missed, samples };
	});

/** Whether every row passes: typed, read from code the program still has, and not contradicted by a payload. */
export const auditPasses = (rows: AuditRow[]): boolean =>
	rows.every((r) => r.verdict === "code only" || r.verdict === "samples agree");
