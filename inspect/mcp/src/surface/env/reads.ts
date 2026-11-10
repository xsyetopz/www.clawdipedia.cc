// Anchors 2 to 5 of kind `env` that one node shows: reads, helpers, names set for a child, and lists.
import {
	children,
	constString,
	type Fn,
	isFn,
	type Module,
	type Node,
	type NodeOf,
} from "../../ast.ts";
import { asNode, keyOf, type Prop } from "../common.ts";
import { isProcessEnv } from "./objects.ts";
import { type Ctx, paramOf, UPPER } from "./shared.ts";

const CHILD = { detail: "set for a child process" };

const nodes = (...xs: (Node | null | undefined)[]): Node[] =>
	xs.flatMap((x) => asNode(x) ?? []);

/** `x.NAME`, `x["NAME"]`, `x[param]` of an env object. */
const member = (c: Ctx, m: Module, n: Node): boolean => {
	if (n.type !== "MemberExpression" || isProcessEnv(n)) {
		return false;
	}
	const obj = asNode(n.object);
	if (!obj || !c.env.is(m, obj)) {
		return false;
	}
	if (!n.computed) {
		if (
			n.property.type === "Identifier" &&
			(isProcessEnv(obj) || UPPER.test(n.property.name))
		) {
			c.add(m, n, n.property.name);
		}
		return true;
	}
	const prop = asNode(n.property);
	const s = constString(m, prop);
	const p = s === undefined && prop ? paramOf(m, prop) : undefined;
	if (s !== undefined) {
		c.add(m, n, s);
	} else if (p) {
		c.helpers.push({ m, ...p });
	}
	return true;
};

/** `"NAME" in x` of an env object. */
const inCheck = (c: Ctx, m: Module, n: Node): boolean => {
	if (n.type !== "BinaryExpression" || n.operator !== "in") {
		return false;
	}
	const right = asNode(n.right);
	if (!right || !c.env.is(m, right)) {
		return false;
	}
	const s = constString(m, asNode(n.left));
	if (s !== undefined) {
		c.add(m, n, s);
	}
	return true;
};

/** `const {NAME}=x` of an env object. */
const destructure = (c: Ctx, m: Module, n: Node): void => {
	const init = n.type === "VariableDeclarator" ? asNode(n.init) : undefined;
	if (n.type !== "VariableDeclarator" || n.id.type !== "ObjectPattern") {
		return;
	}
	if (!init || !c.env.is(m, init)) {
		return;
	}
	for (const p of n.id.properties) {
		const k = p.type === "Property" ? keyOf(p) : undefined;
		if (k !== undefined && k !== "") {
			c.add(m, p, k);
		}
	}
};

const keyName = (m: Module, p: Prop): string | undefined =>
	p.computed ? constString(m, p.key) : keyOf(p);

/** Add the child-env names of an object; return the nodes it spreads. */
const objectNames = (
	c: Ctx,
	m: Module,
	o: NodeOf<"ObjectExpression">,
): Node[] => {
	const spread: Node[] = [];
	for (const p of o.properties) {
		if (p.type === "SpreadElement") {
			spread.push(p.argument);
			continue;
		}
		const k = keyName(m, p);
		if (k !== undefined && UPPER.test(k)) {
			c.add(m, p, k, CHILD);
		}
	}
	return spread;
};

/** The keys of `{...env, NAME:v}`, of an `env:{...}` option, and of objects spread into those. */
const childEnv = (c: Ctx, m: Module, n: NodeOf<"ObjectExpression">): void => {
	const parent = m.parent(n);
	const option =
		parent?.type === "Property" &&
		keyOf(parent) === "env" &&
		parent.value === n;
	if (!option && !c.env.is(m, n)) {
		return;
	}
	const stack: Node[] = [n];
	for (let o = stack.pop(); o; o = stack.pop()) {
		if (o.type === "LogicalExpression") {
			stack.push(...nodes(o.right));
		} else if (o.type === "ConditionalExpression") {
			stack.push(...nodes(o.consequent, o.alternate));
		} else if (o.type === "ObjectExpression") {
			stack.push(...objectNames(c, m, o));
		}
	}
};

/** An object of two or more uppercase keys is a list (anchor 5). */
const objectList = (c: Ctx, m: Module, n: NodeOf<"ObjectExpression">): void => {
	if (n.properties.length < 2) {
		return;
	}
	const names = n.properties.flatMap((p) => {
		const k = p.type === "SpreadElement" ? undefined : keyOf(p);
		return k !== undefined && UPPER.test(k) ? [k] : [];
	});
	if (names.length === n.properties.length) {
		c.lists.push({ m, n, names });
	}
};

/** OpenTelemetry SDK readers (`x.getNumberFromEnv("OTEL_…")`); property names survive minifying. */
const otelReader = (c: Ctx, m: Module, n: Node): void => {
	if (
		n.type !== "CallExpression" ||
		n.callee.type !== "MemberExpression" ||
		n.callee.property.type !== "Identifier" ||
		!/^get\w*FromEnv$/u.test(n.callee.property.name)
	) {
		return;
	}
	const arg = asNode(n.arguments[0]);
	const s = constString(m, arg);
	const p = s === undefined && arg ? paramOf(m, arg) : undefined;
	if (s !== undefined) {
		c.add(m, n, s);
	} else if (p) {
		c.helpers.push({ m, ...p });
	}
};

const enclosingFn = (m: Module, n: Node): Fn | undefined => {
	let fn = m.parent(n);
	while (fn && !isFn(fn)) {
		fn = m.parent(fn);
	}
	return fn;
};

/** The parameters of `fn` that its body compares with `===`. */
const comparedParams = (
	m: Module,
	fn: Fn,
): Omit<Ctx["helpers"][number], "m">[] => {
	const found: Omit<Ctx["helpers"][number], "m">[] = [];
	const stack = nodes(fn.body);
	for (let b = stack.pop(); b; b = stack.pop()) {
		stack.push(...children(b));
		if (b.type === "BinaryExpression" && b.operator === "===") {
			for (const side of nodes(b.left, b.right)) {
				const p = paramOf(m, side);
				if (p?.fn === fn) {
					found.push(p);
				}
			}
		}
	}
	return found;
};

/** `(j)=>Object.entries(process.env).filter(([k])=>k.toUpperCase()===j)`: a helper that matches its parameter against each name. */
const entriesHelper = (c: Ctx, m: Module, n: Node): void => {
	if (
		n.type !== "CallExpression" ||
		n.callee.type !== "MemberExpression" ||
		n.callee.object.type !== "Identifier" ||
		n.callee.object.name !== "Object" ||
		n.callee.property.type !== "Identifier" ||
		!["entries", "keys"].includes(n.callee.property.name)
	) {
		return;
	}
	const arg = asNode(n.arguments[0]);
	if (!arg || !c.env.is(m, arg)) {
		return;
	}
	const fn = enclosingFn(m, n);
	for (const p of fn ? comparedParams(m, fn) : []) {
		c.helpers.push({ m, ...p });
	}
};

const argsOf = (n: Node): (Node | null)[] => {
	if (n.type === "CallExpression") {
		return n.arguments;
	}
	return n.type === "ArrayExpression" ? n.elements : [];
};

/** `"--setenv","NAME",v`: a name set for the sandboxed child (bubblewrap arguments). */
const setenv = (c: Ctx, m: Module, n: Node): void => {
	const args = argsOf(n);
	for (const [i, a] of args.entries()) {
		const at = asNode(a);
		if (at && constString(m, at) === "--setenv") {
			const k = constString(m, asNode(args[i + 1]));
			if (k !== undefined && UPPER.test(k)) {
				c.add(m, at, k, CHILD);
			}
		}
	}
};

/** Spreads and names of other lists may sit among the strings (`["A_B",...x,y,"C_D"]`). */
const arrayList = (c: Ctx, m: Module, n: Node): void => {
	if (n.type !== "ArrayExpression") {
		return;
	}
	const names = n.elements.flatMap((e) => constString(m, asNode(e)) ?? []);
	if (names.length >= 2 && names.every((x) => UPPER.test(x))) {
		c.lists.push({ m, n, names });
	}
};

/** Visit one node for anchors 2 to 5. */
export const readNode = (c: Ctx, m: Module, n: Node): void => {
	if (member(c, m, n) || inCheck(c, m, n)) {
		return;
	}
	destructure(c, m, n);
	if (n.type === "ObjectExpression") {
		childEnv(c, m, n);
		objectList(c, m, n);
	}
	otelReader(c, m, n);
	entriesHelper(c, m, n);
	setenv(c, m, n);
	arrayList(c, m, n);
};
