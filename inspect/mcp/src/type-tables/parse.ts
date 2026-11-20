// Reads declarations and their members from the type file the program embeds (schemas/claude-code.d.ts).
import {
	blockEnd,
	type Decl,
	declarations
} from "../../../../plugin/mcp/src/types.ts";

/** One member of an object type, as the type file writes it. */
export interface TypeField {
	name: string;
	optional: boolean;
	type: string;
	doc: string;
	/** True for a member of a base type (`Base & {...}`), which a table may leave out. */
	inherited?: boolean;
	/** The line of the key and the last line of the member, in the type file. */
	line: number;
	end: number;
}

/** The type file, split once: its lines and its declarations. */
export interface TypeFile {
	lines: string[];
	decls: Decl[];
}

// A key as written: bare, quoted, or the key of a mapped type such as `[P in RenderSurface]`.
const KEY =
	/^(\s*)(?:readonly )?(['"]?)([\w$.-]+|\[[\w$]+ in [\w$]+\])\2(\??)\s*([:(<])/u;

/** The text of the doc comment that ends on the line before `at`, without the stars. */
const docBefore = (lines: string[], at: number): string => {
	let i = at - 1;
	if (!(lines[i] ?? "").trim().endsWith("*/")) {
		return "";
	}
	const out: string[] = [];
	while (i >= 0) {
		const t = (lines[i] ?? "").trim();
		out.unshift(t.replaceAll(/^\/\*\*\s?|\s?\*\/$|^\*\s?/gu, ""));
		if (t.startsWith("/**")) {
			break;
		}
		i--;
	}
	return out.join(" ").replaceAll(/\s+/gu, " ").trim();
};

/** `,` between the members of an object type becomes `;`, the separator the type file writes. */
const semicolons = (t: string): string => {
	const stack: string[] = [];
	let out = "";
	for (const ch of t) {
		if ("{[(<".includes(ch)) {
			stack.push(ch);
		} else if ("}])>".includes(ch) && !(ch === ">" && stack.at(-1) !== "<")) {
			stack.pop();
		}
		out += ch === "," && stack.at(-1) === "{" ? ";" : ch;
	}
	return out;
};

/** One-line form of a type text: single spaces, no space inside brackets, `;` between members, no trailing `;`. */
export const normalizeType = (t: string): string =>
	semicolons(
		t
			.replaceAll(/\/\*[\s\S]*?\*\//gu, "")
			.replaceAll(/\s+/gu, " ")
			.replaceAll('"', "'")
	)
		.replaceAll(/([({[<]) /gu, "$1")
		.replaceAll(/ ([)}\]>])/gu, "$1")
		.replaceAll(/;([}\]])/gu, "$1")
		.trim()
		.replace(/[;,]$/u, "")
		.trim();

/** Splits the text of the type file. */
export const typeFile = (src: string): TypeFile => {
	const lines = src.split("\n");
	return { lines, decls: declarations(lines) };
};

/** The members one level inside lines `from` (exclusive) to `to` (exclusive): every variant of a union. */
const membersIn = (lines: string[], from: number, to: number): TypeField[] => {
	const out: TypeField[] = [];
	let indent = -1;
	let inDoc = false;
	for (let n = from + 1; n < to; n++) {
		const line = lines[n] ?? "";
		const t = line.trim();
		if (inDoc || t.startsWith("/*")) {
			inDoc = !t.endsWith("*/");
			continue;
		}
		const k = KEY.exec(line);
		if (!k) {
			continue;
		}
		const ind = (k[1] ?? "").length;
		if (indent < 0) {
			indent = ind;
		}
		if (ind !== indent) {
			continue;
		}
		const e = blockEnd(lines, n);
		const body = [line.slice(k[0].length - 1), ...lines.slice(n + 1, e + 1)]
			.join("\n")
			.replace(/^:/u, "");
		out.push({
			name: k[3] ?? "",
			optional: k[4] === "?",
			type: normalizeType(body),
			doc: docBefore(lines, n),
			line: n,
			end: e
		});
		n = e;
	}
	return out;
};

/** The head line of declaration `name` and the declaration, or undefined when the file has none. */
const headOf = (
	f: TypeFile,
	name: string
): { line: number; decl: Decl } | undefined => {
	const decl = f.decls.find((d) => d.name === name);
	if (!decl) {
		return undefined;
	}
	const head = new RegExp(`\\b(?:type|interface) ${name}\\b`, "u");
	let i = decl.start;
	while (i < decl.end && !head.test(f.lines[i] ?? "")) {
		i++;
	}
	return { line: i, decl };
};

// `Base & {` at the start of a type: the members of `Base` count as the members of the type.
const BASES = /^((?:[\w$]+ & )+)\{/u;

const withBases = (
	f: TypeFile,
	text: string,
	own: TypeField[]
): TypeField[] => {
	const b = BASES.exec(text)?.[1];
	if (b === undefined) {
		return own;
	}
	const out: TypeField[] = [];
	for (const name of b.split(" & ").filter(Boolean)) {
		for (const m of typeFields(f, name) ?? []) {
			out.push({ ...m, inherited: true });
		}
	}
	return [...out, ...own];
};

/** The members of declaration `name`, or undefined when the file has none. */
export const typeFields = (
	f: TypeFile,
	name: string
): TypeField[] | undefined => {
	const h = headOf(f, name);
	if (!h) {
		return undefined;
	}
	const own = membersIn(f.lines, h.line, h.decl.end);
	const text = (f.lines[h.line] ?? "").replace(/^.*?= /u, "");
	return withBases(f, text, own);
};

/** The members of a member whose type is an object type (or `Base & {...}`), from the type file's lines. */
export const nested = (f: TypeFile, m: TypeField): TypeField[] =>
	m.end > m.line
		? withBases(f, m.type, membersIn(f.lines, m.line, m.end + 1))
		: [];

/** The doc comment of declaration `name`. */
export const headDoc = (f: TypeFile, name: string): string => {
	const h = headOf(f, name);
	return h ? docBefore(f.lines, h.line) : "";
};

const angleStep = (ch: string | undefined): number => {
	if (ch === "<") {
		return 1;
	}
	return ch === ">" ? -1 : 0;
};

/** The index after the `<…>` that starts at `i`: a default such as `= RenderSurface` sits inside it. */
const skipTypeParams = (body: string, start: number): number => {
	if (body[start] !== "<") {
		return start;
	}
	let depth = 0;
	for (let i = start; i < body.length; i++) {
		depth += angleStep(body[i]);
		if (depth === 0) {
			return i + 1;
		}
	}
	return body.length;
};

/** The type text of declaration `name` after its `=` (and after its type parameters), one line. */
export const aliasOf = (f: TypeFile, name: string): string | undefined => {
	const h = headOf(f, name);
	if (!h) {
		return undefined;
	}
	const body = f.lines.slice(h.line, h.decl.end + 1).join("\n");
	const at = body.search(new RegExp(`\\btype ${name}\\b`, "u"));
	if (at === -1) {
		return undefined;
	}
	const i = skipTypeParams(body, at + `type ${name}`.length);
	const m = /^\s*=\s*/u.exec(body.slice(i));
	return m ? normalizeType(body.slice(i + m[0].length)) : undefined;
};
