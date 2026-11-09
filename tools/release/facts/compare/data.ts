// Compares the observed data of release:compare: equality, sample parts, ignored data, empty diffs, invalid runs.
import type { CaseResult, Data } from "../../lib/results.ts";
import type { CaseDiff } from "./types.ts";

export const PARTS_CAP = 10;
export const parts = (s: string) => s.split(/[,|\s]+/u).filter(Boolean);
export const minus = (a: string[], b: string[]) => {
	const left = new Map<string, number>();
	for (const x of b) {
		left.set(x, (left.get(x) ?? 0) + 1);
	}
	return a.filter((x) => {
		const n = left.get(x) ?? 0;
		if (n) {
			left.set(x, n - 1);
		}
		return !n;
	});
};

export const same = (a: Data, b: Data): boolean =>
	JSON.stringify(a) === JSON.stringify(b);

/** Data that describe how a run went, not what the program does: never a diff. */
export const IGNORED_DATA = new Set(["retried", "startLagS"]);

/** The precondition.detail of an invalid run (either side), or null when both runs are valid. */
export const invalidDetail = (a: CaseResult, b: CaseResult): string | null => {
	for (const [side, r] of [
		["old", a],
		["new", b],
	] as const) {
		if (r.data["precondition"] === false) {
			return `${side}: ${String(r.data["precondition.detail"] ?? r.data["error"] ?? "precondition false")}`;
		}
	}
	return null;
};

export const isEmpty = (d: CaseDiff): boolean =>
	Object.keys(d.added).length === 0 &&
	Object.keys(d.removed).length === 0 &&
	Object.keys(d.changed).length === 0 &&
	!d.samples;
