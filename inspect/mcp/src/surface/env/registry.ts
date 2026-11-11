// Anchor 1 of kind `env`: the typed registry `reg(ns,{NAME:()=>v,...})`.
import type { Bundle, Module, Node, NodeOf } from "../../ast.ts";
import { mapSeq } from "../../seq.ts";
import { asNode, keyOf, type Prop, scanOf, strings } from "../common.ts";
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

const registryType = async (
	m: Module,
	getter: Node,
): Promise<RegistryType | undefined> => {
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
	const values = await strings(m, a0);
	const opts = a0?.type === "ObjectExpression" ? m.src(a0) : "";
	return {
		method: c.property.name,
		detail: `${c.property.name}${opts}`,
		...(values !== undefined && { values }),
	};
};

const namedProps = (
	o: NodeOf<"ObjectExpression">,
): { p: Prop; k: string }[] => {
	const named = o.properties.flatMap((p) => {
		const k = keyOf(p);
		return p.type !== "SpreadElement" && k !== undefined && NAME.test(k)
			? [{ p, k }]
			: [];
	});
	return named.length === o.properties.length ? named : [];
};

/** The names of an object whose getters are mostly typed (`H.bool()`, ...); a constants namespace is not. */
const addRegistry = async (
	m: Module,
	o: NodeOf<"ObjectExpression">,
	add: Add,
): Promise<boolean> => {
	const named = namedProps(o);
	if (named.length < 3) {
		return false;
	}
	const types = await mapSeq(named, ({ p }) => registryType(m, p.value));
	const typed = types.filter((t) => t !== undefined && TYPES.has(t.method));
	if (typed.length * 2 < types.length) {
		return false;
	}
	for (const [i, { p, k }] of named.entries()) {
		const t = types[i];
		add(
			m,
			p,
			k,
			t ? { detail: t.detail, ...(t.values && { values: t.values }) } : {},
		);
	}
	return true;
};

/** Add the names of every env registry in the bundle; return their namespaces. */
export const scanRegistries = async (
	bundle: Bundle,
	add: Add,
): Promise<{ m: Module; v: Variable }[]> => {
	const regs: { m: Module; v: Variable }[] = [];
	await scanOf(bundle, [":()=>"], ["CallExpression"], async (m, n) => {
		if (n.arguments.length !== 2) {
			return;
		}
		const o = n.arguments[1];
		if (o?.type !== "ObjectExpression" || !(await addRegistry(m, o, add))) {
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
