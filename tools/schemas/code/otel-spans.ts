// OpenTelemetry spans (surface 3), and the attribute helper the OTEL builders share.
import type { Entry } from "../../../inspect/mcp/src/resolve.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";
import {
	esc,
	group,
	type Json,
	type Mode,
	mods,
	note,
	parsed,
	props,
	R,
	type Src,
	type Text,
	UNVERIFIED,
} from "./ctx.ts";
import { deadGate } from "./otel-gate.ts";
import { objSchema } from "./schema.ts";

export const attrsToProps = async (
	entries: Entry[] | undefined,
	into: Record<string, Json>,
	mode: Mode = "const",
) => {
	if (!entries) {
		return;
	}
	const s = await objSchema(entries, mode);
	for (const [k, v] of Object.entries(props(s))) {
		const cur = into[k];
		into[k] = cur !== undefined && cur["x-unverified"] !== true ? cur : v;
	}
};

export type Defs = Record<string, Json>;
interface SpanDef {
	props: Defs;
	sites: number;
	comment: string[];
	/** The constant-false gate of each creation site; a span with a gate at every site is never sent. */
	gates: (string | undefined)[];
}

const addSpan = (
	spanDefs: Map<string, SpanDef>,
	name: string,
	spanType: string | undefined,
	p: Defs,
	how: string,
	gate: string | undefined,
) => {
	const cur = spanDefs.get(name) ?? {
		props: {},
		sites: 0,
		comment: [],
		gates: [],
	};
	cur.gates.push(gate);
	for (const [k, v] of Object.entries(p)) {
		cur.props[k] ??= v;
	}
	cur.sites++;
	cur.comment.push(how);
	if (spanType !== undefined && spanType !== "") {
		cur.props["span.type"] = { const: spanType };
	}
	spanDefs.set(name, cur);
};

/** The attributes of a style-1 span: the helper call before startSpan, and the keys set on its result after it. */
const style1Attrs = async (
	m: Src,
	s: RegExpMatchArray,
	name: string,
): Promise<Defs> => {
	const winStart = Math.max(0, (s.index ?? 0) - 1800);
	const win = m.text.slice(winStart, s.index);
	const calls = [
		...win.matchAll(
			new RegExp(
				`([\\w$]+)=([\\w$]+)\\("${name.replaceAll(".", String.raw`\.`)}",`,
				"gu",
			),
		),
	];
	const last = calls.at(-1);
	const p: Defs = {};
	if (!last) {
		return p;
	}
	const argAt = winStart + (last.index ?? 0) + last[0].length;
	const call = m.at(argAt, "CallExpression");
	const entries = m.text.startsWith("{", argAt)
		? await R.objectAt(m, argAt)
		: call && (await R.call(m, call));
	if (entries) {
		await attrsToProps(await R.spreads(entries), p);
	}
	const between = m.text.slice(argAt, s.index);
	const v = group(last, 1);
	for (const a of between.matchAll(
		new RegExp(
			`(?<![\\w$.])${esc(v)}(?:\\["([\\w.-]+)"\\]|\\.([\\w$]+))=`,
			"gu",
		),
	)) {
		const key = a[1] ?? a[2];
		if (key !== undefined) {
			p[key] ??= { ...UNVERIFIED };
		}
	}
	return p;
};

/** Style 1: a helper builds the attributes, then startSpan("claude_code.<name>"). */
const spanStyle1 = async (
	t: Text,
	spanDefs: Map<string, SpanDef>,
): Promise<void> => {
	const found = [...t.text.matchAll(/startSpan\("claude_code\.([\w.]+)"/gu)];
	if (found.length === 0) {
		return;
	}
	const m = await parsed(t);
	await mapSeq(found, async (s) => {
		const name = group(s, 1);
		const p = await style1Attrs(m, s, name);
		addSpan(
			spanDefs,
			name,
			name,
			p,
			"attributes literal at creation",
			deadGate(m, s.index ?? 0),
		);
	});
};

// The one wrapper that starts every style-2 span: startSpan(n,{attributes:{...,"span.type":e.spanType,...}}).
const WRAPPER =
	/startSpan\([\w$]+,\{attributes:\{[^}]*"span\.type":[\w$]+\.spanType/u;

/** The constant-false gate of the style-2 wrapper, or undefined when it has none or is not one function. */
const wrapperGate = async (): Promise<string | undefined> => {
	const hits = mods.filter((t) => WRAPPER.test(t.text));
	const t = hits.length === 1 ? hits[0] : undefined;
	const at = t === undefined ? -1 : t.text.search(WRAPPER);
	return t === undefined ? undefined : deadGate(await parsed(t), at);
};

/** Style 2: a wrapper takes {spanType, attrs, contentAttrs}. */
const spanStyle2 = async (
	t: Text,
	spanDefs: Map<string, SpanDef>,
	gate: string | undefined,
): Promise<void> => {
	const found = [
		...t.text.matchAll(/"claude_code\.([\w.]+)",\{spanType:"([\w.]+)"/gu),
	];
	if (found.length === 0) {
		return;
	}
	const m = await parsed(t);
	await mapSeq(found, async (s) => {
		const objAt = (s.index ?? 0) + s[0].indexOf(",{spanType") + 1;
		const p: Defs = {};
		const content: string[] = [];
		await mapSeq(await R.objectAt(m, objAt), async (e) => {
			if (!("key" in e) || e.val.k !== "obj") {
				return;
			}
			if (e.key !== "attrs" && e.key !== "contentAttrs") {
				return;
			}
			const before = Object.keys(p);
			await attrsToProps(await R.spreads(e.val.e), p);
			if (e.key === "contentAttrs") {
				content.push(...Object.keys(p).filter((k) => !before.includes(k)));
			}
		});
		addSpan(
			spanDefs,
			group(s, 1),
			s[2],
			p,
			content.length > 0 ? `contentAttrs: ${content.join(", ")}` : "",
			gate,
		);
	});
};

export const buildSpans = async (
	$defs: Defs,
	base: Defs,
	baseNote: string,
): Promise<void> => {
	const spanDefs = new Map<string, SpanDef>();
	const gate = await wrapperGate();
	await mapSeq(mods, async (t) => {
		await spanStyle1(t, spanDefs);
		await spanStyle2(t, spanDefs, gate);
	});
	for (const [name, d] of spanDefs) {
		const dead = d.gates.every((g) => g !== undefined);
		if (dead) {
			note(
				`otel: span claude_code.${name} left out: each creation site returns first when ${d.gates[0] ?? ""}() is false, and ${d.gates[0] ?? ""}() always returns false`,
			);
			continue;
		}
		$defs[`span:claude_code.${name}`] = {
			"x-otel-kind": "span",
			type: "object",
			$comment: `${baseNote} Also set on every span: gen_ai.provider.name. Attributes set after the span starts (at its end) are not listed. Creation sites read: ${d.sites}.${d.comment.some(Boolean) ? ` Added only when content logging is on (${d.comment.filter(Boolean).join("; ")}).` : ""}`,
			properties: {
				...base,
				"gen_ai.provider.name": { ...UNVERIFIED },
				...d.props,
			},
		};
	}
};
