// Diffs two prepared installs (`prepare.ts`) by code unit, so a release shows as the few functions it changed.

import { norm } from "./diff/render.ts";
import type { Index, Unit } from "./prepare.ts";
import { matchUnits, parentOf, type Side, side, unitAt } from "./sides.ts";
import { NAME } from "./unitnames.ts";

export interface Change {
	kind: "changed" | "added" | "gone";
	from?: Unit;
	to?: Unit;
	/** the string constants it names and the small functions it calls (3 literals or fewer), with their strings, such as `$1a2b3c "tengu_x"` */
	calls: string[];
	/** the `name` of the nearest enclosing object that has one */
	subject?: string | undefined;
	/** what encloses it: the string constants its enclosing code names, then the literals of the nearest unit with some */
	within: string[];
}
const SMALL = 3;
const callsOf = (s: Side, u: Unit): string[] => {
	const out = new Set<string>();
	for (const [h] of u.t.matchAll(NAME)) {
		const v = s.names.constant(u.m, h);
		if (v !== undefined) {
			out.add(`${h} ${JSON.stringify(v)}`);
		}
		const f = s.names.fn(u.m, h);
		const lits = f?.f.filter((x) => x.startsWith('"')) ?? [];
		if (lits.length > 0 && lits.length <= SMALL) {
			out.add(`${h} ${lits.join(" ")}`);
		}
	}
	return [...out];
};

export interface Diff {
	counts: { changed: number; added: number; gone: number };
	changes: Change[];
}

/** The `name` of the nearest enclosing object that has one, such as a tool's or a command's. */
const subjectOf = (s: Side, i: number): string | undefined => {
	for (let p = parentOf(s, i); p >= 0; p = parentOf(s, p)) {
		const u = unitAt(s, p);
		const m = /name:(?:"([^"]*)"|(\$[0-9a-f]{6}(?:_\d+)?))/u.exec(u.t);
		if (m) {
			return m[1] ?? s.names.constant(u.m, m[2] ?? "");
		}
	}
	return undefined;
};

const withinOf = (s: Side, i: number): string[] => {
	const names = new Set<string>();
	let lits: string[] = [];
	for (let p = parentOf(s, i); p >= 0; p = parentOf(s, p)) {
		const u = unitAt(s, p);
		for (const [h] of u.t.matchAll(NAME)) {
			const v = s.names.constant(u.m, h);
			if (v !== undefined && v !== "") {
				names.add(JSON.stringify(v));
			}
		}
		if (lits.length === 0) {
			lits = u.f.filter((x) => x.startsWith('"'));
		}
	}
	return [...names, ...lits];
};

/** The free units of `s`, as changes that `end` gives the kind and the unit of. */
const unpaired = (
	s: Side,
	end: (u: Unit) => Pick<Change, "kind" | "from" | "to">,
): Change[] =>
	s.us.flatMap((u, i) =>
		s.free[i] === true
			? [
					{
						...end(u),
						calls: callsOf(s, u),
						within: withinOf(s, i),
						subject: subjectOf(s, i),
					},
				]
			: [],
	);

/** Matches units by text, then fingerprint, then label and parent, then literal overlap (0.6 or more). */
export const diffIndexes = (from: Index, to: Index): Diff => {
	const a = side(from);
	const b = side(to);
	const changes: Change[] = [];
	// A pair with equal text (names aside) is unchanged, whichever stage paired it.
	matchUnits(a, b, (i, j) => {
		const [x, y] = [unitAt(a, i), unitAt(b, j)];
		if (norm(x.t) !== norm(y.t)) {
			changes.push({
				kind: "changed",
				from: x,
				to: y,
				calls: [...callsOf(a, x), ...callsOf(b, y)],
				within: withinOf(b, j),
				subject: subjectOf(b, j),
			});
		}
	});
	changes.push(
		...unpaired(b, (u) => ({ kind: "added", to: u })),
		...unpaired(a, (u) => ({ kind: "gone", from: u })),
	);
	const count = (k: Change["kind"]) =>
		changes.filter((c) => c.kind === k).length;
	return {
		counts: {
			changed: count("changed"),
			added: count("added"),
			gone: count("gone"),
		},
		changes,
	};
};

export { NAME, namesOf, parentsOf } from "./unitnames.ts";
export { cut, filterChanges, lines, unitDiff } from "./diff/render.ts";
