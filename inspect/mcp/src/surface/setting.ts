import type { Bundle, Module, Node, NodeOf } from "../ast.ts";
// Kind `setting`: the top-level keys of settings.json.
// Anchors (checked on 2.1.309, task 1.1), the same objects that tools/schemas/generate.ts runs:
// 1. The object of zod getters whose `$schema` getter ends in
//    `.describe("JSON Schema reference for Claude Code settings")` (`return{$schema:()=>…,apiKeyHelper:()=>…}`
//    in chunk-0cfgmnxm.js). Each key is a setting; its `.describe("…")` text is the detail.
//    Keys in a conditional spread (`...i.CLAUDE_CODE_ENABLE_XAA&&{xaaIdp:…}`) carry the condition as gate.
// 2. The gated tables `name:{buildGate:()=>…,shape:()=>({key:zod…})}`: each `shape` key is a setting, with
//    the `buildGate` code as its gate (the generator keeps only the tables whose gate is true).
// Compared on 2.1.309 (the old list is the generated schema, not the `strings` heuristic): 194 keys, equal
// to the top-level keys of schemas/claude-code-managed-settings.json. Only here, against
// schemas/claude-code-settings.json (171): 23 keys honored only from managed settings
// (`allowManagedHooksOnly`, `policyHelper`, `requiredMinimumVersion`, ...). None only there.
// Kind `setting-key`: the nested leaf keys under those settings, as dotted paths (`permissions.allow`), with
// `*` for a record key (`extraKnownMarketplaces.*.source.repo`). Checked on 2.1.319: the 196 leaf paths equal the
// nested leaf property paths of schemas/claude-code-managed-settings.json (test/surface/binary.test.ts).
import { mapSeq } from "../seq.ts";
import {
	type Extractor,
	keyOf,
	prop,
	scanOf,
	short,
	type SurfaceItem,
	unique,
} from "./common.ts";
import { describe, item } from "./setting/item.ts";
import { KeyWalk } from "./setting/nested.ts";

const ANCHOR = "JSON Schema reference for Claude Code settings";

interface Top {
	m: Module;
	name: string;
	value: Node;
	offset: number;
	gate?: string;
}

/** The condition and object of a spread `...cond&&{key:…}` or `...cond?{key:…}:{}`: keys behind a condition. */
const conditional = (
	a: Node | undefined,
): { test: Node; obj: NodeOf<"ObjectExpression"> } | undefined => {
	if (a?.type === "LogicalExpression" && a.operator === "&&") {
		return a.right.type === "ObjectExpression"
			? { test: a.left, obj: a.right }
			: undefined;
	}
	return a?.type === "ConditionalExpression" &&
		a.consequent.type === "ObjectExpression"
		? { test: a.test, obj: a.consequent }
		: undefined;
};

const keysOf = (
	m: Module,
	o: NodeOf<"ObjectExpression">,
	out: Top[],
	gate?: string,
): void => {
	for (const p of o.properties) {
		if (p.type === "SpreadElement") {
			const cond = conditional(p.argument);
			if (cond) {
				keysOf(m, cond.obj, out, short(m.src(cond.test), 120));
			}
			continue;
		}
		const k = keyOf(p);
		if (k !== undefined && k !== "") {
			out.push({
				m,
				name: k,
				value: p.value,
				offset: p.start,
				...(gate !== undefined && { gate }),
			});
		}
	}
};

/** Each top-level setting: its key, its zod value, and the gate of its table or spread. */
const topLevel = async (bundle: Bundle): Promise<Top[]> => {
	const out: Top[] = [];
	const needles = [ANCHOR, "buildGate:"];
	await scanOf(bundle, needles, ["ObjectExpression"], async (m, n) => {
		if ((await describe(m, prop(n, "$schema"))) === ANCHOR) {
			keysOf(m, n, out);
			return;
		}
		const gate = prop(n, "buildGate");
		const shape = prop(n, "shape");
		// `shape:()=>({…})`
		const body =
			shape?.type === "ArrowFunctionExpression" ? shape.body : undefined;
		if (gate && body?.type === "ObjectExpression") {
			keysOf(m, body, out, `buildGate ${short(m.src(gate), 120)}`);
		}
	});
	return out;
};

export const extractSettings: Extractor = async (bundle) =>
	unique(
		await mapSeq(await topLevel(bundle), (s) =>
			item("setting", s.m, s.name, s.value, s.offset, s.gate),
		),
	);

export const extractSettingKeys: Extractor = async (bundle) => {
	const out: SurfaceItem[] = [];
	await mapSeq(await topLevel(bundle), (s) =>
		new KeyWalk(out, s.gate).walk(
			{ m: s.m, path: s.name, env: new Map(), depth: 0 },
			s.value,
		),
	);
	// An object key is set through its own keys, so only the leaves are items.
	const all = unique(out);
	const parents = new Set(
		all.flatMap((i) =>
			i.name
				.split(".")
				.map((_, j, a) => a.slice(0, j).join("."))
				.slice(2),
		),
	);
	return all.filter((i) => !parents.has(i.name));
};
