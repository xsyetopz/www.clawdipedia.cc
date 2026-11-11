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
import {
	callsOf,
	children,
	constString,
	type Fn,
	functionOf,
	isFn,
	type Module,
	type Node,
	type NodeOf,
} from "../ast.ts";
import { firstSeq } from "../seq.ts";
import {
	type Extractor,
	keyOf,
	prop,
	scan,
	short,
	strings,
	type SurfaceItem,
	unique,
} from "./common.ts";

const TYPES = new Set(["local", "local-jsx", "prompt"]);
const NAME = /^[a-z][\w:-]*$/u;
const builders = new WeakMap<object, string>();

/** How a builder's first parameter `p` names the command: `p.name` for `function(p)`, `e` for `function({name:e})`. */
const nameSource = (p: Node): string | undefined => {
	if (p.type === "Identifier") {
		return `${p.name}.name`;
	}
	if (p.type !== "ObjectPattern") {
		return undefined;
	}
	for (const x of p.properties) {
		if (x.type === "Property" && keyOf(x) === "name") {
			return x.value.type === "Identifier" ? x.value.name : undefined;
		}
	}
	return undefined;
};

/** The type of the first object in `fn` that is `{type:"prompt",name:<nameSrc>,...}`. */
const returnedType = (m: Module, fn: Fn, nameSrc: string): Promise<string> => {
	const stack: Node[] = fn.body ? [fn.body] : [];
	const next = async (): Promise<string> => {
		const n = stack.pop();
		if (!n) {
			return "";
		}
		if (n.type === "ObjectExpression") {
			const type = await constString(m, prop(n, "type"));
			const v = prop(n, "name");
			if (type !== undefined && TYPES.has(type) && v && m.src(v) === nameSrc) {
				return type;
			}
		}
		stack.push(...children(n));
		return next();
	};
	return next();
};

/** The command type a builder gives its argument: its body holds `{type:"prompt",name:p.name,...}` for its first parameter `p`. */
const builderType = async (
	m: Module,
	call: Node,
): Promise<string | undefined> => {
	if (call.type !== "CallExpression") {
		return undefined;
	}
	const f = await functionOf(m, call.callee);
	const p = f?.fn.params[0];
	if (!f || !p) {
		return undefined;
	}
	let found = builders.get(f.fn);
	if (found === undefined) {
		const nameSrc = nameSource(p);
		found =
			nameSrc === undefined ? "" : await returnedType(f.module, f.fn, nameSrc);
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
const factoryType = async (m: Module, n: Node): Promise<string | undefined> => {
	const f = returningFn(m, n);
	const calls = f ? await callsOf(m, f) : [];
	return firstSeq(calls, async (k): Promise<string | undefined> => {
		const outer = k?.module.parent(k.call);
		if (
			k &&
			outer?.type === "CallExpression" &&
			outer.arguments[0] === k.call
		) {
			const built = await builderType(k.module, outer);
			return built;
		}
		return undefined;
	});
};

const gateOf = async (
	m: Module,
	o: NodeOf<"ObjectExpression">,
): Promise<string> => {
	const gates: string[] = [];
	if (/^(!0|true)$/u.test(m.src(prop(o, "isHidden") ?? o).trim())) {
		gates.push("hidden");
	}
	const avail = await strings(m, prop(o, "availability"));
	if (avail) {
		gates.push(`availability ${avail.join(", ")}`);
	}
	const enabled = prop(o, "isEnabled");
	if (enabled) {
		gates.push(`isEnabled ${short(m.src(enabled), 120)}`);
	}
	return gates.join("; ");
};

const typeOf = async (
	m: Module,
	o: NodeOf<"ObjectExpression">,
): Promise<string | undefined> => {
	const parent = m.parent(o);
	return (
		(await constString(m, prop(o, "type"))) ??
		(parent?.type === "CallExpression" && parent.arguments[0] === o
			? builderType(m, parent)
			: factoryType(m, o))
	);
};

export const extractSlashCommands: Extractor = async (bundle) => {
	const out: SurfaceItem[] = [];
	await scan(bundle, ["name:"], async (m, n) => {
		if (n.type !== "ObjectExpression") {
			return;
		}
		const name = await constString(m, prop(n, "name"));
		if (name === undefined || !NAME.test(name)) {
			return;
		}
		const type = await typeOf(m, n);
		if (type === undefined || !TYPES.has(type)) {
			return;
		}
		const desc = (await constString(m, prop(n, "description"))) ?? "";
		const aliases = (await strings(m, prop(n, "aliases"))) ?? [];
		const gate = await gateOf(m, n);
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
