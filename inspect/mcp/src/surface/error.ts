// Kind `error`: error and warning text a user can see.
// Anchor (checked on 2.1.309, task 1.1): the message (first argument) of `throw Error(…)` and
// `throw new X(…)` (each branch of a `c ? … : …` argument counts), where `X` is Error, TypeError, RangeError, SyntaxError (the global, not a local
// binding), or a class that extends one (the class is found through its binding, followed across imports,
// and through its `extends` chain); and the argument of `process.stderr.write(…)`. A message is a literal,
// a name bound once to a literal, a template, or a `+` concatenation with at least one literal part; `${…}`
// parts and other operands are blanked (short). Factory throws such as `throw dyn("Cloud gateway")` are
// left out, because their argument is not the message. `console.error` is left out, because only bundled
// libraries use it. `detail` is "throw <Class>" or "stderr".
// Filter (design D3): drop texts shorter than 10 characters, with no space, or with no letters, and texts
// inside a bundled CommonJS module (`x((e,n)=>{…n.exports=…})`), which is library code. On 2.1.309 that
// drops 507 of 4529 texts, leaving 4022 (OpenTelemetry protobuf, crypto, XML, CSS selector, JWT). Bundled ES modules have no such wrapper, and no
// module or function marker tells them from app code without losing app texts, so the rest stay.
// The old `strings` heuristic has no error list, so there is nothing to compare.
import {
	constString,
	isFn,
	type Module,
	type Node,
	type NodeOf,
	type Variable,
} from "../ast.ts";
import { mapSeq } from "../seq.ts";
import {
	type Extractor,
	scan,
	short,
	type SurfaceItem,
	unique,
} from "./common.ts";

/** Stands for a part that the code computes (short blanks it again). */
const BLANK = `\${}`;

const BASE = new Set(["Error", "TypeError", "RangeError", "SyntaxError"]);

/** What a variable holds: its class, its initializer, or else its first later write. */
const valueOf = (v: Variable): Node | null | undefined => {
	const def = v.defs[0];
	if (def?.type === "ClassName") {
		return def.node;
	}
	if (def?.type === "Variable" && def.node.init) {
		return def.node.init;
	}
	return v.references.find((r) => r.write && !r.init)?.writeExpr;
};

/** The builtin error that the class `id` names is or extends (`TypeError`), or undefined. */
const errorClass = async (
	m: Module,
	id: Node,
	depth = 0,
): Promise<string | undefined> => {
	if (id.type !== "Identifier" || depth > 8) {
		return undefined;
	}
	const v0 = m.variable(id);
	if (!v0 || v0.defs.length === 0) {
		return BASE.has(id.name) ? id.name : undefined;
	}
	const o = m.bundle
		? await m.bundle.origin(m, v0)
		: { module: m, variable: v0 };
	if (!o) {
		return undefined;
	}
	const cls = valueOf(o.variable);
	if (
		(cls?.type !== "ClassDeclaration" && cls?.type !== "ClassExpression") ||
		!cls.superClass
	) {
		return undefined;
	}
	return errorClass(o.module, cls.superClass, depth + 1);
};

/** The text of a message expression, with unknown parts blanked, or undefined when it holds no literal. */
const text = async (
	m: Module,
	n: Node | undefined,
): Promise<string | undefined> => {
	if (!n) {
		return undefined;
	}
	const s = await constString(m, n);
	if (s !== undefined) {
		return s;
	}
	if (n.type === "TemplateLiteral") {
		return n.quasis
			.map(
				(q, i) =>
					(q.value.cooked ?? q.value.raw) +
					(i < n.expressions.length ? BLANK : ""),
			)
			.join("");
	}
	if (n.type === "BinaryExpression" && n.operator === "+") {
		const l = await text(m, n.left);
		const r = await text(m, n.right);
		if (l === undefined && r === undefined) {
			return undefined;
		}
		return (l ?? BLANK) + (r ?? BLANK);
	}
	return undefined;
};

const keep = (s: string): boolean =>
	s.length >= 10 && s.includes(" ") && /[A-Za-z]/u.test(s);

const cjs = new WeakMap<Node, boolean>();
/** Inside a bundled CommonJS module: `x((e,n)=>{…n.exports=…})`, a function that is a call's only argument. */
const inLibrary = (m: Module, at: Node): boolean => {
	for (let n = m.parent(at); n; n = m.parent(n)) {
		if (!isFn(n)) {
			continue;
		}
		let hit = cjs.get(n);
		if (hit === undefined) {
			const p = m.parent(n);
			const names = n.params.flatMap((x) =>
				x.type === "Identifier" ? [x.name] : [],
			);
			hit =
				p?.type === "CallExpression" &&
				p.arguments.length === 1 &&
				p.arguments[0] === n &&
				names.length === n.params.length &&
				names.length > 0 &&
				names.length <= 2 &&
				names.some((x) => m.src(n).includes(`${x}.exports`));
			cjs.set(n, hit);
		}
		if (hit) {
			return true;
		}
	}
	return false;
};

type Call = NodeOf<"NewExpression" | "CallExpression">;

/** The constructions a throw can raise: both branches of `c ? new A(…) : new B(…)` raise one each. */
const thrown = (a: Node): Call[] => {
	if (a.type === "ConditionalExpression") {
		return [...thrown(a.consequent), ...thrown(a.alternate)];
	}
	return a.type === "NewExpression" || a.type === "CallExpression" ? [a] : [];
};

/** Is `n` a call of `process.stderr.write`? */
const writesStderr = (m: Module, n: Node): boolean => {
	if (
		n.type !== "CallExpression" ||
		n.callee.type !== "MemberExpression" ||
		n.callee.computed ||
		n.callee.property.type !== "Identifier" ||
		n.callee.property.name !== "write"
	) {
		return false;
	}
	return m.src(n.callee.object) === "process.stderr";
};

export const extractErrors: Extractor = async (bundle) => {
	const out: SurfaceItem[] = [];
	const add = async (m: Module, call: Call, detail: string) => {
		const t = await text(m, call.arguments[0]);
		if (t === undefined) {
			return;
		}
		const name = short(t);
		if (keep(name) && !inLibrary(m, call)) {
			out.push({
				kind: "error",
				name,
				module: m.name,
				offset: call.start,
				detail,
			});
		}
	};
	await scan(bundle, ["throw", "stderr"], async (m, n) => {
		if (n.type === "ThrowStatement") {
			await mapSeq(thrown(n.argument), async (call) => {
				const base = await errorClass(m, call.callee);
				if (base !== undefined && base !== "") {
					await add(m, call, `throw ${base}`);
				}
			});
		} else if (n.type === "CallExpression" && writesStderr(m, n)) {
			await add(m, n, "stderr");
		}
	});
	return unique(out);
};
