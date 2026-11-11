// OpenTelemetry spans (surface 3), and the attribute helper the OTEL builders share.
import type { Entry } from "../../../inspect/mcp/src/resolve.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";
import {
	esc,
	group,
	type Json,
	type Mode,
	mods,
	parsed,
	props,
	R,
	type Text,
	UNVERIFIED,
} from "./ctx.ts";
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
		}
		addSpan(spanDefs, name, name, p, "attributes literal at creation");
	});
};

/** Style 2: a wrapper takes {spanType, attrs, contentAttrs}. */
const spanStyle2 = async (
	t: Text,
	spanDefs: Map<string, SpanDef>,
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
		);
	});
};

export const buildSpans = async (
	$defs: Defs,
	base: Defs,
	baseNote: string,
): Promise<void> => {
	const spanDefs = new Map<string, SpanDef>();
	await mapSeq(mods, async (t) => {
		await spanStyle1(t, spanDefs);
		await spanStyle2(t, spanDefs);
	});
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
