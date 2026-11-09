import type { Kind } from "./parts/kinds.ts";

export type { Kind } from "./parts/kinds.ts";

export type FactClass = "change" | "gap" | "info";
export type Status = "unmapped" | "mapped" | "static";
export interface Fact {
	id: string;
	file: string;
	line: number;
	text: string;
	heading: string;
	class: FactClass;
	kind: Kind | null;
	probes: string[];
	status: Status;
	/** names from diff/*.json found in backticks (auto mapping); compare uses them */
	diffNames?: string[];
}
export interface MapEntry {
	probes: string[];
	kind: Kind;
	note?: string;
}
export type FactMap = Record<string, MapEntry>;
