// Finds the OpenTelemetry events of the program: each call of the event emitter, by event name, with the
// entries of its attributes object. tools/schemas/code.ts and the cc-inspect server both read events here.
import type { Bundle, CallNode, Module, Node } from "./ast.ts";
import { asNode } from "./ast/node.ts";
import type { Entry, Resolver } from "./resolve.ts";

const esc = (id: string) => id.replaceAll("$", String.raw`\$`);

/** Local names under which a module imports `exportName` from the chunk `chunk`. */
export const aliasesOf = (
	src: Module,
	chunk: string,
	exportName: string,
): string[] => {
	const out: string[] = [];
	const re = new RegExp(
		`import\\{([^}]*)\\}from"/\\$bunfs/root/${esc(chunk).replaceAll(".", String.raw`\.`)}"`,
		"gu",
	);
	for (const m of src.text.matchAll(re)) {
		for (const item of m[1]?.split(",") ?? []) {
			const [a, b] = item.trim().split(/\s+as\s+/u);
			if (a === exportName) {
				out.push(b ?? a);
			}
		}
	}
	return out;
};

/** The call whose argument list opens at the `(` at index `open`. */
export const callAt = (src: Module, open: number): CallNode | undefined => {
	for (let n: Node | undefined = src.nodeAt(open); n; n = src.parent(n)) {
		const callee = asNode(n.type === "CallExpression" ? n.callee : undefined);
		if (n.type === "CallExpression" && callee && callee.end <= open) {
			return n;
		}
	}
	return undefined;
};

/** Entries of an argument: an object literal, or the object a name holds. */
export const argEntries = (
	R: Resolver,
	src: Module,
	a: Node | undefined,
): Entry[] | undefined => {
	if (a?.type === "ObjectExpression") {
		return R.entries(src, a);
	}
	if (a?.type === "Identifier") {
		return R.ident(src, a);
	}
	return undefined;
};

/**
 * Every call of the event emitter (`async function f(name, attrs){...{...base(),"event.name":...`), by
 * event name: one list of attribute entries per call site, with spreads pinned.
 */
export const eventSites = (
	bundle: Bundle,
	R: Resolver,
): Map<string, Entry[][]> => {
	const [eSrc, ...more] = bundle.withText('"event.sequence"');
	if (!eSrc || more.length > 0) {
		throw new Error("event emitter module not found");
	}
	const fn =
		/async function ([\w$]+)\([^)]*\)\{[^{}]*\{\.\.\.[\w$]+\(\),"event\.name":/u.exec(
			eSrc.text,
		)?.[1];
	if (fn === undefined) {
		throw new Error("event emitter not found");
	}
	const events = new Map<string, Entry[][]>();
	for (const m of bundle.modules.values()) {
		const names = m === eSrc ? [fn] : aliasesOf(m, eSrc.name, fn);
		for (const nm of names) {
			const re = new RegExp(`(?<![\\w$.])${esc(nm)}\\("([a-z_]+)"`, "gu");
			for (const hit of m.text.matchAll(re)) {
				const name = hit[1];
				if (name === undefined) {
					continue;
				}
				const call = callAt(m, hit.index + nm.length);
				const entries = argEntries(R, m, asNode(call?.arguments[1])) ?? [];
				events.set(name, [...(events.get(name) ?? []), R.pin(entries)]);
			}
		}
	}
	return events;
};
