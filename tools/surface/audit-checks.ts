// The checks of one kind of item each: internal errors, endpoints, tools, settings, flags, slash commands, and gates.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { isFn, type Module, type Node } from "../../inspect/mcp/src/ast.ts";
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import { libCheck } from "./audit-libcheck.ts";
import { allText, type Ctx, reEscape, type Verdict } from "./audit-types.ts";

const fnAround = (m: Module, offset: number): Node | undefined => {
	for (let n: Node | undefined = m.nodeAt(offset); n; n = m.parent(n)) {
		if (isFn(n)) {
			return n;
		}
	}
	return undefined;
};

const namesOfKind = (c: Ctx, kind: string) =>
	new Set(
		[...c.items.keys()]
			.filter((k) => k.startsWith(`${kind}:`))
			.map((k) => k.slice(kind.length + 1)),
	);

/** The module of the read site of an item, when it has one. */
const moduleOf = (c: Ctx, i: SurfaceItem) =>
	i.module !== null && i.offset !== null ? c.bundle.get(i.module) : undefined;

/** The check of an error text that has no library to name: neither a library, nor a function that reads the environment, nor a name of a variable or a flag may hold it. */
export const internalError = async (
	c: Ctx,
	i: SurfaceItem,
	pool: string[],
): Promise<Verdict> => {
	// Only the versions the program holds, and whole matches: a short phrase of the program's own often turns up in some old major or inside a longer library message, and a loose match can pair a number of the program with a library constant of another value.
	const lib = await libCheck(c, pool, i.name, false, true);
	const m = moduleOf(c, i);
	const fn = m && i.offset !== null ? fnAround(m, i.offset) : undefined;
	const reads =
		fn && m ? /process\.(env|argv)\b/u.exec(m.src(fn))?.[0] : undefined;
	const envs = namesOfKind(c, "env");
	const flags = namesOfKind(c, "flag");
	const names = [
		...(i.name.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/gu) ?? []).filter((n) =>
			envs.has(n),
		),
		...(i.name.match(/(?<![\w-])--[a-z][a-z0-9-]+/gu) ?? []).filter((n) =>
			flags.has(n),
		),
	];
	return {
		ok: !lib.ok && reads === undefined && names.length === 0,
		evidence: {
			inLibrary: lib.ok ? lib.evidence : null,
			functionReads: reads ?? null,
			textNames: names,
		},
	};
};

const HTTP = new Set([
	"get",
	"post",
	"put",
	"patch",
	"delete",
	"request",
	"fetch",
	"head",
]);
const PASSES = new Set([
	"TemplateLiteral",
	"BinaryExpression",
	"ConditionalExpression",
	"LogicalExpression",
	"ObjectProperty",
	"ObjectExpression",
	"TemplateElement",
	"StringLiteral",
]);

const calleeName = (
	f: Extract<Node, { type: "CallExpression" }>["callee"],
): string => {
	if (f.type === "Identifier") {
		return f.name;
	}
	return f.type === "MemberExpression" && f.property.type === "Identifier"
		? f.property.name
		: "";
};

/** Whether the literal at the site is, through `+`, template, `?:` or an options object, an argument of an HTTP verb call. */
export const endpointCalled = (c: Ctx, i: SurfaceItem): Verdict => {
	const m = moduleOf(c, i);
	if (m === undefined || i.offset === null) {
		return { ok: false, evidence: { site: "none" } };
	}
	let n: Node = m.nodeAt(i.offset);
	for (let p = m.parent(n); p; n = p, p = m.parent(p)) {
		if (p.type === "CallExpression") {
			const callee = calleeName(p.callee);
			const at = n;
			const isArg = p.arguments.some((a) => a === at);
			return {
				ok: !(isArg && HTTP.has(callee)),
				evidence: { callee, argument: isArg },
			};
		}
		if (!PASSES.has(p.type)) {
			break;
		}
	}
	return { ok: true, evidence: { callee: null } };
};

const occurrences = (c: Ctx, re: RegExp) => {
	let n = 0;
	for (const m of allText(c)) {
		n += m.text.match(re)?.length ?? 0;
	}
	return n;
};

/** The print captures of the release that list the tool: the program can build a tool name at run time, so no name literal does not mean no tool. */
const listedBy = async (c: Ctx, name: string) => {
	const dir = join(c.root, "captures", c.version, "print");
	const re = new RegExp(`\\\\?"${reEscape(name)}\\\\?"`, "u");
	const files: string[] = await readdir(dir).catch(() => []);
	const texts = await Promise.all(
		files.map((f) => Bun.file(join(dir, f)).text()),
	);
	return files.filter((_, k) => re.test(texts[k] ?? ""));
};

/** A tool that the exclusion calls undefined: no name literal and no print capture lists it. */
export const toolCheck = async (c: Ctx, i: SurfaceItem): Promise<Verdict> => {
	const defs = occurrences(
		c,
		new RegExp(`\\bname:\\s*"${reEscape(i.name)}"`, "gu"),
	);
	const listed = await listedBy(c, i.name);
	return {
		ok: defs === 0 && listed.length === 0,
		evidence: { nameLiterals: defs, listedBy: listed },
	};
};

/** A setting that the exclusion calls unread: no member read of its name. */
export const settingCheck = (c: Ctx, i: SurfaceItem): Verdict => {
	const reads = occurrences(c, new RegExp(`\\.${reEscape(i.name)}\\b`, "gu"));
	return {
		ok: reads === 0,
		evidence: { memberReads: reads, detail: i.detail ?? null },
	};
};

/** A flag that the exclusion calls hidden and unread: no member read of its camel-case name. */
export const flagCheck = (c: Ctx, i: SurfaceItem): Verdict => {
	const camel = i.name
		.replace(/^--/u, "")
		.replaceAll(/-(.)/gu, (_, x: string) => x.toUpperCase());
	const reads = occurrences(c, new RegExp(`\\.${camel}\\b`, "gu"));
	return {
		ok: i.gate === "hidden" && reads === 0,
		evidence: { gate: i.gate ?? null, memberReads: reads, property: camel },
	};
};

const commandOk = (reason: string, g: string, d: string) => {
	if (reason.includes("always returns false")) {
		return g.includes("isEnabled ()=>!1");
	}
	if (reason.includes("(removed)")) {
		return g.startsWith("hidden") && d.includes("(removed)");
	}
	if (reason.includes("renamed")) {
		return g.startsWith("hidden") && d.includes("Renamed to");
	}
	return g.startsWith("hidden") && !d.includes(" | ");
};

/** A slash command whose gate and detail match what the reason says. */
export const commandCheck = (reason: string, i: SurfaceItem): Verdict => {
	const g = i.gate ?? "";
	const d = i.detail ?? "";
	return { ok: commandOk(reason, g, d), evidence: { gate: g, detail: d } };
};

/** A gate that has a read site. */
export const gateCheck = (i: SurfaceItem): Verdict => ({
	ok: i.module !== null && i.offset !== null,
	evidence: { limit: "read site only; no run sets a GrowthBook value" },
});

/** An endpoint that a docs row covers. */
export const rowCheck = (c: Ctx, row: string): Verdict => ({
	ok: c.endpointRows.has(row),
	evidence: { row, file: c.endpointRows.get(row) ?? null },
});
