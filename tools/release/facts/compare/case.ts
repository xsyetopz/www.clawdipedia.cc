// The case diff of release:compare: data and samples of one case id in two versions, and the whole result set.
import type { CaseResult, Data } from "../../lib/results.ts";
import {
	IGNORED_DATA,
	invalidDetail,
	isEmpty,
	minus,
	parts,
	PARTS_CAP,
	same,
} from "./data.ts";
import { noiseReason } from "./noise.ts";
import type { CaseDiff, Compare, DataChange } from "./types.ts";

export interface DiffOpts {
	/** case id, to look up NOISY */
	id?: string;
	/** [from, to]: data that differs only by this version string is ignored */
	versions?: [string, string];
	/** receives data -> reason for each ignored data */
	ignored?: Record<string, string>;
}

const changeOf = (
	a: CaseResult,
	b: CaseResult,
	k: string,
	old: Data,
	now: Data,
): DataChange => {
	const change: DataChange = { old, new: now };
	const so = a.samples?.[k];
	const sn = b.samples?.[k];
	if (so !== undefined && sn !== undefined) {
		const [po, pn] = [parts(so), parts(sn)];
		change.added = minus(pn, po).slice(0, PARTS_CAP);
		change.removed = minus(po, pn).slice(0, PARTS_CAP);
	}
	return change;
};

const samplesDiff = (
	a: CaseResult,
	b: CaseResult,
	keep: (k: string) => boolean,
): NonNullable<CaseDiff["samples"]> => {
	const s: NonNullable<CaseDiff["samples"]> = {};
	const keys = new Set([
		...Object.keys(a.samples ?? {}),
		...Object.keys(b.samples ?? {}),
	]);
	for (const k of keys) {
		const o = a.samples?.[k] ?? null;
		const n = b.samples?.[k] ?? null;
		if (keep(k) && o !== n) {
			s[k] = { old: o, new: n };
		}
	}
	return s;
};

export const diffCase = (
	a: CaseResult,
	b: CaseResult,
	withSamples: boolean,
	only?: (key: string) => boolean,
	opts: DiffOpts = {},
): CaseDiff => {
	const keep = (k: string) =>
		!IGNORED_DATA.has(k) && (only === undefined || only(k));
	const d: CaseDiff = { added: {}, removed: {}, changed: {} };
	for (const [k, now] of Object.entries(b.data)) {
		if (!keep(k)) {
			continue;
		}
		const old = a.data[k];
		if (old === undefined) {
			d.added[k] = now;
		} else if (!same(old, now)) {
			const why = noiseReason(opts.id, k, old, now, opts.versions);
			if (why !== null && opts.ignored !== undefined) {
				opts.ignored[k] = why;
			}
			if (why === null) {
				d.changed[k] = changeOf(a, b, k, old, now);
			}
		}
	}
	for (const [k, v] of Object.entries(a.data)) {
		if (keep(k) && !(k in b.data)) {
			d.removed[k] = v;
		}
	}
	if (withSamples) {
		const s = samplesDiff(a, b, keep);
		if (Object.keys(s).length > 0) {
			d.samples = s;
		}
	}
	return d;
};

interface Tally {
	cases: Record<string, CaseDiff>;
	invalidRuns: Record<string, string>;
	noise: Record<string, Record<string, string>>;
	unchanged: number;
}

const tally = (
	from: string,
	to: string,
	am: Map<string, CaseResult>,
	bm: Map<string, CaseResult>,
	withSamples: boolean,
): Tally => {
	const cases: Record<string, CaseDiff> = {};
	const invalidRuns: Record<string, string> = {};
	const noise: Record<string, Record<string, string>> = {};
	let unchanged = 0;
	for (const [id, r] of bm) {
		const o = am.get(id);
		if (o === undefined) {
			continue;
		}
		const bad = invalidDetail(o, r);
		if (bad !== null) {
			invalidRuns[id] = bad;
			continue;
		}
		const ignored: Record<string, string> = {};
		const d = diffCase(o, r, withSamples, undefined, {
			id,
			versions: [from, to],
			ignored,
		});
		if (Object.keys(ignored).length > 0) {
			noise[id] = ignored;
		}
		if (isEmpty(d)) {
			unchanged++;
		} else {
			cases[id] = d;
		}
	}
	return { cases, invalidRuns, noise, unchanged };
};

export const compareResults = (
	from: string,
	to: string,
	a: CaseResult[],
	b: CaseResult[],
	withSamples: boolean,
): Compare => {
	const am = new Map(a.map((r) => [r.id, r]));
	const bm = new Map(b.map((r) => [r.id, r]));
	const { cases, invalidRuns, noise, unchanged } = tally(
		from,
		to,
		am,
		bm,
		withSamples,
	);
	return {
		from,
		to,
		counts: {
			cases: [...bm.keys()].filter((id) => am.has(id)).length,
			changed: Object.keys(cases).length,
			unchanged,
			invalid: Object.keys(invalidRuns).length,
		},
		...(Object.keys(invalidRuns).length > 0 ? { invalidRuns } : {}),
		...(Object.keys(noise).length > 0 ? { noise } : {}),
		onlyFrom: [...am.keys()].filter((id) => !bm.has(id)).toSorted(),
		onlyTo: [...bm.keys()].filter((id) => !am.has(id)).toSorted(),
		cases,
	};
};
