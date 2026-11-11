// Cleans a minified module into stable text: each declared name gets a name from its scope position, then `bun fmt`.
// Strings, property names, and export names keep their text, so the same code in two builds prints the same.
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";

import type { Module, Node, Variable } from "./ast.ts";

const hash = (s: string, n = 6): string =>
	createHash("sha1").update(s).digest("hex").slice(0, n);

/** The name of a non-module scope's variable: a letter for its depth, then its order (`a1`, `b2`). */
const localName = (depth: number, i: number): string =>
	`${depth <= 26 ? String.fromCodePoint(96 + depth) : `z${depth}_`}${i}`;

/** Each variable that a module declares, with the identifier nodes that name it, in the order that the code declares them. */
const declared = (m: Module): { v: Variable; ids: Node[] }[] =>
	m.variables
		.toSorted(
			(a, b) => (a.identifiers[0]?.start ?? 0) - (b.identifiers[0]?.start ?? 0),
		)
		.map((v) => ({
			v,
			ids: [
				...new Set([
					...v.identifiers,
					...v.references.map((r) => r.identifier),
				]),
			],
		}));

/** The replacement text for one identifier, keeping shorthand keys and export names. */
const spell = (m: Module, id: Node, old: string, name: string): string => {
	const p = m.parent(id);
	if (p?.type === "ExportSpecifier" && p.exported.start === id.start) {
		return `${name} as ${old}`;
	}
	if (p?.type === "ImportSpecifier" && p.imported.start === id.start) {
		return `${old} as ${name}`;
	}
	const prop =
		p?.type === "AssignmentPattern" && p.left === id ? m.parent(p) : p;
	if (prop?.type === "Property" && prop.shorthand) {
		return `${old}:${name}`;
	}
	return name;
};

interface Edit {
	id: Node;
	v: Variable;
}
type NameOf = (v: Variable, id: Node) => string;

// The text from `start` to `end` with each name spelled by `nameOf`; `edits` is sorted by position.
const renderRange = (
	m: Module,
	edits: Edit[],
	start: number,
	end: number,
	nameOf: NameOf,
): string => {
	let out = "";
	let at = start;
	let lo = 0;
	for (let hi = edits.length; lo < hi;) {
		const mid = (lo + hi) >> 1;
		if ((edits[mid]?.id.start ?? Infinity) < start) {
			lo = mid + 1;
		} else {
			hi = mid;
		}
	}
	for (let k = lo; k < edits.length; k++) {
		const e = edits[k];
		if (e === undefined || e.id.start >= end) {
			break;
		}
		const { id, v } = e;
		if (id.end > end || id.start < at) {
			continue;
		}
		out += m.text.slice(at, id.start) + spell(m, id, v.name, nameOf(v, id));
		at = id.end;
	}
	return out + m.text.slice(at, end);
};

// The hash leaves out a class's name inside its own body, as when that name had a scope of its own.
const inside = (v: Variable, id: Node): boolean => {
	const c = v.defs[0]?.node;
	return (
		c?.type === "ClassDeclaration" &&
		id !== v.identifiers[0] &&
		id.start >= c.start &&
		id.end <= c.end
	);
};

// A module-level name comes from its declaration with local names in place and module names
// left out, so it keeps its name when other code moves or the minifier picks other names.
const nameTop = (
	names: Map<Variable, string>,
	top: Variable[],
	render: (start: number, end: number, nameOf: NameOf) => string,
): void => {
	const taken = new Set<string>();
	for (const v of top) {
		const def = v.defs[0]?.node;
		if (def === undefined) {
			continue;
		}
		const text = render(def.start, def.end, (x, id) =>
			inside(x, id) ? "$" : (names.get(x) ?? "$"),
		);
		const base = `$${hash(text)}`;
		let n = base;
		for (let k = 2; taken.has(n); k++) {
			n = `${base}_${k}`;
		}
		taken.add(n);
		names.set(v, n);
	}
};

/** Renders any range of the module with stable names, before formatting. */
export const renamer = (
	m: Module,
): ((start: number, end: number) => string) => {
	const all = declared(m);
	const names = new Map<Variable, string>();
	const count = new Map<Variable["scope"], number>();
	const edits: Edit[] = all
		.flatMap(({ v, ids }) => ids.map((id) => ({ id, v })))
		.toSorted((a, b) => a.id.start - b.id.start);
	const render = (start: number, end: number, nameOf: NameOf) =>
		renderRange(m, edits, start, end, nameOf);
	const top: Variable[] = [];
	for (const { v } of all) {
		const s = v.scope;
		if (s.depth === 0) {
			top.push(v);
			continue;
		}
		const i = (count.get(s) ?? 0) + 1;
		count.set(s, i);
		names.set(v, localName(s.depth, i));
	}
	nameTop(names, top, render);
	return (start, end) => render(start, end, (v) => names.get(v) ?? v.name);
};

/** Bun chunk paths renamed by `chunkNames` (old file name to new). */
export const renameChunks = (
	text: string,
	chunkNames?: Map<string, string>,
): string =>
	chunkNames
		? text.replaceAll(
				/\/\$bunfs\/root\/(chunk-[a-z0-9]+\.js)/gu,
				(_, c: string) => `/$bunfs/root/${chunkNames.get(c) ?? c}`,
			)
		: text;

/** The module text with stable names, before formatting. */
export const renameModule = (
	m: Module,
	chunkNames?: Map<string, string>,
): string => renameChunks(renamer(m)(0, m.text.length), chunkNames);

/** Formats JavaScript with `bun fmt`, run outside any project so no config changes it. */
export const format = async (js: string): Promise<string> => {
	const proc = Bun.spawn(
		[process.execPath, "fmt", "--stdin-filepath=module.js"],
		{
			stdin: new TextEncoder().encode(js),
			stdout: "pipe",
			stderr: "pipe",
			cwd: tmpdir(),
			env: { PATH: process.env["PATH"] ?? "" },
		},
	);
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`bun fmt failed: ${stderr.slice(0, 300)}`);
	}
	return stdout;
};

export const cleanModule = (
	m: Module,
	chunkNames?: Map<string, string>,
): Promise<string> => format(renameModule(m, chunkNames));
