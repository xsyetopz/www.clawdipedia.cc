// Value-free observation of JSON payloads: key path -> JSON types seen, with counts. Never keeps a value.
// A path is `<root>.<key>.<key>`, with `[]` for array elements. An object with more than MAX_KEYS distinct
// keys under one path is a map: the keys past the limit fold into `*`.
import { sortedStrings } from "./sorted.ts";

export const MAX_KEYS = 60;
export const MAX_DEPTH = 8;

export interface Stat {
	n: number;
	types: Record<string, number>;
}
export type Observed = Record<string, Stat>;

export const jsonType = (v: unknown): string => {
	if (v === null) {
		return "null";
	}
	if (Array.isArray(v)) {
		return "array";
	}
	if (typeof v === "number") {
		return Number.isInteger(v) ? "integer" : "number";
	}
	// string, boolean, object
	return typeof v;
};

export class Tally {
	readonly stats = new Map<string, Stat>();
	private readonly kids = new Map<string, Set<string>>();

	/** Record `value` under `path`, then every key and array element below it. */
	add(path: string, value: unknown, depth = 0): void {
		const t = jsonType(value);
		const s: Stat = this.stats.get(path) ?? { n: 0, types: {} };
		this.stats.set(path, s);
		s.n++;
		s.types[t] = (s.types[t] ?? 0) + 1;
		if (depth >= MAX_DEPTH) {
			return;
		}
		if (Array.isArray(value)) {
			for (const x of value) {
				this.add(`${path}[]`, x, depth + 1);
			}
		} else if (typeof value === "object" && value !== null) {
			const set: Set<string> = this.kids.get(path) ?? new Set();
			this.kids.set(path, set);
			for (const [k, v] of Object.entries(value)) {
				let key = k;
				if (!set.has(k)) {
					if (set.size >= MAX_KEYS) {
						key = "*";
					} else {
						set.add(k);
					}
				}
				this.add(`${path}.${key}`, v, depth + 1);
			}
		}
	}

	toJSON(): Observed {
		const out: Observed = {};
		for (const k of sortedStrings([...this.stats.keys()])) {
			const s = this.stats.get(k);
			if (s === undefined) {
				continue;
			}
			out[k] = {
				n: s.n,
				types: Object.fromEntries(
					sortedStrings(Object.keys(s.types)).map((t) => [t, s.types[t] ?? 0]),
				),
			};
		}
		return out;
	}
}
