// Shared by resolve.test.ts and resolve-types.test.ts: build a bundle and read what the resolver finds.
import { Bundle, constString, type Fn, returnsOf } from "../src/ast.ts";
import { asNode } from "../src/ast/node.ts";
import { type Entry, mergeEntries, Resolver } from "../src/resolve.ts";

export const str = (key: string, v: string): Entry => ({
	key,
	opt: false,
	val: { k: "str", v },
});
export const unk = (key: string, text: string): Entry => ({
	key,
	opt: false,
	val: { k: "unk", text },
});

/** The bundle of one or more chunks, and a resolver for it. */
export const load = (files: Record<string, string>) => {
	const b = new Bundle(
		Object.entries(files).map(([name, text]) => ({
			name: `/$bunfs/root/${name}`,
			text,
		})),
	);
	return { b, r: new Resolver() };
};

/** The module `a.js` of the bundle, which the files must hold. */
export const moduleA = (files: Record<string, string>) => {
	const { b, r } = load(files);
	const m = b.get("a.js");
	if (m === undefined) {
		throw new Error("no module");
	}
	return { m, r };
};

/** Keys (with `?` when optional) of the object at the last `...id` spread in `src`. */
export const spreadKeys = (
	src: string,
	id: string,
	extra: Record<string, string> = {},
) => {
	const { m, r } = moduleA({ "a.js": src, ...extra });
	const spread = m.at(src.lastIndexOf(`...${id}`), "SpreadElement");
	const arg = asNode(spread?.argument);
	const got = arg && r.expr(m, arg);
	return got?.flatMap((e) => ("key" in e ? [e.key + (e.opt ? "?" : "")] : []));
};

/** The value of the first entry that `mergeEntries` gives for these sites, when it has a key. */
export const mergedVal = (lists: Entry[][]) => {
	const [e] = mergeEntries(lists);
	return e !== undefined && "key" in e ? e.val : undefined;
};

/** The JSON types of the first merged entry. */
export const mergedTypes = (lists: Entry[][]) => {
	const val = mergedVal(lists);
	return val && new Resolver().typeOfVal(val);
};

/** Keys (with `?` when optional) that a spread of `a ?? {...}` gives. */
export const coalesceKeys = (src: string) => {
	const { m, r } = moduleA({ "a.js": src });
	const o = m.at(m.text.indexOf("{..."), "ObjectExpression");
	return (
		o &&
		r
			.spreads(r.entries(m, o))
			.map((e) => ("key" in e ? `${e.key}${e.opt ? "?" : ""}` : ""))
	);
};

/** The keys of the object literal at `{[` in `files["a.js"]`. */
export const computedKeys = (files: Record<string, string>) => {
	const { m, r } = moduleA(files);
	return r
		.objectAt(m, m.text.indexOf("{["))
		.map((e) => ("key" in e ? e.key : ""));
};

/** The constant string of the last name in `src`, or undefined. */
export const lastConst = (src: string) => {
	const { m } = moduleA({ "a.js": src });
	return constString(m, m.nodeAt(m.text.length - 1));
};

/** The key, kind, and string values of each key of the first object literal in `src`. */
export const valsOf = (src: string) => {
	const { m, r } = moduleA({ "a.js": src });
	return r
		.objectAt(m, m.text.indexOf("{"))
		.map((e) => ("key" in e ? [e.key, e.val.k, "v" in e.val && e.val.v] : []));
};

/** The JSON type of each key of the object literal `o={...}`. */
export const types = (src: string, extra: Record<string, string> = {}) => {
	const { m, r } = moduleA({ "a.js": src, ...extra });
	return Object.fromEntries(
		r
			.objectAt(m, src.lastIndexOf("o={") + 2)
			.flatMap((e) => ("key" in e ? [[e.key, r.typeOfVal(e.val)]] : [])),
	);
};

/** The source of each return of the function of `type` that starts at `find`; null for a bare return. */
export const returnSources = (
	src: string,
	find: string,
	type: "FunctionDeclaration" | "ArrowFunctionExpression",
) => {
	const { m } = moduleA({ "a.js": src });
	const fn: Fn | undefined = m.at(m.text.indexOf(find), type);
	return fn && returnsOf(fn).map((n) => (n ? m.src(n) : null));
};
