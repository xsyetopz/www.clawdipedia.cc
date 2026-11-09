import { rm } from "node:fs/promises";
import { join } from "node:path";

import { BADGE_NOTES } from "../notes.ts";
import type { Variant } from "../variants.ts";
import { OUT } from "./ctx.ts";
import type { Tool } from "./types.ts";

let diffRuns = 0;

export const udiff = async (
	a: string,
	b: string,
	la: string,
	lb: string,
): Promise<string> => {
	// pages render in parallel, so each call gets its own temp files
	diffRuns += 1;
	const fa = join(OUT, `.a${diffRuns}.tmp`);
	const fb = join(OUT, `.b${diffRuns}.tmp`);
	await Promise.all([Bun.write(fa, a), Bun.write(fb, b)]);
	const proc = Bun.spawn(["diff", "-u", "--label", la, "--label", lb, fa, fb], {
		stdout: "pipe",
	});
	const out = await new Response(proc.stdout).text();
	await proc.exited;
	await Promise.all([rm(fa), rm(fb)]);
	return out;
};

/** The strings in code-unit order, as `Array#sort()` puts them. */
export const sortStrings = (xs: string[]): string[] => {
	const out: string[] = [];
	for (const x of xs) {
		const at = out.findIndex((y) => y > x);
		out.splice(at === -1 ? out.length : at, 0, x);
	}
	return out;
};

export const fence = (body: string, lang: string) => {
	const longest = Math.max(
		2,
		...[...body.matchAll(/`+/gu)].map((m) => m[0].length),
	);
	const f = "`".repeat(longest + 1);
	return `${f}${lang}\n${body.replace(/\s+$/u, "")}\n${f}`;
};
export const fmt = (n: number) => n.toLocaleString("en-US");
export const badge = (v: Variant) => {
	const n = BADGE_NOTES[v.id] ?? v.gatedNote;
	return v.status === "Gated" || v.status === "Differs"
		? `<${v.status} note="${(n ?? "").replaceAll('"', "&quot;")}" />`
		: `<${v.status} />`;
};
export const yaml = (s: string) => JSON.stringify(s);

const kind = (l: string): string => {
	if (l.startsWith("|")) {
		return "t";
	}
	if (/^(- |\d+\. )/u.test(l)) {
		return "l";
	}
	if (l.startsWith("```")) {
		return "f";
	}
	return l === "" ? "b" : "p";
};

// join text lines: blank line between paragraphs, none inside lists, tables, and code fences
export const para = (lines: string[]): string[] => {
	const out: string[] = [];
	let fenced = false;
	let prev = "b";
	for (const l of lines) {
		const k = kind(l);
		if (fenced) {
			out.push(l);
			if (k === "f") {
				fenced = false;
				out.push("");
				prev = "b";
			}
			continue;
		}
		if (k === "f") {
			if (prev !== "b") {
				out.push("");
			}
			out.push(l);
			fenced = true;
			continue;
		}
		if (k === "b") {
			out.push(l);
			prev = "b";
			continue;
		}
		if (prev !== "b" && !(prev === k && k !== "p")) {
			out.push("");
		}
		out.push(l);
		prev = k;
	}
	return out;
};

export const toolDiff = (a: Tool[], b: Tool[]): string => {
	const an = new Map(a.map((t) => [t.name, t]));
	const bn = new Map(b.map((t) => [t.name, t]));
	const rem = a.filter((t) => !bn.has(t.name)).map((t) => t.name);
	const add = b.filter((t) => !an.has(t.name)).map((t) => t.name);
	const chg = b
		.filter((t) => {
			const old = an.get(t.name);
			return (
				old !== undefined && (old.desc !== t.desc || old.schema !== t.schema)
			);
		})
		.map((t) => t.name);
	const out: string[] = [];
	if (add.length > 0) {
		out.push(`adds ${add.map((x) => `\`${x}\``).join(", ")}.`);
	}
	if (rem.length > 0) {
		out.push(`removes ${rem.map((x) => `\`${x}\``).join(", ")}.`);
	}
	if (chg.length > 0) {
		out.push(
			`changes the text or schema of ${chg.map((x) => `\`${x}\``).join(", ")}.`,
		);
	}
	return out.join(" ");
};
export const stripTrailing = (s: string) => s.replaceAll(/[ \t]+$/gmu, "");
