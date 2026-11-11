// Surface 4: the frontmatter of skills, subagents, and output styles, from the program's zod objects.
import type { Entry } from "../../../inspect/mcp/src/resolve.ts";
import {
	esc,
	fnAround,
	group,
	header,
	idx,
	type Json,
	mods,
	note,
	only,
	parseStrings,
	props,
	R,
	type Src,
	VERSION,
} from "./ctx.ts";

/** Parse `NAME=f(()=>u({...}))` / `NAME=f(()=>OTHER().extend({...}))` zod object definitions. */
const zodFields = async (
	src: Src,
	name: string,
): Promise<{ parent?: string | undefined; fields: Entry[]; at: number }> => {
	const re = new RegExp(
		`[,; ]${esc(name)}=[\\w$]+\\(\\(\\)=>(?:([\\w$]+)\\(\\)\\.extend\\(|[\\w$]+\\()\\{`,
		"u",
	);
	const m = re.exec(src.text);
	if (!m) {
		throw new Error(`zod definition ${name} not found`);
	}
	const at = m.index + m[0].length - 1;
	return { parent: m[1], fields: await R.objectAt(src, at), at };
};

const frontmatterField = (e: Entry): [string, Json] | undefined => {
	if (!("key" in e) || e.val.k !== "unk") {
		return undefined;
	}
	const text = e.val.text;
	const out: Json = {};
	const d = /\.describe\(("(?:[^"\\]|\\.)*")\)$/u.exec(text);
	if (d) {
		out["description"] = JSON.parse(group(d, 1));
	}
	const en = /^[\w$]+\((\[(?:"[^"]*",?)+\])\)/u.exec(text);
	if (en) {
		const vals = parseStrings(group(en, 1));
		if (text.includes(".nullable()")) {
			out["enum"] = [...vals, null];
		} else {
			out["enum"] = vals;
		}
	} else {
		out["x-unverified"] = true;
	}
	return [e.key, out];
};

const readKeys = (text: string, v: string): Set<string> =>
	new Set([
		...[
			...text.matchAll(
				new RegExp(`(?<![\\w$.])${esc(v)}\\.([A-Za-z_]\\w*)`, "gu"),
			),
		].map((m) => group(m, 1)),
		...[
			...text.matchAll(
				new RegExp(`(?<![\\w$.])${esc(v)}\\["([\\w-]+)"\\]`, "gu"),
			),
		].map((m) => group(m, 1)),
	]);

const buildDefs = async (src: Src): Promise<Record<string, Json>> => {
	const reg =
		/\{skill:[\w$]+\(\(\)=>([\w$]+)\(\)\.strict\(\)\),agent:[\w$]+\(\(\)=>([\w$]+)\(\)\.strict\(\)\),"output-style":[\w$]+\(\(\)=>([\w$]+)\(\)\.strict\(\)\)\}/u.exec(
			src.text,
		);
	if (!reg) {
		throw new Error("frontmatter schema table not found");
	}
	const [skill, agent, style] = [group(reg, 1), group(reg, 2), group(reg, 3)];
	const build = async (name: string): Promise<Json> => {
		const z = await zodFields(src, name);
		const p: Record<string, Json> = {};
		if (z.parent !== undefined) {
			const parent = await build(z.parent);
			for (const [k, v] of Object.entries(props(parent))) {
				p[k] = v;
			}
		}
		for (const e of z.fields) {
			const f = frontmatterField(e);
			if (f) {
				p[f[0]] = f[1];
			}
		}
		return { type: "object", properties: p };
	};
	return {
		skill: {
			...(await build(skill)),
			$comment: "Skills and commands (.md files with a YAML header).",
		},
		agent: {
			...(await build(agent)),
			$comment: "Subagent files (.md with a YAML header).",
		},
		"output-style": {
			...(await build(style)),
			$comment: "Output style files (.md with a YAML header).",
		},
	};
};

/** Cross-check with what the loaders read. */
const noteLoaderReads = (src: Src, skillDef: Json): void => {
	const loaderAt = idx(src, /\["user-invocable"\]===void 0\?!0:/u);
	// The loader: the named function around the anchor whose first of two or more parameters is a name.
	const lf = fnAround(
		src,
		loaderAt,
		(f) =>
			f.type !== "ArrowFunctionExpression" &&
			f.params.length > 1 &&
			f.params[0]?.type === "Identifier",
	);
	const lp = lf?.params[0];
	if (lf && lp?.type === "Identifier") {
		const reads = readKeys(src.src(lf), lp.name);
		const known = new Set(Object.keys(props(skillDef)));
		const miss = [...reads].filter(
			(k) => !known.has(k) && !["length", "map", "filter"].includes(k),
		);
		if (miss.length > 0) {
			note(
				`frontmatter skill: loader reads keys the program's own schema lacks: ${miss.join(", ")}`,
			);
		}
		const unread = [...known].filter((k) => !reads.has(k));
		note(
			`frontmatter skill: schema keys not read in the skill loader function itself: ${unread.join(", ")}`,
		);
	}
};

const noteAllowlist = ($defs: Record<string, Json>): void => {
	const allowRe =
		/var [\w$]+=\["name","description","model","allowed-tools"[^\]]*\]/u;
	const allow = mods.map((m) => allowRe.exec(m.text)).find((x) => x !== null);
	if (allow) {
		const keys = parseStrings(allow[0].slice(allow[0].indexOf("[")));
		const have = new Set(
			Object.values($defs).flatMap((d) => Object.keys(props(d))),
		);
		note(
			`frontmatter: known-key allowlist has ${keys.length} keys; ${keys.filter((k) => !have.has(k)).length} are in no schema: ${keys.filter((k) => !have.has(k)).join(", ")}`,
		);
	}
};

export const buildFrontmatter = async (): Promise<{
	file: string;
	schema: Json;
}> => {
	const src = await only("tengu_frontmatter_shadow_unknown_key");
	const $defs = await buildDefs(src);
	noteLoaderReads(src, $defs["skill"] ?? {});
	noteAllowlist($defs);
	return {
		file: "claude-code-frontmatter.json",
		schema: {
			...header(
				"claude-code-frontmatter.json",
				"Claude Code frontmatter of skills, subagents, and output styles",
				`For the YAML header of skill/command, subagent, and output style .md files. Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: "tengu_frontmatter_shadow_unknown_key" and the table {skill, agent, "output-style"} of strict zod objects next to it; descriptions are the program's .describe() text; the loose value type of most keys (string, number, boolean, or null) is why they are x-unverified. Keys with a description that starts with "@internal" are internal. No probe in captures/ records frontmatter keys. Do not edit by hand.`,
			),
			$defs,
		},
	};
};
