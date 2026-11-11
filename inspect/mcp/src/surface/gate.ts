// Kind `gate`: feature and server gates (`tengu_*` names read from the feature store).
// Anchor (checked on 2.1.309, task 1.1): calls `f("tengu_x", …)`, grouped by the function they call
// (resolved through imports; a member call by its property name, as in `F.read`). The gate readers and
// the event logger share the `tengu_` prefix, so the group decides: a function whose calls mostly pass
// an object with keys other than `safe` is an event logger (`a("tengu_x",{feature_name,…})`); any
// other is a gate reader (`F.read("tengu_x",!1)`, `Jr("tengu_x",{safe:!0})`, `h("tengu_x")`). The
// second argument of a reader call is the default: a literal, or `unknown` when computed. A wrapper that passes its first
// parameter on to a logger (`fo(e){…a(e,{…})}`) is a logger too. Names must match `tengu_[a-z0-9_]*[a-z0-9]`,
// which drops prefixes such as `"tengu_"+x`.
// Compared with the old regex `f("tengu_x",<literal>)` (tools/release/diff/extract.ts, 669 names) on
// 2.1.309: 1101 names, 432 only here, 0 only there. Of the 432, 301 are two-word code names
// (`tengu_calm_eagle`) and 224 have a literal default; the rest are reads with no default or with an
// object option (`*_config`, `*_killswitch`, `*_ms`).
import {
	type CallNode,
	children,
	constString,
	type Fn,
	functionOf,
	type Module,
	type Node,
} from "../ast.ts";
import { mapSeq } from "../seq.ts";
import {
	asNode,
	type Extractor,
	keyOf,
	literal,
	scan,
	type SurfaceItem,
	unique,
} from "./common.ts";

interface Site {
	m: Module;
	n: CallNode;
	name: string;
}

/** A group is the function the calls reach, or `.name` for a member call, or the callee text. */
type Group = Fn | string;

/** An object argument with a key other than `safe`: an event payload. */
const payload = (n: Node | undefined): boolean =>
	n?.type === "ObjectExpression" &&
	n.properties.some((p) => keyOf(p) !== "safe");

const groupOf = async (m: Module, c: Node): Promise<Group> => {
	const found = await functionOf(m, c);
	if (found) {
		return found.fn;
	}
	const prop =
		c.type === "MemberExpression" && c.property.type !== "PrivateIdentifier"
			? c.property
			: undefined;
	return prop ? `.${m.src(prop)}` : m.src(c);
};

/** Does `fn` call a logger with its first parameter `name` as the first argument? */
const forwards = (
	fm: Module,
	fn: Fn,
	name: string,
	loggers: Set<Group>,
): Promise<boolean> => {
	const root = asNode(fn.body);
	const stack: Node[] = root ? [root] : [];
	const next = async (): Promise<boolean> => {
		const n = stack.pop();
		if (n === undefined) {
			return false;
		}
		if (n.type === "CallExpression") {
			const a0 = n.arguments[0];
			const callee = asNode(n.callee);
			const found = callee && (await functionOf(fm, callee));
			const target = found?.fn;
			if (
				a0?.type === "Identifier" &&
				a0.name === name &&
				target !== undefined &&
				loggers.has(target)
			) {
				return true;
			}
		}
		stack.push(...children(n));
		return next();
	};
	return next();
};

/** A wrapper `fo(e){…a(e,{…})…}` that passes its first parameter on to a logger is a logger too. Did one join? */
const growLoggers = async (
	groups: Map<Group, Site[]>,
	loggers: Set<Group>,
): Promise<boolean> => {
	let grew = false;
	await mapSeq(groups, async ([k, sites]) => {
		if (loggers.has(k) || typeof k === "string") {
			return;
		}
		const p = k.params[0];
		const first = sites[0];
		const callee = first && asNode(first.n.callee);
		const found = first && callee && (await functionOf(first.m, callee));
		const fm = found?.module;
		if (
			p?.type === "Identifier" &&
			fm &&
			(await forwards(fm, k, p.name, loggers))
		) {
			loggers.add(k);
			grew = true;
		}
	});
	return grew;
};

const loggersOf = (groups: Map<Group, Site[]>): Set<Group> =>
	new Set(
		[...groups]
			.filter(
				([, s]) =>
					s.filter((x) => payload(asNode(x.n.arguments[1]))).length * 2 >
					s.length,
			)
			.map(([k]) => k),
	);

export const extractGates: Extractor = async (bundle) => {
	const groups = new Map<Group, Site[]>();
	await scan(bundle, ['"tengu_'], async (m, n) => {
		if (n.type !== "CallExpression") {
			return;
		}
		const name = await constString(m, asNode(n.arguments[0]));
		const c = asNode(n.callee);
		if (name === undefined || !c || !/^tengu_[a-z0-9_]*[a-z0-9]$/u.test(name)) {
			return;
		}
		const key = await groupOf(m, c);
		const g = groups.get(key) ?? [];
		g.push({ m, n, name });
		groups.set(key, g);
	});
	const loggers = loggersOf(groups);
	const grow = async (): Promise<void> => {
		if (await growLoggers(groups, loggers)) {
			return grow();
		}
	};
	await grow();
	const out: SurfaceItem[] = [];
	await mapSeq(groups, async ([k, sites]) => {
		if (loggers.has(k)) {
			return;
		}
		await mapSeq(sites, async ({ m, n, name }) => {
			const d = asNode(n.arguments[1]);
			const def =
				d && d.type !== "ObjectExpression" ? await literal(m, d) : undefined;
			out.push({
				kind: "gate",
				name,
				module: m.name,
				offset: n.start,
				...(def !== undefined && { default: def }),
			});
		});
	});
	return unique(out);
};
