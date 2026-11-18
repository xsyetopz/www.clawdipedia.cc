// The audit of hand-read types: for each field that was "x-unverified" at a git ref, whether tools/schemas/manual/
// types it now, whether the program still has the code the entry was read from, and whether real payloads agree.
// A 0 count of "x-unverified" only shows the marks are gone; this shows, field by field, what each type rests on.
import { type ManualFixture, missedObserved } from "./manual.ts";
import type { Seen } from "./observed.ts";

/** What one field's type rests on, from weakest to strongest. */
export type Verdict =
	| "no entry"
	| "anchor gone"
	| "conflict"
	| "code only"
	| "site sampled"
	| "samples agree"
	| "removed";

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
	/** For "site sampled": a field with the same entry (type and anchors) whose payloads agree. */
	via?: string;
}

/**
 * Audit each path against the manual fixture. `has` tells if an anchor is in the program, and `seen` holds the
 * type counts of real payloads per path. A field passes as "code only" or "samples agree"; `shareSamples` can then
 * lift a "code only" row to "site sampled".
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

/**
 * Mark each "code only" row "site sampled" when another row has the same entry and agreeing payloads. The anchors
 * name the code that writes the value, so the same anchors and type mean the same write site: for example, the base
 * OpenTelemetry attributes that every event, metric, and span takes from one builder.
 */
export const shareSamples = (
	rows: AuditRow[],
	manual: ManualFixture | undefined,
): AuditRow[] => {
	const key = (path: string): string | undefined => {
		const e = manual?.fields[path];
		return e === undefined
			? undefined
			: JSON.stringify([e.schema, [...e.anchors].toSorted()]);
	};
	const sampled = new Map<string, string>();
	for (const r of rows) {
		const k = key(r.path);
		if (r.verdict === "samples agree" && k !== undefined && !sampled.has(k)) {
			sampled.set(k, r.path);
		}
	}
	return rows.map((r) => {
		const k = key(r.path);
		const via = k === undefined ? undefined : sampled.get(k);
		return r.verdict === "code only" && via !== undefined
			? { ...r, verdict: "site sampled", via }
			: r;
	});
};

/**
 * Mark each row "removed" when the current schema no longer has its path: the generator found that no line the
 * program writes holds the field (for example, a row the transcript writer drops), so no type is owed for it.
 */
export const markRemoved = (
	rows: AuditRow[],
	present: (path: string) => boolean,
): AuditRow[] =>
	rows.map((r) =>
		present(r.path)
			? r
			: {
					path: r.path,
					verdict: "removed",
					missing: [],
					missed: [],
					samples: r.samples,
				},
	);

const PASS: ReadonlySet<Verdict> = new Set([
	"code only",
	"site sampled",
	"samples agree",
	"removed",
]);

/** Whether every row passes: typed, read from code the program still has, and not contradicted by a payload. */
export const auditPasses = (rows: AuditRow[]): boolean =>
	rows.every((r) => PASS.has(r.verdict));
