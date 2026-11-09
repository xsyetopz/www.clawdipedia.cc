// Kind `slash-command`: the built-in slash commands.
// Anchor (checked on 2.1.309, task 1.1): an object literal with `type` "local", "local-jsx", or "prompt"
// and a constant `name` (`{type:"local",name:"compact",description:"Free up context…",isEnabled:()=>…}`).
// Also a constant `name` in the object passed to a builder whose body makes such an object from it
// (`M7t({name:"security-review",…})` with `function M7t({name:e}){return{type:"prompt",name:e,…}}`, and
// the bundled-skill registrar `Ui({name:"simplify",…})`). Plugin, skill, and MCP commands build
// `name:e.name` at run time and are not built-in items. `aliases` go into `detail`; `isHidden:!0`,
// `availability:[...]`, and `isEnabled` go into `gate`.
// Compared with the old `strings` heuristic on 2.1.309: 142 commands, 162 old names.
// - Only here (64): commands whose `description` does not follow `name` as a literal (`/init`,
//   `/login`, `/resume`, ...), and the bundled skills (`/simplify`, `/loop`, `/keybindings-help`).
// - Only there (84), none a slash command: computer-use and browser actions (`/left_click`,
//   `/navigate`, `/app_*`), tool names (`/bash`, `/read`, `/grep`), shell completion specs (`/alias`,
//   `/srun`, `/sleep`, `/count`), MCP tools (`/scan_secrets`), mod capability docs (`/cc-plugin-*`),
//   and a template name (`/bg`). Known names absent from both: `/cost` and `/review` are aliases of
//   `/usage` and `/code-review`; `/vim` is not in 2.1.309.
import type * as t from "@babel/types";

import {
	callsOf,
	children,
	constString,
	type Fn,
	functionOf,
	isFn,
	type Module,
	type Node,
} from "../ast.ts";
import {
	asNode,
	type Extractor,
	keyOf,
	prop,
	scan,
	short,
	strings,
	type SurfaceItem,
	unique,
	valueSrc,
} from "./common.ts";

const TYPES = new Set(["local", "local-jsx", "prompt"]);
const NAME = /^[a-z][\w:-]*$/u;
const builders = new WeakMap<object, string>();

/** How a builder's first parameter `p` names the command: `p.name` for `function(p)`, `e` for `function({name:e})`. */
const nameSource = (p: t.Node): string | undefined => {
	if (p.type === "Identifier") {
		return `${p.name}.name`;
	}
	if (p.type !== "ObjectPattern") {
		return undefined;
	}
	const v = p.properties.find(
		(x): x is t.ObjectProperty =>
			x.type === "ObjectProperty" && keyOf(x) === "name",
	)?.value;
	return v?.type === "Identifier" ? v.name : undefined;
};

/** The type of the first object in `fn` that is `{type:"prompt",name:<nameSrc>,...}`. */
const returnedType = (m: Module, fn: Fn, nameSrc: string): string => {
	const stack = [asNode(fn.body)].flatMap((x) => x ?? []);
	for (let n = stack.pop(); n; n = stack.pop()) {
		if (n.type === "ObjectExpression") {
			const type = constString(m, prop(n, "type"));
			const v = prop(n, "name");
			if (type !== undefined && TYPES.has(type) && v && m.src(v) === nameSrc) {
				return type;
			}
		}
		stack.push(...children(n));
	}
	return "";
};

/** The command type a builder gives its argument: its body holds `{type:"prompt",name:p.name,...}` for its first parameter `p`. */
const builderType = (m: Module, call: Node): string | undefined => {
	if (call.type !== "CallExpression") {
		return undefined;
	}
	const f = functionOf(m, asNode(call.callee) ?? call);
	const p = f?.fn.params[0];
	if (!f || !p) {
		return undefined;
	}
	let found = builders.get(f.fn);
	if (found === undefined) {
		const nameSrc = nameSource(p);
		found = nameSrc === undefined ? "" : returnedType(f.module, f.fn, nameSrc);
		builders.set(f.fn, found);
	}
	return found === "" ? undefined : found;
};

/** The function that returns `n`, as `return (…, n)` or as the body `() => n`. */
const returningFn = (m: Module, n: Node): Fn | undefined => {
	let c = n;
	let p = m.parent(c);
	if (p?.type === "SequenceExpression" && p.expressions.at(-1) === c) {
		c = p;
		p = m.parent(c);
	}
	let f = p?.type === "ReturnStatement" ? m.parent(p) : undefined;
	while (f && !isFn(f)) {
		f = m.parent(f);
	}
	if (!f && isFn(p) && p.body === c) {
		f = p;
	}
	return isFn(f) ? f : undefined;
};

/** The builder type of an object a factory returns, for `reg(make())` where `make` ends in `return (…, {name:"x"})`. */
const factoryType = (m: Module, n: Node): string | undefined => {
	const f = returningFn(m, n);
	for (const k of f ? callsOf(m, f) : []) {
		const outer = k?.module.parent(k.call);
		if (
			k &&
			outer?.type === "CallExpression" &&
			outer.arguments[0] === k.call
		) {
			const type = builderType(k.module, outer);
			if (type !== undefined) {
				return type;
			}
		}
	}
	return undefined;
};

const gateOf = (m: Module, o: Node & t.ObjectExpression): string => {
	const gates: string[] = [];
	if (/^(!0|true)$/u.test(m.src(prop(o, "isHidden") ?? o).trim())) {
		gates.push("hidden");
	}
	const avail = strings(m, prop(o, "availability"));
	if (avail) {
		gates.push(`availability ${avail.join(", ")}`);
	}
	const enabled = prop(o, "isEnabled");
	if (enabled) {
		gates.push(`isEnabled ${short(valueSrc(m, enabled), 120)}`);
	}
	return gates.join("; ");
};

const typeOf = (
	m: Module,
	o: Node & t.ObjectExpression,
): string | undefined => {
	const parent = m.parent(o);
	return (
		constString(m, prop(o, "type")) ??
		(parent?.type === "CallExpression" && parent.arguments[0] === o
			? builderType(m, parent)
			: factoryType(m, o))
	);
};

export const extractSlashCommands: Extractor = (bundle) => {
	const out: SurfaceItem[] = [];
	scan(bundle, ["name:"], (m, n) => {
		if (n.type !== "ObjectExpression") {
			return;
		}
		const name = constString(m, prop(n, "name"));
		if (name === undefined || !NAME.test(name)) {
			return;
		}
		const type = typeOf(m, n);
		if (type === undefined || !TYPES.has(type)) {
			return;
		}
		const desc = constString(m, prop(n, "description")) ?? "";
		const aliases = strings(m, prop(n, "aliases")) ?? [];
		const gate = gateOf(m, n);
		const alias = aliases.length > 0 ? ` (aliases ${aliases.join(", ")})` : "";
		out.push({
			kind: "slash-command",
			name: `/${name}`,
			module: m.name,
			offset: n.start,
			detail: short(`${type}${alias}${desc === "" ? "" : ` | ${desc}`}`),
			...(gate !== "" && { gate }),
		});
	});
	return unique(out);
};
