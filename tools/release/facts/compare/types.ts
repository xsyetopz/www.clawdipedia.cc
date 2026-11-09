// Types of release:compare: the case diff, the fact rows and results, and the whole Compare record.
import type { Data } from "../../lib/results.ts";

/** `added`/`removed`: parts of the full sample text, when the data is a hash of it */
export interface DataChange {
	old: Data;
	new: Data;
	added?: string[];
	removed?: string[];
}

export interface CaseDiff {
	added: Record<string, Data>;
	removed: Record<string, Data>;
	changed: Record<string, DataChange>;
	samples?: Record<string, { old: string | null; new: string | null }>;
}
export interface FactRow {
	id: string;
	file: string;
	line: number;
	text: string;
	kind: string | null;
	probes: string[];
	status: string;
	class?: string;
	diffNames?: string[];
}
export type FactResult = FactRow & {
	result?: "changed" | "unchanged" | "not-run" | "invalid-run";
	why?: string;
	/** probe case id -> data -> why it was ignored for this fact (same rules as Compare.noise) */
	noise?: Record<string, Record<string, string>>;
};
export interface Compare {
	from: string;
	to: string;
	counts: {
		cases: number;
		changed: number;
		unchanged: number;
		/** cases where either side has precondition=false; not diffed */
		invalid: number;
	};
	/** case id -> data -> why it was ignored (known run-to-run noise, or a version string only); not diffs */
	noise?: Record<string, Record<string, string>>;
	/** case id -> precondition.detail for each invalid run */
	invalidRuns?: Record<string, string>;
	onlyFrom: string[];
	onlyTo: string[];
	cases: Record<string, CaseDiff>;
	facts?: FactResult[];
	/** names that appeared in diff/*.json for `to` and that no fact names (undocumented candidates) */
	uncoveredNames?: { kind: string; name: string }[];
	/** set when the old version has no case results */
	warning?: string;
}
