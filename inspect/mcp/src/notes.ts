// `release` `notes`: marks each release-notes line matched, gated, or unmatched against a code diff (`diff.ts`).
import type { Change, Diff } from "./diff.ts";

export interface NoteLine {
	line: string;
	status: "matched" | "gated" | "unmatched";
	/** the best change, or a `release:diff` report item */
	change?: Change;
	item?: string;
	/** the code spans and words found */
	hits: string[];
}

// Words of 5 letters or more that say what kind of note a line is, not what it is about.
const STOP = new Set(
	"added fixed improved changed which there their about after before being would could should these those where while other through without within instead claude still first every again showing shows error errors their".split(
		" ",
	),
);

/** The notes of a release from its cache file, else from `gh release view`, then cached. */
export const readNotes = async (
	version: string,
	file: string,
): Promise<string> => {
	const cached = Bun.file(file);
	if (await cached.exists()) {
		return cached.text();
	}
	const proc = Bun.spawn(
		[
			"gh",
			"release",
			"view",
			`v${version}`,
			"--repo",
			"anthropics/claude-code",
			"--json",
			"body",
			"-q",
			".body",
		],
		{ stdout: "pipe", stderr: "pipe" },
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(
			`gh release view v${version} failed: ${stderr.slice(0, 200)}`,
		);
	}
	if (stdout.trim() === "") {
		throw new Error(`gh release view v${version} gave no notes`);
	}
	await Bun.write(file, stdout);
	return stdout;
};

const keysOf = (line: string) => {
	// A scope such as "[VSCode]" or "Windows:" says where, not what.
	const text = line.replace(/^\[[^\]]*\]\s*|^[A-Z][a-z]+:\s*/u, "");
	const spans = [...text.matchAll(/`([^`]+)`/gu)]
		.flatMap((x) => (x[1] === undefined ? [] : [x[1]]))
		.filter((x) => x.length >= 3);
	const tokens = text
		.replaceAll(/`[^`]+`/gu, " ")
		.toLowerCase()
		.replaceAll(/'s\b/gu, "")
		.split(/[^a-z]+/u);
	const words = [
		...new Set(tokens.filter((w) => w.length >= 5 && !STOP.has(w))),
	];
	return { spans, words, tokens: new Set(tokens) };
};

const WORDS = 3;
const stringsOf = (c: Change, side: "from" | "to") =>
	[
		...(c[side]?.f ?? []),
		...(c.kind === "changed"
			? []
			: c.calls.map((x) => x.replace(/^\S+ /u, ""))),
	].filter((x) => x.startsWith('"'));

/**
 * Scores a change for a line: each code span in any of its strings counts 2, the subject (its object's `name`) named
 * by the line counts 2, and the words count when 3 or more are in one string it adds or removes.
 */
const scoreChange = (k: ReturnType<typeof keysOf>, c: Change) => {
	const all = [
		...stringsOf(c, "from"),
		...stringsOf(c, "to"),
		...c.calls.map((x) => x.replace(/^\S+ /u, "")),
	];
	const found = k.spans.filter((x) =>
		all.some((t) => t.includes(x.replace(/^\//u, ""))),
	);
	const subject =
		c.subject !== undefined &&
		c.subject !== "" &&
		k.tokens.has(c.subject.toLowerCase())
			? [c.subject]
			: [];
	const a = new Set(stringsOf(c, "from"));
	const b = new Set(stringsOf(c, "to"));
	const changed = [
		...[...a].filter((x) => !b.has(x)),
		...[...b].filter((x) => !a.has(x)),
	];
	let top: string[] = [];
	for (const t of changed) {
		const lower = t.toLowerCase();
		const w = k.words.filter((x) => lower.includes(x));
		if (w.length > top.length) {
			top = w;
		}
	}
	if (top.length < WORDS) {
		top = [];
	}
	return {
		hits: [...found, ...subject, ...top],
		n: (found.length + subject.length) * 2 + top.length,
	};
};

const scoreItem = (k: ReturnType<typeof keysOf>, item: string) => {
	const found = k.spans.filter((x) => item.includes(x));
	const lower = item.toLowerCase();
	const w = k.words.filter((x) => lower.includes(x));
	const top = w.length >= WORDS ? w : [];
	return { hits: [...found, ...top], n: found.length * 2 + top.length };
};

const size = (c: Change) => (c.from?.t.length ?? 0) + (c.to?.t.length ?? 0);

type Target =
	{ kind: "item"; item: string } | { kind: "change"; change: Change };
interface Best {
	n: number;
	hits: string[];
	target?: Target;
}

const bestOf = (
	k: ReturnType<typeof keysOf>,
	d: Diff,
	items: string[],
): Best => {
	let best: Best = { n: 0, hits: [] };
	for (const change of d.changes) {
		const s = scoreChange(k, change);
		const held =
			best.target?.kind === "change" ? best.target.change : undefined;
		if (
			s.n > best.n ||
			(s.n === best.n && s.n > 0 && held && size(change) < size(held))
		) {
			best = { ...s, target: { kind: "change", change } };
		}
	}
	for (const item of items) {
		const s = scoreItem(k, item);
		if (s.n > best.n) {
			best = { ...s, target: { kind: "item", item } };
		}
	}
	return best;
};

const noteOf = (raw: string, d: Diff, items: string[]): NoteLine => {
	const line = raw.slice(2).trim();
	const { n, hits, target } = bestOf(keysOf(line), d, items);
	if (n < 2 || !target) {
		return { line, status: "unmatched", hits: [] };
	}
	if (target.kind === "item") {
		return { line, status: "matched", item: target.item, hits };
	}
	const { change } = target;
	const gated = [
		...(change.from?.f ?? []),
		...(change.to?.f ?? []),
		...change.calls,
	].some((x) => x.includes('"tengu_'));
	return { line, status: gated ? "gated" : "matched", change, hits };
};

/** Marks each `- ` line of the notes against the changes and the report items. */
export const checkNotes = (
	notes: string,
	d: Diff,
	items: string[] = [],
): NoteLine[] =>
	notes
		.split("\n")
		.filter((l) => l.startsWith("- "))
		.map((raw) => noteOf(raw, d, items));
