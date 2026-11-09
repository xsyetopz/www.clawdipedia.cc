// Lists the built-in tools of the program: the array that `getAllBaseTools` returns, with the code that
// gates each entry (`c?[T]:[]`, `[A,B].filter(f)`) and the source of the functions that code calls.

import type * as t from "@babel/types";

import {
	type Bundle,
	type CallNode,
	children,
	functionOf,
	type Module,
	type Node,
	returnsOf,
} from "./ast.ts";
import { asNode } from "./ast/node.ts";
import type { Resolver } from "./resolve.ts";
import {
	at,
	calleeFn,
	initOf,
	isNull,
	required,
	toolName,
} from "./toolvalue.ts";

export interface Tool {
	name: string;
	when: string[];
	/** The source of the tool's own `isEnabled`, when its definition has one. */
	enabled?: string;
	unresolved?: true;
}
interface Cond {
	m: Module;
	n: Node;
	text: string;
}
type Out = { tool: Tool; conds: Cond[] }[];

const MAX_FN = 300;
const clip = (s: string) => (s.length > MAX_FN ? `${s.slice(0, MAX_FN)}…` : s);

const add = (out: Out, when: Cond[], tool: Tool): void => {
	out.push({
		tool: { ...tool, when: when.map((c) => c.text) },
		conds: when,
	});
};

const toolItem = (
	R: Resolver,
	m: Module,
	e: Node,
	when: Cond[],
	out: Out,
): void => {
	const found = toolName(R, m, e);
	if (!found) {
		add(out, when, { name: m.src(e), when: [], unresolved: true });
		return;
	}
	if (!found.enabled) {
		add(out, when, { name: found.name, when: [] });
		return;
	}
	const src = found.enabled.m.src(found.enabled.n);
	out.push({
		tool: {
			name: found.name,
			when: when.map((c) => c.text),
			enabled: clip(src),
		},
		conds: [...when, { ...found.enabled, text: src }],
	});
};

const listItems = (
	R: Resolver,
	m: Module,
	n: Node & t.ArrayExpression,
	when: Cond[],
	out: Out,
	depth: number,
): void => {
	for (const el of n.elements) {
		const e = asNode(el);
		if (e === undefined) {
			continue;
		}
		const spread = e.type === "SpreadElement" ? at(e.argument) : undefined;
		if (spread) {
			items(R, m, spread, when, out, depth + 1);
		} else if (!isNull(m, e)) {
			toolItem(R, m, e, when, out);
		}
	}
};

const branches = (
	R: Resolver,
	m: Module,
	n: Node & t.ConditionalExpression,
	when: Cond[],
	out: Out,
	depth: number,
): void => {
	const test = at(n.test);
	if (isNull(m, test)) {
		items(R, m, at(n.alternate), when, out, depth + 1);
		return;
	}
	const i = test.type === "Identifier" ? initOf(m, test) : undefined;
	const text = i ? `${m.src(test)} (=${i.m.src(i.n)})` : m.src(test);
	const site = i ?? { m, n: test };
	items(R, m, at(n.consequent), [...when, { ...site, text }], out, depth + 1);
	items(
		R,
		m,
		at(n.alternate),
		[...when, { ...site, text: `!(${text})` }],
		out,
		depth + 1,
	);
};

/** Handles a call that gives tools: `list.filter(f)`, a null `x?.()`, or a function that returns them. False when it is none of these. */
const callItems = (
	R: Resolver,
	m: Module,
	n: CallNode,
	when: Cond[],
	out: Out,
	depth: number,
): boolean => {
	const c = at(n.callee);
	const arg = asNode(n.arguments[0]);
	if (
		c.type === "MemberExpression" &&
		c.property.type === "Identifier" &&
		c.property.name === "filter" &&
		arg
	) {
		const cond = { m, n: arg, text: m.src(arg) };
		items(R, m, at(c.object), [...when, cond], out, depth + 1);
		return true;
	}
	// `x?.()` with `x=null` gives no tool.
	if ("optional" in n && n.optional === true && isNull(m, c)) {
		return true;
	}
	const f = calleeFn(m, n);
	if (!f) {
		return false;
	}
	for (const ret of returnsOf(f.fn)) {
		if (ret !== null && !isNull(f.module, ret)) {
			items(R, f.module, ret, when, out, depth + 1);
		}
	}
	return true;
};

/** The expressions that hold the tools of `n`: each side of `a ?? b`, the value of a name, or the export of a chunk. */
const partsOf = (
	m: Module,
	n: Node,
	r: ReturnType<typeof required>,
): { m: Module; n: Node }[] => {
	if (n.type === "LogicalExpression") {
		return [
			{ m, n: at(n.left) },
			{ m, n: at(n.right) },
		];
	}
	const i = n.type === "Identifier" ? initOf(m, n) : undefined;
	if (i) {
		return [i];
	}
	return r !== undefined && typeof r !== "string" ? [r] : [];
};

/** Each tool of an expression that gives a list of tools, with the conditions it is under. */
const items = (
	R: Resolver,
	m: Module,
	n: Node,
	when: Cond[],
	out: Out,
	depth = 0,
): void => {
	if (depth > 8) {
		add(out, when, { name: `...${m.src(n)}`, when: [], unresolved: true });
		return;
	}
	if (n.type === "ArrayExpression") {
		listItems(R, m, n, when, out, depth);
		return;
	}
	if (n.type === "ConditionalExpression") {
		branches(R, m, n, when, out, depth);
		return;
	}
	if (n.type === "CallExpression" && callItems(R, m, n, when, out, depth)) {
		return;
	}
	if (n.type === "Identifier" && isNull(m, n)) {
		return;
	}
	// `a ?? b`, `a || b`: the tools of each part. A name or an import: its value.
	const r = required(m, n);
	const next = partsOf(m, n, r);
	for (const x of next) {
		items(R, x.m, x.n, when, out, depth + 1);
	}
	if (next.length === 0) {
		add(out, when, {
			name: `...${typeof r === "string" ? r : m.src(n)}`,
			when: [],
			unresolved: true,
		});
	}
};

/** A call `f()`, or a function named as a value: `isEnabled:f`. */
const calleeOf = (x: Node, root: Node) => {
	if (x.type === "CallExpression") {
		return x.callee;
	}
	return x.type === "ObjectProperty" && x === root ? x.value : undefined;
};

/** The functions that code calls, and the functions those call, `depth` levels down: name to source. */
const calledFns = (
	m: Module,
	n: Node,
	out: Map<string, string>,
	depth = 2,
): void => {
	const stack = [n];
	for (let x = stack.pop(); x !== undefined; x = stack.pop()) {
		stack.push(...children(x));
		const id = asNode(calleeOf(x, n));
		if (id?.type !== "Identifier" || out.has(id.name)) {
			continue;
		}
		const f = functionOf(m, id);
		if (!f) {
			continue;
		}
		out.set(id.name, clip(f.module.src(f.fn)));
		if (depth > 1) {
			calledFns(f.module, at(f.fn.body), out, depth - 1);
		}
	}
};

const KEY = "getAllBaseTools:";
const baseFn = (bundle: Bundle) =>
	bundle
		.withText(KEY)
		.map((m) => {
			const hit = /getAllBaseTools:[\w$]/u.exec(m.text);
			return hit === null
				? undefined
				: functionOf(m, m.nodeAt(hit.index + KEY.length));
		})
		.find((f) => f !== undefined);

/** The built-in tools `getAllBaseTools` returns, and the source of the functions their conditions call. */
export const baseTools = (
	bundle: Bundle,
	R: Resolver,
): { module: string; tools: Tool[]; functions: Record<string, string> } => {
	const f = baseFn(bundle);
	if (!f) {
		throw new Error("no getAllBaseTools function found");
	}
	const out: Out = [];
	for (const ret of returnsOf(f.fn)) {
		if (ret !== null) {
			items(R, f.module, ret, [], out);
		}
	}
	const fns = new Map<string, string>();
	for (const { conds } of out) {
		for (const c of conds) {
			calledFns(c.m, c.n, fns);
		}
	}
	return {
		module: f.module.name,
		tools: out.map((o) => o.tool),
		functions: Object.fromEntries(fns),
	};
};
