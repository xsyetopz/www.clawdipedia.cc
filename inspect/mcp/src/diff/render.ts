// Display of a diff: the changed lines of a unit, and the filter by name.
import type { Change, Diff } from "../diff.ts";

// For matching, names carry no meaning: a local's number moves when an outer scope gains a name, and a module-level or
// chunk name moves when its declaration changes. Literals, property names, and the code's shape stay.
export const norm = (t: string) =>
	t
		.replaceAll(/\$[0-9a-f]{6}(?:_\d+)?/gu, "$")
		.replaceAll(/chunk@[0-9a-f]{8}\.js/gu, "chunk@")
		.replaceAll("...", "…")
		.replaceAll(/(?<![.\w$])([a-z])\d+\b/gu, "$1");

/** Display lines of a unit's one-line cleaned text. */
export const lines = (t: string) =>
	t
		.replaceAll(/([;{}])/gu, "$1\n")
		.split("\n")
		.map((l) => l.trim())
		.filter((l) => l !== "");

const LINE_CHARS = 200;
export const cut = (l: string) =>
	l.length > LINE_CHARS ? `${l.slice(0, LINE_CHARS)}…` : l;

type Op = [string, string];
const MAX_CELLS = 4e6;
const at = (a: ArrayLike<number>, k: number) => a[k] ?? 0;
const str = (a: string[], k: number) => a[k] ?? "";

/** The table of common-subsequence lengths: row `i`, column `j` holds the length for `nx[i..]` and `ny[j..]`. */
const lcsTable = (nx: string[], ny: string[]) => {
	const w = ny.length + 1;
	const dp = new Uint32Array((nx.length + 1) * w);
	for (let i = nx.length - 1; i >= 0; i--) {
		for (let j = ny.length - 1; j >= 0; j--) {
			dp[i * w + j] =
				nx[i] === ny[j]
					? at(dp, (i + 1) * w + j + 1) + 1
					: Math.max(at(dp, (i + 1) * w + j), at(dp, i * w + j + 1));
		}
	}
	return dp;
};

/** The edit script from `x` to `y`, by longest common subsequence of the lines with names ignored. */
const editOps = (x: string[], y: string[]): Op[] => {
	const ops: Op[] = [];
	const nx = x.map((l) => norm(l));
	const ny = y.map((l) => norm(l));
	if (nx.length * ny.length > MAX_CELLS) {
		for (const l of x) {
			ops.push(["-", l]);
		}
		for (const l of y) {
			ops.push(["+", l]);
		}
		return ops;
	}
	const w = ny.length + 1;
	const dp = lcsTable(nx, ny);
	let i = 0;
	let j = 0;
	while (i < nx.length || j < ny.length) {
		if (i < nx.length && j < ny.length && nx[i] === ny[j]) {
			ops.push([" ", str(y, j++)]);
			i++;
		} else if (
			j >= ny.length ||
			(i < nx.length && at(dp, (i + 1) * w + j) >= at(dp, i * w + j + 1))
		) {
			ops.push(["-", str(x, i++)]);
		} else {
			ops.push(["+", str(y, j++)]);
		}
	}
	return ops;
};

/** The changed lines, by longest common subsequence of lines with names ignored, with one line of context, capped. */
export const unitDiff = (c: Change, cap = 40): string[] => {
	const ops = editOps(c.from ? lines(c.from.t) : [], c.to ? lines(c.to.t) : []);
	const near = (k: number) =>
		[k - 1, k, k + 1].some((t) => (ops[t]?.[0] ?? " ") !== " ");
	const out: string[] = [];
	let gap = false;
	for (const [k, [op, l]] of ops.entries()) {
		if (!near(k)) {
			gap = out.length > 0;
			continue;
		}
		if (gap) {
			out.push("  …");
		}
		gap = false;
		out.push(`${op} ${cut(l)}`);
	}
	return out.length > cap
		? [...out.slice(0, cap), `… ${out.length - cap} more lines`]
		: out;
};

/** Keeps the changes whose code, fingerprint, calls, or enclosing names and literals hold `name`. */
export const filterChanges = (d: Diff, name: string): Change[] =>
	d.changes.filter(
		(c) =>
			[c.from, c.to].some(
				(u) =>
					u !== undefined &&
					(u.t.includes(name) || u.f.some((x) => x.includes(name))),
			) || [...c.calls, ...c.within].some((x) => x.includes(name)),
	);
