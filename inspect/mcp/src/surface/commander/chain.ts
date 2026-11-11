// The command path of a Commander call chain: the `.command("x")` words of the chain and of the variable it is called on.
import {
	callsOf,
	constString,
	isFn,
	type Module,
	type Node,
} from "../../ast.ts";
import { asNode } from "../common.ts";

/** The method name of a call `x.name(...)`. */
export const method = (n: Node | undefined): string | undefined =>
	n?.type === "CallExpression" &&
	n.callee.type === "MemberExpression" &&
	n.callee.property.type === "Identifier"
		? n.callee.property.name
		: undefined;

/** The initializer of the variable `n` names, when its first declaration is a `let`/`const`/`var`. */
export const initOf = (m: Module, n: Node): Node | undefined => {
	const def = m.variable(n)?.defs[0];
	return def?.type === "Variable" ? asNode(def.node.init) : undefined;
};

/** The argument that parameter `p` gets at the one known call of its function (`function E(C){C.command("add")}E(mcp)`). */
const argumentOf = async (
	m: Module,
	p: Node,
): Promise<{ m: Module; n: Node } | undefined> => {
	const def = m.variable(p)?.defs[0];
	if (def?.type !== "Parameter" || !isFn(def.node)) {
		return undefined;
	}
	const at = def.node.params.map((x) => asNode(x)).indexOf(def.name);
	const calls = await callsOf(m, def.node);
	const call = calls.length === 1 ? calls[0] : undefined;
	const arg = asNode(call?.call.arguments[at]);
	return call && arg ? { m: call.module, n: arg } : undefined;
};

/** The command words of `.command("x")` calls below `n` in its chain, outermost last. */
const chainCommands = (
	m: Module,
	n: Node,
	seen = new Set<unknown>(),
): Promise<string[]> => {
	const out: string[] = [];
	const walk = async (cur: Node | undefined): Promise<string[]> => {
		if (!cur) {
			return out;
		}
		if (
			cur.type === "CallExpression" &&
			cur.callee.type === "MemberExpression"
		) {
			if (method(cur) === "command") {
				const s = await constString(m, asNode(cur.arguments[0]));
				if (s !== undefined && s !== "") {
					out.unshift(s.split(/\s/u)[0] ?? "");
				}
			}
			return walk(asNode(cur.callee.object));
		}
		if (cur.type === "Identifier" && !seen.has(m.variable(cur))) {
			// `let x=program.command("mcp")…; x.command("add")`
			seen.add(m.variable(cur));
			const init = initOf(m, cur);
			const from = init ? { m, n: init } : await argumentOf(m, cur);
			return from
				? [...(await chainCommands(from.m, from.n, seen)), ...out]
				: out;
		}
		return out;
	};
	return walk(n);
};

/** The command path of the chain below `n`, such as `mcp add`. */
export const commandPath = async (m: Module, n: Node): Promise<string> => {
	const words = await chainCommands(m, n);
	return words.join(" ");
};
