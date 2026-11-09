// Pairs the code units of two prepared installs (`diff.ts` turns the pairs into changes).
// Stages run from the surest key to the loosest, and a unit pairs once.

import { norm } from "./diff/render.ts";
import type { Index, Unit } from "./prepare.ts";
import { addTo, namesOf, parentsOf } from "./unitnames.ts";

/** The share of literals that two units must have in common to pair by overlap. */
const MIN_OVERLAP = 0.6;
/** A literal that more units than this hold tells nothing. */
const COMMON = 50;

export interface Side {
	us: Unit[];
	parent: Int32Array;
	free: boolean[];
	/** the paired unit on the other side, or -1 */
	match: Int32Array;
	names: ReturnType<typeof namesOf>;
}
type Key = (s: Side, i: number) => string | undefined;
type Hit = (i: number, j: number) => void;

// Imports and exports are left out: chunk splitting moves them in every build.
const glue = /^(Import|Export(Named|All))Declaration$/u;
export const side = (ix: Index): Side => {
	const us = ix.units.filter((u) => !glue.test(u.k));
	return {
		us,
		parent: parentsOf(us),
		free: us.map(() => true),
		match: new Int32Array(us.length).fill(-1),
		names: namesOf(ix),
	};
};

export const unitAt = (s: Side, i: number): Unit => {
	const u = s.us[i];
	if (u === undefined) {
		throw new RangeError(`no unit at ${i}`);
	}
	return u;
};
/** The index of the enclosing unit, or -1. */
export const parentOf = (s: Side, i: number): number => s.parent[i] ?? -1;

const fkey = (u: Unit) => `${u.k}|${u.f.join("\n")}`;
const pkey: Key = (s, i) => {
	const p = parentOf(s, i);
	return p < 0 ? undefined : `${unitAt(s, i).k}<${fkey(unitAt(s, p))}`;
};

// A method's text leaves out its name, so the label is in the key. Text with no literals, such as
// `(){return x()}`, is common, so it also needs the same parent.
const textKey: Key = (s, i) => {
	const u = unitAt(s, i);
	const p = parentOf(s, i);
	const t = `${u.k}|${norm(u.t)}`;
	return u.f.length > 0 || p < 0 ? t : `${t}<${fkey(unitAt(s, p))}`;
};

const litKey: Key = (s, i) => {
	const u = unitAt(s, i);
	return u.f.length > 0 ? fkey(u) : undefined;
};

const claim = (a: Side, b: Side, i: number, j: number): void => {
	a.free[i] = false;
	b.free[j] = false;
	a.match[i] = j;
	b.match[j] = i;
};

/** Pairs free units with an equal key, in source order. */
const pair = (a: Side, b: Side, key: Key, hit?: Hit): void => {
	const open = new Map<string, number[]>();
	for (const i of a.us.keys()) {
		const k = a.free[i] === true ? key(a, i) : undefined;
		if (k !== undefined) {
			addTo(open, k, i);
		}
	}
	for (const j of b.us.keys()) {
		const k = b.free[j] === true ? key(b, j) : undefined;
		const i = k === undefined ? undefined : open.get(k)?.shift();
		if (i !== undefined) {
			claim(a, b, i, j);
			hit?.(i, j);
		}
	}
};

/** The index of the parent on side `a`, as the units of `s` see it: its own for `a`, the one its match has for `b`. */
const pairedParent = (a: Side, b: Side, s: Side, i: number): number => {
	const p = parentOf(s, i);
	if (p < 0) {
		return -1;
	}
	return s === a ? p : (b.match[p] ?? -1);
};

// A unit with no literals, such as `isEnabled(){return x()}`, pairs by its label under a paired parent.
const underPair = (a: Side, b: Side, hit: Hit): number => {
	let n = 0;
	pair(
		a,
		b,
		(s, i) => {
			const q = pairedParent(a, b, s, i);
			return q < 0 ? undefined : `${unitAt(s, i).k}<${q}`;
		},
		(i, j) => {
			n++;
			hit(i, j);
		},
	);
	return n;
};

const settle = (a: Side, b: Side, hit: Hit): void => {
	let paired = underPair(a, b, hit);
	while (paired > 0) {
		paired = underPair(a, b, hit);
	}
};

const postings = (a: Side): Map<string, number[]> => {
	const post = new Map<string, number[]>();
	for (const [i, u] of a.us.entries()) {
		if (a.free[i] === true) {
			for (const x of u.f) {
				addTo(post, x, i);
			}
		}
	}
	return post;
};

/** The free unit of `a` that shares most literals with `u` (at least `MIN_OVERLAP` of the larger set), or -1. */
const bestOf = (a: Side, post: Map<string, number[]>, u: Unit): number => {
	const hits = new Map<number, number>();
	for (const x of u.f) {
		const shared = post.get(x) ?? [];
		if (shared.length > COMMON) {
			continue;
		}
		for (const i of shared) {
			if (a.free[i] === true) {
				hits.set(i, (hits.get(i) ?? 0) + 1);
			}
		}
	}
	let best = -1;
	let score = MIN_OVERLAP;
	for (const [i, n] of hits) {
		const r = n / Math.max(u.f.length, unitAt(a, i).f.length);
		if (r >= score) {
			best = i;
			score = r;
		}
	}
	return best;
};

// Literal overlap, through the literals that few units share.
const overlap = (a: Side, b: Side, hit: Hit): void => {
	const post = postings(a);
	for (const [j, u] of b.us.entries()) {
		if (b.free[j] !== true || u.f.length === 0) {
			continue;
		}
		const best = bestOf(a, post, u);
		if (best >= 0) {
			claim(a, b, best, j);
			hit(best, j);
		}
	}
};

/** Matches units by text, then fingerprint, then label and parent, then literal overlap. `hit` hears each pair except those with equal text. */
export const matchUnits = (a: Side, b: Side, hit: Hit): void => {
	pair(a, b, textKey);
	pair(a, b, litKey, hit);
	pair(a, b, pkey, hit);
	settle(a, b, hit);
	overlap(a, b, hit);
	settle(a, b, hit);
};
