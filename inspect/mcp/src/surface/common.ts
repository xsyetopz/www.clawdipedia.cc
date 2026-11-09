// Shared parts of the surface extractors: the item type, the module scan, and literal readers.
// Each extractor anchors on string literals and object shapes, never on minified names.
import type * as t from "@babel/types";

import {
	type Bundle,
	children,
	constString,
	isLit,
	isMethod,
	litValue,
	type Module,
	type Node,
	valueStart,
} from "../ast.ts";
import { isNode } from "../ast/node.ts";
import type { BunModule } from "../bunfs.ts";

/**
 * One functional surface of the program. `module` and `offset` are null for a text fallback (design D2);
 * `offset` alone is null when the source gives the module but no place (`tool`, `otel-event`).
 */
export interface SurfaceItem {
	kind: string;
	name: string;
	module: string | null;
	offset: number | null;
	/** The literal default, or "unknown" when the code computes it. */
	default?: string;
	/** The literal values it takes (an enum), when the code lists them. */
	values?: string[];
	/** The gate it sits behind, as code text. */
	gate?: string;
	/** A short literal detail: a description, a type, a flag spec. */
	detail?: string;
}

/**
 * `files`: all embedded files of the binary, for kinds that read a non-JavaScript asset (`mod-api`).
 * Reading that asset is async, so an extractor may return a promise.
 */
export type Extractor = (
	bundle: Bundle,
	files?: Pick<BunModule, "name" | "bytes">[],
) => SurfaceItem[] | Promise<SurfaceItem[]>;

/** A Babel node as a node with a position, or undefined for a missing one. */
export const asNode = (n: t.Node | null | undefined): Node | undefined =>
	isNode(n) ? n : undefined;

/** Visit every node of each module whose text holds one of `needles`. */
export const scan = (
	bundle: Bundle,
	needles: string[],
	visit: (m: Module, n: Node) => void,
): void => {
	for (const m of bundle.modules.values()) {
		if (!needles.some((s) => m.text.includes(s))) {
			continue;
		}
		let ast: Node;
		try {
			ast = m.ast;
		} catch {
			// Not JavaScript.
			continue;
		}
		const stack: Node[] = [ast];
		for (let n = stack.pop(); n !== undefined; n = stack.pop()) {
			visit(m, n);
			stack.push(...children(n));
		}
	}
};

/** The key of a non-computed property (identifier or string), or undefined. */
export const keyOf = (
	p: t.ObjectExpression["properties"][number],
): string | undefined => {
	if (p.type === "SpreadElement" || p.computed) {
		return undefined;
	}
	if (p.key.type === "Identifier") {
		return p.key.name;
	}
	if (p.key.type === "StringLiteral") {
		return p.key.value;
	}
	return undefined;
};

/** A property of an object literal: a `key: value` pair, or a method. */
export type Prop = t.ObjectProperty | t.ObjectMethod;

/** What the property holds: the value of a pair, or the function of a method. */
export const propValue = (p: Prop): Node | undefined =>
	asNode(p.type === "ObjectProperty" ? p.value : p);

/** The source of a property value; a method gives its function from the parameters on, without the key. */
export const valueSrc = (m: Module, n: Node): string =>
	isMethod(n) ? m.text.slice(valueStart(m.text, n), n.end) : m.src(n);

/** The value of the property `key` of an object literal. */
export const prop = (o: t.ObjectExpression, key: string): Node | undefined => {
	const found = o.properties.find((p): p is Prop => keyOf(p) === key);
	return found === undefined ? undefined : propValue(found);
};

/** The string items of an array literal, or undefined when one item is not a constant string. */
export const strings = (
	m: Module,
	n: Node | null | undefined,
): string[] | undefined => {
	if (n?.type !== "ArrayExpression") {
		return undefined;
	}
	const out: string[] = [];
	for (const el of n.elements) {
		const s = constString(m, asNode(el));
		if (s === undefined) {
			return undefined;
		}
		out.push(s);
	}
	return out;
};

const FALSY = new Set<unknown>([false, 0, "", null, undefined, 0n]);

/** The text of `!lit` (`!0` is `true`) or `-lit`, or undefined for any other unary expression. */
const unaryLiteral = (n: Node): string | undefined => {
	if (n.type !== "UnaryExpression") {
		return undefined;
	}
	const arg = asNode(n.argument);
	if (arg !== undefined && isLit(arg)) {
		if (n.operator === "!") {
			return String(FALSY.has(litValue(arg)));
		}
		if (n.operator === "-") {
			return `-${String(litValue(arg))}`;
		}
	}
	return n.operator === "void" ? "undefined" : undefined;
};

/** A literal as short text (`!0` is `true`), or "unknown" for computed code. */
export const literal = (m: Module, n: Node | null | undefined): string => {
	if (!n) {
		return "unknown";
	}
	if (isLit(n)) {
		return JSON.stringify(litValue(n));
	}
	const unary = unaryLiteral(n);
	if (unary !== undefined) {
		return unary;
	}
	if (n.type === "Identifier" && n.name === "undefined") {
		return "undefined";
	}
	const s = constString(m, n);
	if (s !== undefined) {
		return JSON.stringify(s);
	}
	if (n.type === "ArrayExpression" || n.type === "ObjectExpression") {
		const text = m.src(n);
		return text.length <= 80 ? text : "unknown";
	}
	return "unknown";
};

/**
 * Keep the first item of each name, and fill its missing fields from later ones; sort by name.
 * `scan` visits modules in bundle order but the nodes of one module last-first, so a repeated name
 * keeps its first module and the last place in that module.
 */
export const unique = (items: SurfaceItem[]): SurfaceItem[] => {
	const by = new Map<string, SurfaceItem>();
	for (const i of items) {
		const prev = by.get(i.name);
		if (prev) {
			for (const k of ["default", "values", "gate", "detail"] as const) {
				if (prev[k] === undefined && i[k] !== undefined) {
					Object.assign(prev, { [k]: i[k] });
				}
			}
		} else {
			by.set(i.name, i);
		}
	}
	return [...by.values()].toSorted((a, b) => {
		if (a.name < b.name) {
			return -1;
		}
		return a.name > b.name ? 1 : 0;
	});
};

/** Cut long text, and blank `${name}` parts, whose minified names change on every build. */
export const short = (s: string, n = 200): string => {
	const t = s
		.replaceAll(/\$\{[^}]*\}/gu, `\${…}`)
		.replaceAll(/\s+/gu, " ")
		.trim();
	return t.length > n ? `${t.slice(0, n)}…` : t;
};
