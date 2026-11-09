// OpenTelemetry spans (surface 3), and the attribute helper the OTEL builders share.
import type { Entry } from "../../../inspect/mcp/src/resolve.ts";
import {
	esc,
	group,
	type Json,
	type Mode,
	mods,
	props,
	R,
	type Src,
	UNVERIFIED,
} from "./ctx.ts";
import { objSchema } from "./schema.ts";

export const attrsToProps = (
	entries: Entry[] | undefined,
	into: Record<string, Json>,
	mode: Mode = "const",
) => {
	if (!entries) {
		return;
	}
	const s = objSchema(entries, mode);
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
}

const addSpan = (
	spanDefs: Map<string, SpanDef>,
	name: string,
	spanType: string | undefined,
	p: Defs,
	how: string,
) => {
	const cur = spanDefs.get(name) ?? { props: {}, sites: 0, comment: [] };
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

/** Style 1: a helper builds the attributes, then startSpan("claude_code.<name>"). */
const spanStyle1 = (m: Src, spanDefs: Map<string, SpanDef>): void => {
	for (const s of m.text.matchAll(/startSpan\("claude_code\.([\w.]+)"/gu)) {
		const name = group(s, 1);
		const win = m.text.slice(Math.max(0, (s.index ?? 0) - 1800), s.index);
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
		if (last) {
			const winStart = Math.max(0, (s.index ?? 0) - 1800);
			const argAt = winStart + (last.index ?? 0) + last[0].length;
			const call = m.at(argAt, "CallExpression");
			const entries = m.text.startsWith("{", argAt)
				? R.objectAt(m, argAt)
				: call && R.call(m, call);
			if (entries) {
				attrsToProps(R.spreads(entries), p);
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
		}
		addSpan(spanDefs, name, name, p, "attributes literal at creation");
	}
};

/** Style 2: a wrapper takes {spanType, attrs, contentAttrs}. */
const spanStyle2 = (m: Src, spanDefs: Map<string, SpanDef>): void => {
	for (const s of m.text.matchAll(
		/"claude_code\.([\w.]+)",\{spanType:"([\w.]+)"/gu,
	)) {
		const objAt = (s.index ?? 0) + s[0].indexOf(",{spanType") + 1;
		const p: Defs = {};
		const content: string[] = [];
		for (const e of R.objectAt(m, objAt)) {
			if (!("key" in e) || e.val.k !== "obj") {
				continue;
			}
			if (e.key !== "attrs" && e.key !== "contentAttrs") {
				continue;
			}
			const before = Object.keys(p);
			attrsToProps(R.spreads(e.val.e), p);
			if (e.key === "contentAttrs") {
				content.push(...Object.keys(p).filter((k) => !before.includes(k)));
			}
		}
		addSpan(
			spanDefs,
			group(s, 1),
			s[2],
			p,
			content.length > 0 ? `contentAttrs: ${content.join(", ")}` : "",
		);
	}
};

export const buildSpans = ($defs: Defs, base: Defs, baseNote: string): void => {
	const spanDefs = new Map<string, SpanDef>();
	for (const m of mods) {
		spanStyle1(m, spanDefs);
		spanStyle2(m, spanDefs);
	}
	for (const [name, d] of spanDefs) {
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
