import { arr, obj } from "./run.ts";
// --disable-slash-commands (ported from p305-print dsc.ts, dsc2.ts, dsc3.ts).
import {
	bodyOf,
	type CaseDef,
	fixed,
	json,
	msgs,
	type Out,
	type Run,
	runCases,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const bytes = (s: string) => Buffer.byteLength(s);

interface Measure {
	total: number;
	system: number;
	messages: number;
	nTools: number;
	tools: Record<string, number>;
	skillsSection: number;
	toolNames: string[];
}

const skillsText = (content: unknown): string => {
	const text = obj(arr(content)[0])["text"];
	return typeof text === "string" ? text : "";
};

const measure = (r: Run): Measure | null => {
	const q = msgs(r)[0];
	if (!q) {
		return null;
	}
	const b = bodyOf(q);
	const fx = (v: unknown) => fixed(r, json(v));
	const tools = Object.fromEntries(
		(b.tools ?? []).map((t) => [t.name, bytes(fx(t))]),
	);
	const first = skillsText(b.messages?.[1]?.content);
	const a = first.indexOf("The following skills");
	const e = first.indexOf("\n\nToday's date");
	return {
		total: bytes(fx(b)),
		system: bytes(fx(b.system)),
		messages: bytes(fx(b.messages)),
		nTools: (b.tools ?? []).length,
		tools,
		skillsSection: a !== -1 && e > a ? bytes(fixed(r, first.slice(a, e))) : 0,
		toolNames: toolNames(q),
	};
};

const opt = <T>(m: Measure | null, f: (m: Measure) => T): T | null =>
	m === null ? null : f(m);

const toolBytes = (m: Measure | null, name: string): number | null =>
	opt(m, (x) => x.tools[name] ?? null);

const sizeData = (a: Measure | null, b: Measure | null): Out["data"] => ({
	precondition: a !== null && b !== null,
	baseTotalBytes: opt(a, (m) => m.total),
	flagTotalBytes: opt(b, (m) => m.total),
	deltaBytes: a !== null && b !== null ? b.total - a.total : null,
	baseSystemBytes: opt(a, (m) => m.system),
	flagSystemBytes: opt(b, (m) => m.system),
	baseMessagesBytes: opt(a, (m) => m.messages),
	flagMessagesBytes: opt(b, (m) => m.messages),
	baseTools: opt(a, (m) => m.nTools),
	flagTools: opt(b, (m) => m.nTools),
	skillToolBytes: toolBytes(a, "Skill"),
	baseWorkflowToolBytes: toolBytes(a, "Workflow"),
	flagWorkflowToolBytes: toolBytes(b, "Workflow"),
	skillsSectionBytes: opt(a, (m) => m.skillsSection),
	removedTools:
		a !== null && b !== null
			? a.toolNames.filter((n) => !b.toolNames.includes(n))
			: null,
});

const sizes: CaseDef = {
	name: "sizes",
	run: async (ctx) => {
		const off = await withRun(ctx, {}, (r) => ({ r, m: measure(r) }));
		const on = await withRun(
			ctx,
			{ args: ["--disable-slash-commands"] },
			(r) => ({
				r,
				m: measure(r),
			}),
		);
		return {
			from: on.r,
			args: ["--disable-slash-commands"],
			data: sizeData(off.m, on.m),
			notes:
				"Two runs: baseline and --disable-slash-commands; args/exit shown are the flag run.",
		};
	},
};

export const dsc: PrintGroup = {
	id: "dsc",
	title: "--disable-slash-commands request size",
	run: (ctx) => runCases(ctx, "dsc", [sizes]),
};
