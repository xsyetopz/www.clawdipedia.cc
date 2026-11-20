// Transcript lines: keys the program adds to a record after a constructor built it, found from the code alone.
import {
	callsOf,
	type Fn,
	isFn,
	type Node,
} from "../../../inspect/mcp/src/ast.ts";
import type { Module } from "../../../inspect/mcp/src/ast/module.ts";
import { children } from "../../../inspect/mcp/src/ast/node.ts";
import type { Resolver, Val } from "../../../inspect/mcp/src/resolve.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";

/** A write site of the record type: the object literal and the module that holds it. */
export interface Root {
	src: Module;
	obj: Node;
}

type Call = Awaited<ReturnType<typeof callsOf>>[number] & object;

interface Ctor {
	src: Module;
	fn: Fn;
}

const enclosingFn = (m: Module, n: Node): Fn | undefined => {
	for (let x = m.parent(n); x; x = m.parent(x)) {
		if (isFn(x)) {
			return x;
		}
	}
	return undefined;
};

/**
 * The function that returns `n`: `return n`, or the expression body of an arrow function. A value that
 * passes through the last item of a sequence (`return (log(), n)`) or a branch of a condition still counts.
 */
const returnedBy = (m: Module, n: Node): Fn | undefined => {
	let at = n;
	let p = m.parent(at);
	while (
		p &&
		((p.type === "SequenceExpression" && p.expressions.at(-1) === at) ||
			(p.type === "ConditionalExpression" && p.test !== at))
	) {
		at = p;
		p = m.parent(at);
	}
	if (p?.type === "ReturnStatement") {
		return enclosingFn(m, p);
	}
	return isFn(p) && p.type === "ArrowFunctionExpression" && p.body === at
		? p
		: undefined;
};

const walk = (n: Node, visit: (x: Node) => void): void => {
	visit(n);
	for (const c of children(n)) {
		walk(c, visit);
	}
};

/** The name a call's result is stored in: `let x = f()` or `x = f()`. */
const storedAs = (m: Module, call: Node): string | undefined => {
	const p = m.parent(call);
	if (p?.type === "VariableDeclarator" && p.init === call) {
		return p.id.type === "Identifier" ? p.id.name : undefined;
	}
	if (p?.type === "AssignmentExpression" && p.right === call) {
		return p.left.type === "Identifier" ? p.left.name : undefined;
	}
	return undefined;
};

interface State {
	resolver: Resolver;
	found: Map<string, Val>;
	seen: Set<Node>;
	queue: Ctor[];
}

const enqueue = (st: State, src: Module, fn: Fn | undefined): void => {
	if (fn && !st.seen.has(fn)) {
		st.seen.add(fn);
		st.queue.push({ src, fn });
	}
};

const keep = (st: State, key: string, val: Val): void => {
	if (key !== "type" && !st.found.has(key)) {
		st.found.set(key, val);
	}
};

/** The keys of a literal that spreads the call (`{...ctor(a), key: v}`); a function that returns it is a constructor. */
const spreadKeys = async (st: State, c: Call): Promise<void> => {
	const m = c.module;
	const p = m.parent(c.call);
	const obj = p?.type === "SpreadElement" ? m.parent(p) : undefined;
	if (obj?.type !== "ObjectExpression") {
		return;
	}
	for (const e of await st.resolver.entries(m, obj)) {
		if ("key" in e) {
			keep(st, e.key, e.val);
		}
	}
	enqueue(st, m, returnedBy(m, obj));
};

/** The property name of `name.key = value`, or undefined for any other node. */
const assignedKey = (x: Node, name: string): string | undefined =>
	x.type === "AssignmentExpression" &&
	x.left.type === "MemberExpression" &&
	!x.left.computed &&
	x.left.object.type === "Identifier" &&
	x.left.object.name === name &&
	x.left.property.type === "Identifier"
		? x.left.property.name
		: undefined;

const returnsName = (x: Node, name: string): boolean =>
	x.type === "ReturnStatement" &&
	x.argument?.type === "Identifier" &&
	x.argument.name === name;

/** The assignments `name.key = value` in a function, and whether it returns `name`. */
const memberWrites = (
	body: Node,
	name: string,
): { writes: { key: string; right: Node }[]; returned: boolean } => {
	const writes: { key: string; right: Node }[] = [];
	let returned = false;
	walk(body, (x) => {
		const key = assignedKey(x, name);
		if (key !== undefined && x.type === "AssignmentExpression") {
			writes.push({ key, right: x.right });
		}
		returned ||= returnsName(x, name);
	});
	return { writes, returned };
};

/** The keys assigned to the variable that holds the call's result. */
const assignedKeys = async (st: State, c: Call): Promise<void> => {
	const m = c.module;
	const name = storedAs(m, c.call);
	const scope = enclosingFn(m, c.call);
	if (name === undefined || !scope?.body) {
		return;
	}
	const { writes, returned } = memberWrites(scope.body, name);
	if (returned) {
		enqueue(st, m, scope);
	}
	await mapSeq(writes, async (w) => {
		keep(st, w.key, await st.resolver.value(m, w.right));
	});
};

const visitCall = async (st: State, c: Call | undefined): Promise<void> => {
	if (!c) {
		return;
	}
	enqueue(st, c.module, returnedBy(c.module, c.call));
	await spreadKeys(st, c);
	await assignedKeys(st, c);
};

const drain = async (st: State): Promise<void> => {
	const next = st.queue.shift();
	if (!next) {
		return;
	}
	await mapSeq(await callsOf(next.src, next.fn), (c) => visitCall(st, c));
	await drain(st);
};

/**
 * Keys the program adds to a record after a constructor builds it, with the value of each. A constructor is a
 * function that returns a root literal, a call to a constructor, or a variable that holds the result of a call
 * to one. A key counts when it is written at a call of a constructor: a literal that spreads the call and adds
 * the key (`{...ctor(a), key: v}`), or an assignment to the variable that holds the result (`x = ctor(a); x.key = v`).
 * A key of an object the code does not tie to a constructor never counts.
 */
export const addedKeys = async (
	resolver: Resolver,
	roots: readonly Root[],
): Promise<Map<string, Val>> => {
	const st: State = {
		resolver,
		found: new Map(),
		seen: new Set(),
		queue: [],
	};
	for (const r of roots) {
		enqueue(st, r.src, returnedBy(r.src, r.obj));
	}
	await drain(st);
	return st.found;
};
