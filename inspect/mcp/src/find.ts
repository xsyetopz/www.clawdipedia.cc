// `code` `find`: units of a prepared install (`prepare.ts`) ranked by the words of a plain-words query.
import type { Index, Unit } from "./prepare.ts";

/**
 * Each word scores 2 as an exact property name, 1 inside a string, property name, or label, and 0.5 inside the cleaned
 * text only (such as a regular expression). Ties go to the shorter unit.
 */
export const findUnits = (ix: Index, query: string, limit = 10) => {
	const words = [
		...new Set(
			query
				.toLowerCase()
				.split(/\s+/u)
				.filter((w) => w.length >= 2),
		),
	];
	const score = (u: Unit) => {
		const f = u.f.map((x) => x.toLowerCase());
		const k = u.k.toLowerCase();
		const t = u.t.toLowerCase();
		let n = 0;
		const hits: string[] = [];
		for (const w of words) {
			let s = 0;
			if (f.includes(`.${w}`)) {
				s = 2;
			} else if (f.some((x) => x.includes(w)) || k.includes(w)) {
				s = 1;
			} else if (t.includes(w)) {
				s = 0.5;
			}
			if (s) {
				hits.push(w);
			}
			n += s;
		}
		return { u, n, hits };
	};
	return ix.units
		.map(score)
		.filter((x) => x.n > 0)
		.toSorted((a, b) => b.n - a.n || a.u.t.length - b.u.t.length)
		.slice(0, limit);
};
