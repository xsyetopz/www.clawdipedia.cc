// Subcommands and flags that a hand-written help text names. Some subcommands parse their own arguments
// (`self-hosted-runner`, `daemon`, `rm`) or take unknown options past Commander (`remote-control`), so no
// `.command()` or `.option()` call names them.
// Anchors (checked on 2.1.321):
// - A string or template literal with `Usage: claude <path>` or `USAGE\n  claude <path>`. The path is
//   the words up to the first `[`, `<`, `-`, or `${`. When a variable holds the literal and the program
//   joins it with `+` (`rn+(c?a:b)+ln` for `daemon`), the joined text counts, with each part that is
//   not a literal or a name of one left out.
// - A flag is a `--name` in the usage line, or an option line of that text: two or more spaces, then
//   `[-x, ]--name`, its arguments, and its description on the same line or the next one.
// - A parser is a function that compares one string with `--name` literals (`a==="--x"`,
//   `a.startsWith("--x=")`, `case"--x":`). It belongs to the help text that shares half of its flags
//   and at least 3 of them, or 2 in the module of the help text (`daemon`: 2 of 4). With 2 across
//   modules, argv filters such as the resume-flag filter match `remote-control`. Each flag of the
//   parser that the help text leaves out is `hidden`. A `--no-x` counts as named when the help text
//   gives `--[no-]x`.
import {
	type Bundle,
	type Fn,
	isFn,
	type Module,
	type Node,
	strLit,
} from "../ast.ts";
import { asNode, scan, short, type SurfaceItem } from "./common.ts";

const USAGE = /(?:Usage:|USAGE\n)\s*claude ((?:[a-z][\w-]*(?: |$))+)(.*)/u;
const ARG = String.raw`(?:\[?=?<[^>]+>\]?| <[^>]+>| \[[^\]]+\])`;
const OPTION_LINE = new RegExp(
	String.raw`^ {2,}(?:-\w, )?(--(?:\[no-\])?[a-z][\w-]*${ARG}*)(?:, -\w)?(?: +(.*))?$`,
	"u",
);
const USAGE_FLAG = /--[a-z][\w-]*/gu;
const PARSED = /^(--[a-z][\w-]*)=?$/u;

/** The text of a string literal, or of a template literal with `${…}` for each expression. */
const textOf = (n: Node | undefined): string | undefined =>
	n?.type === "TemplateLiteral"
		? n.quasis.map((q) => q.value.cooked ?? q.value.raw).join(`\${…}`)
		: strLit(n);

/** The text of a literal, or of the literal a name is declared with. */
const partText = (m: Module, n: Node): string => {
	const def = n.type === "Identifier" ? m.variable(n)?.defs[0] : undefined;
	const init = def?.type === "Variable" ? asNode(def.node.init) : undefined;
	return textOf(init ?? n) ?? "";
};

/** The parts of a `a+b+c` chain, in order. */
const parts = (n: Node): Node[] => {
	if (n.type !== "BinaryExpression" || n.operator !== "+") {
		return [n];
	}
	const l = asNode(n.left);
	const r = asNode(n.right);
	return [...(l ? parts(l) : []), ...(r ? parts(r) : [])];
};

/** The longest text that a `+` chain makes from the variable that holds literal `n`. */
const joinedText = (m: Module, n: Node, own: string): string => {
	const decl = m.parent(n);
	const id = decl?.type === "VariableDeclarator" ? asNode(decl.id) : undefined;
	let best = own;
	for (const r of (id && m.variable(id)?.references) ?? []) {
		let top: Node = r.identifier;
		for (
			let p = m.parent(top);
			p?.type === "BinaryExpression";
			p = m.parent(top)
		) {
			top = p;
		}
		const text = parts(top)
			.map((x) => partText(m, x))
			.join("");
		best = text.length > best.length ? text : best;
	}
	return best;
};

/** `--x` from a spec such as `--[no-]x <v>`. */
const flagName = (spec: string): string =>
	`--${/^--(?:\[no-\])?([a-z][\w-]*)/u.exec(spec)?.[1] ?? ""}`;

/** The flags of the option lines of a help text, with their descriptions. */
const optionLines = (text: string): Map<string, string> => {
	const lines = text.split("\n");
	const out = new Map<string, string>();
	for (const [i, line] of lines.entries()) {
		const hit = OPTION_LINE.exec(line);
		const spec = hit?.[1];
		if (spec !== undefined) {
			const desc = hit?.[2] ?? lines[i + 1]?.trim() ?? "";
			out.set(flagName(spec), short(`${spec} | ${desc}`));
		}
	}
	return out;
};

interface Help {
	path: string;
	rest: string;
	at: { module: string; offset: number };
	flags: Map<string, string>;
}

/** The help of one literal: its subcommand path, the rest of its usage line, and its flags. */
const helpOf = (m: Module, n: Node, own: string): Help | undefined => {
	const u = USAGE.exec(own);
	const path = u?.[1]?.trim();
	if (path === undefined || path === "") {
		return undefined;
	}
	const rest = u?.[2]?.trim() ?? "";
	const flags = new Map(
		[...rest.matchAll(USAGE_FLAG)].map((f) => [f[0], f[0]] as const),
	);
	for (const [k, v] of optionLines(joinedText(m, n, own))) {
		flags.set(k, v);
	}
	return { path, rest, at: { module: m.name, offset: n.start }, flags };
};

/** The function around `n`. */
const fnOf = (m: Module, n: Node): Fn | undefined => {
	let p = m.parent(n);
	while (p && !isFn(p)) {
		p = m.parent(p);
	}
	return p;
};

/** `--x` when the literal `n` is compared with an argument: `a==="--x"`, `a.startsWith("--x=")`, `case"--x":`. */
const comparedFlag = (m: Module, n: Node): string | undefined => {
	const name = PARSED.exec(strLit(n) ?? "")?.[1];
	const p = m.parent(n);
	const callee = p?.type === "CallExpression" ? asNode(p.callee) : undefined;
	const compared =
		(p?.type === "BinaryExpression" && ["===", "!=="].includes(p.operator)) ||
		(p?.type === "SwitchCase" && p.test === n) ||
		(callee?.type === "MemberExpression" &&
			callee.property.type === "Identifier" &&
			callee.property.name === "startsWith");
	return compared ? name : undefined;
};

interface Parser {
	at: { module: string; offset: number };
	flags: Set<string>;
}

/** Does the help text name `f`, also as the `--no-x` form of a `--[no-]x` option? */
const names = (h: Help, f: string): boolean =>
	h.flags.has(f) ||
	(f.startsWith("--no-") &&
		h.flags.get(`--${f.slice(5)}`)?.startsWith("--[no-]") === true);

/** Adds the flags of each parser that belongs to a help text, as hidden flags of its command. */
const hiddenFlags = (helps: Help[], parsers: Parser[]): SurfaceItem[] => {
	const out: SurfaceItem[] = [];
	for (const p of parsers) {
		const scored = helps.map((h) => ({
			h,
			n: [...p.flags].filter((f) => names(h, f)).length,
		}));
		const best = scored.toSorted((a, b) => b.n - a.n)[0];
		const least = best?.h.at.module === p.at.module ? 2 : 3;
		if (!best || best.n < least || best.n * 2 < p.flags.size) {
			continue;
		}
		for (const f of p.flags) {
			if (!names(best.h, f)) {
				out.push({
					kind: "flag",
					name: `${best.h.path} ${f}`,
					...p.at,
					gate: "hidden",
				});
			}
		}
	}
	return out;
};

/** The subcommands and flags of every help text in the program, and the hidden flags of their parsers. */
const helpItems = async (bundle: Bundle): Promise<SurfaceItem[]> => {
	const helps: Help[] = [];
	await scan(bundle, ["Usage: claude ", "USAGE"], (m, n) => {
		const own = textOf(n);
		const h = own === undefined ? undefined : helpOf(m, n, own);
		if (h) {
			helps.push(h);
		}
	});
	const parsers = new Map<Fn, Parser>();
	await scan(bundle, ['"--'], (m, n) => {
		const flag = comparedFlag(m, n);
		const fn = flag === undefined ? undefined : fnOf(m, n);
		if (flag === undefined || !fn) {
			return;
		}
		const p = parsers.get(fn) ?? {
			at: { module: m.name, offset: fn.start },
			flags: new Set(),
		};
		p.flags.add(flag);
		parsers.set(fn, p);
	});
	return [
		...helps.flatMap((h): SurfaceItem[] => [
			{
				kind: "subcommand",
				name: h.path,
				...h.at,
				...(h.rest !== "" && { detail: short(h.rest) }),
			},
			...[...h.flags].map(([name, detail]) => ({
				kind: "flag",
				name: `${h.path} ${name}`,
				module: h.at.module,
				offset: h.at.offset,
				detail,
			})),
		]),
		...hiddenFlags(helps, [...parsers.values()]),
	];
};

/** The items of one kind from the help texts. */
export const helpKind = async (
	bundle: Bundle,
	kind: "flag" | "subcommand",
): Promise<SurfaceItem[]> => {
	const items = await helpItems(bundle);
	return items.filter((i) => i.kind === kind);
};
