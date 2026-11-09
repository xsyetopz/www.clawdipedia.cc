// Kinds `flag` and `subcommand`: the Commander program of the CLI.
// Anchors (checked on 2.1.309, task 1.1): Commander keeps its method names when minified.
// - `subcommand`: `.command("name [args]")` with a constant string. The full path joins the
//   `.command()` calls of the chain and of the variable it is called on (`mcp add`). `{hidden:!0}` as
//   the second argument marks it hidden. A command built in a function on its parameter gets the
//   path of the argument at the one call of that function (`E(mcp)`, checked on 2.1.321).
// - Hand-parsed commands and their flags come from their help texts (`help.ts`).
// - `flag`: `.option("-d, --debug [filter]","desc")`, `.requiredOption(...)`, and
//   `.addOption(new X("--init","desc"))` (the Option class name is minified, so the anchor is the flag
//   spec as the first argument). The Option may sit in a variable (`let h=new X(...)`), a factory
//   (`s=()=>new X(...)`), or `c?h:h.hideHelp()`. `.hideHelp()` marks it hidden, a conditional one gives
//   `hidden unless <condition>`. Commander's own `this.addOption(r)` resolves to no flag spec.
// Compared with the old `strings` heuristic on 2.1.309 (keys: the long flag, and the last word of a
// subcommand):
// - flag: 303 items (86 hidden; 173 on subcommands). Only here: `--issuer` (`.requiredOption`, which the
//   old regex skips), `--debug-to-stderr` (short form `-d2e` has more than one letter). Only there:
//   `--jq`, a key of the `gh api` flag map (`"-q":"--jq"`), not a flag of this program.
// - subcommand: 71 paths, 56 old names. Only here: `apply-project-settings`, named by a constant
//   (`.command(Hmn,{hidden:!0})`). None only there.
import type * as t from "@babel/types";

import {
	callsOf,
	constString,
	functionOf,
	isFn,
	type Module,
	type Node,
	returnsOf,
} from "../ast.ts";
import {
	asNode,
	type Extractor,
	scan,
	short,
	type SurfaceItem,
	unique,
} from "./common.ts";
import { helpKind } from "./help.ts";

const SPEC = /^(?:-[\w-]+, ?)?--?[a-zA-Z][\w-]*/u;

const method = (n: Node | undefined): string | undefined =>
	n?.type === "CallExpression" &&
	n.callee.type === "MemberExpression" &&
	n.callee.property.type === "Identifier"
		? n.callee.property.name
		: undefined;

/** The initializer of the variable `n` names, when its first declaration is a `let`/`const`/`var`. */
const initOf = (m: Module, n: Node): Node | undefined => {
	const def = m.variable(n)?.defs[0];
	return def?.type === "Variable" ? asNode(def.node.init) : undefined;
};

/** The argument that parameter `p` gets at the one known call of its function (`function E(C){C.command("add")}E(mcp)`). */
const argumentOf = (m: Module, p: Node): { m: Module; n: Node } | undefined => {
	const def = m.variable(p)?.defs[0];
	if (def?.type !== "Parameter" || !isFn(def.node)) {
		return undefined;
	}
	const at = def.node.params.map((x) => asNode(x)).indexOf(def.name);
	const calls = callsOf(m, def.node);
	const call = calls.length === 1 ? calls[0] : undefined;
	const arg = asNode(call?.call.arguments[at]);
	return call && arg ? { m: call.module, n: arg } : undefined;
};

/** The command words of `.command("x")` calls below `n` in its chain, outermost last. */
const chainCommands = (
	m: Module,
	n: Node,
	seen = new Set<unknown>(),
): string[] => {
	const out: string[] = [];
	let cur: Node | undefined = n;
	while (cur) {
		if (
			cur.type === "CallExpression" &&
			cur.callee.type === "MemberExpression"
		) {
			if (method(cur) === "command") {
				const s = constString(m, asNode(cur.arguments[0]));
				if (s !== undefined && s !== "") {
					out.unshift(s.split(/\s/u)[0] ?? "");
				}
			}
			cur = asNode(cur.callee.object);
		} else if (cur.type === "Identifier" && !seen.has(m.variable(cur))) {
			// `let x=program.command("mcp")…; x.command("add")`
			seen.add(m.variable(cur));
			const init = initOf(m, cur);
			const from = init ? { m, n: init } : argumentOf(m, cur);
			return from ? [...chainCommands(from.m, from.n, seen), ...out] : out;
		} else {
			return out;
		}
	}
	return out;
};

/** The calls chained on `call`: `call.a().b()`. */
const chainedAfter = (m: Module, call: Node): string[] => {
	const out: string[] = [];
	let cur = call;
	for (;;) {
		const mem = m.parent(cur);
		const next = mem?.type === "MemberExpression" ? m.parent(mem) : undefined;
		const name = method(next);
		if (!next || name === undefined) {
			return out;
		}
		out.push(name);
		cur = next;
	}
};

/** Does this option expression call `.hideHelp()` in its own chain, or (a variable) in another statement? */
const hides = (m: Module, n: Node, skip?: Node): boolean => {
	if (n.type === "Identifier") {
		const refs = m.variable(n)?.references ?? [];
		return refs.some((r) => {
			const id = r.identifier;
			if (skip && id.start >= skip.start && id.end <= skip.end) {
				return false;
			}
			const p = m.parent(id);
			return (
				p?.type === "MemberExpression" && method(m.parent(p)) === "hideHelp"
			);
		});
	}
	let cur: Node | undefined = n;
	while (
		cur?.type === "CallExpression" &&
		cur.callee.type === "MemberExpression"
	) {
		if (method(cur) === "hideHelp") {
			return true;
		}
		cur = asNode(cur.callee.object);
	}
	return false;
};

/** The `new Option(...)` behind an `addOption` argument: through call chains, `a?b:c`, variables, and factories. */
const optionOf = (
	m: Module,
	n: Node,
	seen = new Set<unknown>(),
): { m: Module; n: Node & t.NewExpression } | undefined => {
	if (seen.has(n)) {
		return undefined;
	}
	seen.add(n);
	const via = (next: t.Node | null | undefined) => {
		const x = asNode(next);
		return x ? optionOf(m, x, seen) : undefined;
	};
	if (n.type === "NewExpression") {
		return { m, n };
	}
	if (n.type === "ConditionalExpression") {
		return via(n.consequent);
	}
	if (n.type === "CallExpression" && n.callee.type === "MemberExpression") {
		return via(n.callee.object);
	}
	if (n.type === "CallExpression") {
		const callee = asNode(n.callee);
		const f = callee && functionOf(m, callee);
		const r = f && returnsOf(f.fn)[0];
		return r ? optionOf(f.module, r, seen) : undefined;
	}
	if (n.type === "Identifier") {
		const init = initOf(m, n);
		return init ? optionOf(m, init, seen) : undefined;
	}
	return undefined;
};

export const extractSubcommands: Extractor = (bundle) => {
	const out: SurfaceItem[] = [];
	scan(bundle, [".command("], (m, n) => {
		if (n.type !== "CallExpression" || method(n) !== "command") {
			return;
		}
		const spec = constString(m, asNode(n.arguments[0]));
		if (spec === undefined || !/^[a-z][\w-]*/u.test(spec)) {
			return;
		}
		const path = chainCommands(m, n).join(" ");
		const args = spec.slice(spec.split(/\s/u)[0]?.length).trim();
		const opts = asNode(n.arguments[1]);
		const hidden =
			opts?.type === "ObjectExpression" &&
			/\bhidden:(!0|true)/u.test(m.src(opts));
		out.push({
			kind: "subcommand",
			name: path,
			module: m.name,
			offset: n.start,
			...(args !== "" && { detail: args }),
			...(hidden && { gate: "hidden" }),
		});
	});
	return unique([...out, ...helpKind(bundle, "subcommand")]);
};

/** The gate of an `addOption` argument: `hidden`, `hidden unless <condition>`, or none. */
const optionGate = (
	m: Module,
	arg: Node,
	o: { m: Module; n: Node },
): string | undefined => {
	if (arg.type === "ConditionalExpression") {
		const alternate = asNode(arg.alternate);
		const consequent = asNode(arg.consequent);
		const test = asNode(arg.test);
		if (
			alternate &&
			consequent &&
			test &&
			hides(m, alternate) &&
			!hides(m, consequent, arg)
		) {
			return `hidden unless ${m.src(test)}`;
		}
	}
	return hides(m, arg) || chainedAfter(o.m, o.n).includes("hideHelp")
		? "hidden"
		: undefined;
};

/** `at` and `args` are in `m`; `owner` (the command chain) is in `om`. */
const addFlag = (
	out: SurfaceItem[],
	m: Module,
	at: Node,
	owner: Node,
	args: readonly (t.Node | null | undefined)[],
	gate?: string,
	om = m,
): void => {
	const spec = constString(m, asNode(args[0]));
	if (spec === undefined || !SPEC.test(spec)) {
		return;
	}
	const name =
		/--[a-zA-Z][\w-]*/u.exec(spec)?.[0] ?? /-[\w-]+/u.exec(spec)?.[0];
	if (name === undefined) {
		return;
	}
	const desc = constString(m, asNode(args[1]));
	const cmd = chainCommands(om, owner).join(" ");
	out.push({
		kind: "flag",
		name: cmd === "" ? name : `${cmd} ${name}`,
		module: m.name,
		offset: at.start,
		detail: short(
			`${spec}${desc !== undefined && desc !== "" ? ` | ${desc}` : ""}`,
		),
		...(gate !== undefined && { gate }),
	});
};

export const extractFlags: Extractor = (bundle) => {
	const out: SurfaceItem[] = [];
	scan(bundle, [".option(", ".requiredOption(", ".addOption("], (m, n) => {
		const name = method(n);
		if (
			n.type !== "CallExpression" ||
			n.callee.type !== "MemberExpression" ||
			name === undefined
		) {
			return;
		}
		const owner = asNode(n.callee.object);
		if (!owner) {
			return;
		}
		if (name === "option" || name === "requiredOption") {
			addFlag(out, m, n, owner, n.arguments);
			return;
		}
		const arg = asNode(n.arguments[0]);
		if (name !== "addOption" || !arg) {
			return;
		}
		const o = optionOf(m, arg);
		if (o) {
			addFlag(out, o.m, o.n, owner, o.n.arguments, optionGate(m, arg, o), m);
		}
	});
	return unique([...out, ...helpKind(bundle, "flag")]);
};
