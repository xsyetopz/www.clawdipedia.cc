// Finds a text of the program in the unpacked source of an npm package (`npm.ts` fetches it).
import { lstat, readdir } from "node:fs/promises";
import { extname, join } from "node:path";

import { isRecord } from "./json.ts";

/** The shortest run of static text that tells one package from another. */
const MIN_STATIC = 8;

const SOURCE = new Set([".js", ".cjs", ".mjs"]);
/** Folders of a package that its code never loads: bundled tooling, examples, and tests. */
const NOT_LIBRARY = new Set([
	".yarn",
	"examples",
	"test",
	"tests",
	"__tests__",
]);
const files = async (dir: string): Promise<string[]> => {
	const names = await readdir(dir);
	const found = await Promise.all(
		names.toSorted().map(async (f) => {
			const p = join(dir, f);
			const s = await lstat(p);
			if (s.isDirectory()) {
				return NOT_LIBRARY.has(f) ? [] : files(p);
			}
			return s.isFile() && SOURCE.has(extname(f)) ? [p] : [];
		}),
	);
	return found.flat();
};

/** Source text as the surface shows its strings: joined `"a" + "b"` pieces, unescaped quotes, and each run of whitespace as one space. */
const plain = (s: string) =>
	s
		.replaceAll(/["'`]\s*\+\s*["'`]/gu, "")
		.replaceAll(/\\(["'`\\])/gu, "$1")
		.replaceAll(/\\[nt]/gu, " ")
		.replaceAll(/\s+/gu, " ");

/** The static pieces of a text: what lies between its `${…}` holes. A trailing `…` is the cut that the surface makes at 200 characters. */
export const fragments = (text: string): string[] =>
	text
		.replace(/…$/u, "")
		.replaceAll(/\s+/gu, " ")
		.split(/\$\{[^}]*\}/u)
		.filter(Boolean);

const sources = new Map<string, Promise<[string, string][]>>();
const readSources = async (dir: string): Promise<[string, string][]> => {
	const paths = await files(dir);
	return Promise.all(
		paths.map(async (f): Promise<[string, string]> => [
			f,
			plain(await Bun.file(f).text()),
		]),
	);
};
const sourcesOf = (dir: string) => {
	let all = sources.get(dir);
	if (!all) {
		all = readSources(dir);
		sources.set(dir, all);
	}
	return all;
};

/** The sentences of the fragments, also cut at long numbers. A bundler folds a constant expression such as `${MAX - 1}` into a number and inlines string constants, so a sentence of the program text can sit anywhere in the library file. */
const pieces = (parts: string[]) =>
	parts
		.flatMap((p) => p.split(/(?<=[.:]) |\d{5,}/u))
		.map((p) => p.trim())
		.filter((p) => p.length >= MIN_STATIC);

/** Each start of `p` in `src` at or after `from`. */
const starts = function* (src: string, p: string, from: number) {
	for (let i = src.indexOf(p, from); i >= 0; i = src.indexOf(p, i + 1)) {
		yield i;
	}
};
const QUOTE = /["'`]/u;

interface Shape {
	head: string;
	mid: string[];
	last: string | undefined;
	open: boolean;
	close: boolean;
}

/** Where the middle fragments end when they follow `at` in order, else undefined. */
const afterMid = (
	src: string,
	mid: string[],
	from: number,
): number | undefined => {
	let at = from;
	for (const p of mid) {
		const j = src.indexOf(p, at);
		if (j === -1) {
			return undefined;
		}
		at = j + p.length;
	}
	return at;
};

const fits = (src: string, { head, mid, last, open, close }: Shape) => {
	for (const i of starts(src, head, 0)) {
		if (open && !QUOTE.test(src[i - 1] ?? "")) {
			continue;
		}
		const at = afterMid(src, mid, i + head.length);
		if (at === undefined) {
			return false;
		}
		if (last === undefined) {
			if (!close || QUOTE.test(src[at] ?? "")) {
				return true;
			}
			continue;
		}
		for (const j of starts(src, last, at)) {
			if (!close || QUOTE.test(src[j + last.length] ?? "")) {
				return true;
			}
		}
	}
	return false;
};

const shapeOf = (text: string, want: string[], whole: boolean): Shape => ({
	head: want[0] ?? "",
	mid: want.slice(1, -1),
	last: want.length > 1 ? want.at(-1) : undefined,
	open: whole && !text.startsWith("${"),
	close: whole && !/[}…]$/u.test(text),
});

/** The first file of the folder (path order) that holds every fragment of the text, in order. Else the first that holds every piece, in any order (`loose`). With `whole`, only a match from a quote to a quote counts (no `loose`): a short text of the program can sit inside a longer library message. */
export const findText = async (
	dir: string,
	text: string,
	whole = false,
): Promise<{
	file?: string;
	fragments: string[];
	short: boolean;
	loose?: true;
}> => {
	const parts = fragments(text);
	const short = parts.join("").length < MIN_STATIC;
	if (short) {
		return { fragments: parts, short };
	}
	const all = await sourcesOf(dir);
	// The join step of `plain` also drops a quoted "+" in the source, so the text goes through it too.
	const want = parts.map((p) => plain(p));
	const shape = shapeOf(text, want, whole);
	const hit = all.find(([, src]) => fits(src, shape));
	if (hit) {
		return { file: hit[0].slice(dir.length + 1), fragments: parts, short };
	}
	const loose = whole ? [] : pieces(want);
	const any =
		loose.length > 1
			? all.find(([, src]) => loose.every((p) => src.includes(p)))
			: undefined;
	return any
		? {
				file: any[0].slice(dir.length + 1),
				fragments: parts,
				short,
				loose: true,
			}
		: { fragments: parts, short };
};

/** The `dependencies` of the unpacked package. */
export const dependenciesOf = async (
	dir: string,
): Promise<Record<string, string>> => {
	const [top] = await readdir(dir);
	if (top === undefined) {
		throw new Error(`${dir} holds no package`);
	}
	const pkg: unknown = JSON.parse(
		await Bun.file(join(dir, top, "package.json")).text(),
	);
	const deps = isRecord(pkg) ? pkg["dependencies"] : undefined;
	const out: Record<string, string> = {};
	for (const [name, range] of Object.entries(isRecord(deps) ? deps : {})) {
		if (typeof range === "string") {
			out[name] = range;
		}
	}
	return out;
};
