// Anchor 1 of kind `env`: the typed registry `reg(ns,{NAME:()=>v,...})`.
import type * as t from "@babel/types";

import type { Bundle, Module, Node } from "../../ast.ts";
import {
	asNode,
	keyOf,
	type Prop,
	propValue,
	scan,
	strings,
} from "../common.ts";
import type { Variable } from "./objects.ts";
import { type Add, NAME } from "./shared.ts";

const TYPES = new Set([
	"bool",
	"triBool",
	"int",
	"num",
	"float",
	"str",
	"enum",
	"list",
	"json",
	"url",
	"path",
]);

interface RegistryType {
	method: string;
	detail: string;
	values?: string[];
}

const registryType = (m: Module, getter: Node): RegistryType | undefined => {
	if (
		getter.type !== "ArrowFunctionExpression" ||
		getter.body.type !== "Identifier"
	) {
		return undefined;
	}
	const body = asNode(getter.body);
	const def = body && m.variable(body)?.defs[0];
	const init = def?.type === "Variable" ? def.node.init : null;
	if (init?.type !== "CallExpression") {
		return undefined;
	}
	const c = init.callee;
	if (c.type !== "MemberExpression" || c.property.type !== "Identifier") {
		return undefined;
	}
	const a0 = asNode(init.arguments[0]);
	const values = strings(m, a0);
	const opts = a0?.type === "ObjectExpression" ? m.src(a0) : "";
	return {
		method: c.property.name,
		detail: `${c.property.name}${opts}`,
		...(values !== undefined && { values }),
	};
};

const namedProps = (o: t.ObjectExpression): { p: Prop; k: string }[] => {
	const named = o.properties.flatMap((p) => {
		const k = keyOf(p);
		return p.type !== "SpreadElement" && k !== undefined && NAME.test(k)
			? [{ p, k }]
			: [];
	});
	return named.length === o.properties.length ? named : [];
};

/** The names of an object whose getters are mostly typed (`H.bool()`, ...); a constants namespace is not. */
const addRegistry = (m: Module, o: t.ObjectExpression, add: Add): boolean => {
	const named = namedProps(o);
	if (named.length < 3) {
		return false;
	}
	const types = named.map(({ p }) => {
		const v = propValue(p);
		return v && registryType(m, v);
	});
	const typed = types.filter((t) => t !== undefined && TYPES.has(t.method));
	if (typed.length * 2 < types.length) {
		return false;
	}
	for (const [i, { p, k }] of named.entries()) {
		const t = types[i];
		const at = asNode(p);
		if (at) {
			add(
				m,
				at,
				k,
				t ? { detail: t.detail, ...(t.values && { values: t.values }) } : {},
			);
		}
	}
	return true;
};

/** Add the names of every env registry in the bundle; return their namespaces. */
export const scanRegistries = (
	bundle: Bundle,
	add: Add,
): { m: Module; v: Variable }[] => {
	const regs: { m: Module; v: Variable }[] = [];
	scan(bundle, [":()=>"], (m, n) => {
		if (n.type !== "CallExpression" || n.arguments.length !== 2) {
			return;
		}
		const o = n.arguments[1];
		if (o?.type !== "ObjectExpression" || !addRegistry(m, o, add)) {
			return;
		}
		const ns = asNode(n.arguments[0]);
		const v = ns?.type === "Identifier" ? m.variable(ns) : undefined;
		if (v) {
			regs.push({ m, v });
		}
	});
	return regs;
};
