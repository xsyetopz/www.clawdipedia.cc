// The diff of one kind: names added, removed, or changed, and where the docs mention them.
import type { Items } from "./groups.ts";

export interface DocFile {
	file: string;
	text: string;
}

export interface KindDiff {
	kind: string;
	from: string;
	to: string;
	fromCount: number;
	toCount: number;
	added: string[];
	removed: string[];
	changed: { name: string; old: string; new: string }[];
	/** added names that no docs page mentions */
	undocumentedAdded: string[];
	/** removed or changed names that docs pages still mention: name -> files */
	inDocs: Record<string, string[]>;
	/** added and changed names -> the page that takes them, from the coverage map */
	pages: Record<string, string>;
}

/** Search needle used to look a name up in docs text. */
const needle = (name: string): string =>
	name.startsWith("cli:") ? `claude ${name.slice(4)}` : name;

/** A detail with the parts that change on every build blanked: chunk hashes and short minified names. */
const stable = (s = "") =>
	s
		.replaceAll(/chunk-[a-z0-9]{8}/gu, "chunk-_")
		.replaceAll(
			/(?<![\w$])[A-Za-z_$][\w$]{0,2}(?=\(|\.|\)|&|;|\}| \(=|$)/gu,
			"_",
		);

const filesOf = (docs: DocFile[], name: string): string[] => {
	const re = new RegExp(
		`(?<![\\w-])${needle(name).replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}(?![\\w-])`,
		"u",
	);
	return docs.filter((d) => re.test(d.text)).map((d) => d.file);
};

/** Diffs the items of one kind in two versions against the docs text and the page lookup. */
export const diffKind = (
	kind: string,
	from: string,
	to: string,
	a: Items,
	b: Items,
	docs: DocFile[],
	page: (name: string) => string = () => "",
): KindDiff => {
	const added = [...b.keys()].filter((k) => !a.has(k));
	const removed = [...a.keys()].filter((k) => !b.has(k));
	const changed = [...b]
		.filter(([k, v]) => a.has(k) && stable(a.get(k)) !== stable(v))
		.map(([name, v]) => ({ name, old: a.get(name) ?? "", new: v }));
	const undocumentedAdded = added.filter((n) => filesOf(docs, n).length === 0);
	const inDocs: Record<string, string[]> = {};
	for (const n of [...removed, ...changed.map((c) => c.name)]) {
		const f = filesOf(docs, n);
		if (f.length > 0) {
			inDocs[n] = f;
		}
	}
	const pages: Record<string, string> = {};
	for (const n of [...added, ...changed.map((c) => c.name)]) {
		const p = page(n);
		if (p !== "") {
			pages[n] = p;
		}
	}
	return {
		kind,
		from,
		to,
		fromCount: a.size,
		toCount: b.size,
		added,
		removed,
		changed,
		undocumentedAdded,
		inDocs,
		pages,
	};
};
