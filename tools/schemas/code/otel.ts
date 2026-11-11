// Surface 3: OpenTelemetry metrics, spans, and events.
import { isNode } from "../../../inspect/mcp/src/ast/node.ts";
import {
	aliasesOf,
	argEntries,
	callAt,
	eventSites,
} from "../../../inspect/mcp/src/events.ts";
import { mergeEntries } from "../../../inspect/mcp/src/resolve.ts";
import { mapSeq } from "../../../inspect/mcp/src/seq.ts";
import {
	bundle,
	esc,
	fnAround,
	group,
	header,
	idx,
	type Json,
	mods,
	note,
	only,
	parsed,
	R,
	sortedKeys,
	type Src,
	type Text,
	UNVERIFIED,
	VERSION,
} from "./ctx.ts";
import { attrsToProps, buildSpans, type Defs } from "./otel-spans.ts";

interface Slot {
	name: string;
	description: string;
	unit?: string | undefined;
}

/** Base attributes: the keys the metrics/events attribute builder assigns. */
const buildBase = async (): Promise<{ base: Defs; baseNote: string }> => {
	const bSrc = await only('["user.id"]=');
	const bAt = idx(bSrc, '["user.id"]=');
	const bFn = fnAround(bSrc, bAt, () => true);
	const bText = bFn ? bSrc.src(bFn) : "";
	const baseKeys = [
		...new Set(
			[...bText.matchAll(/\b[\w$]\["([\w.]+)"\]=/gu)].map((m) => group(m, 1)),
		),
	];
	const baseGates = [
		...new Set(
			[...bText.matchAll(/"(OTEL_METRICS_INCLUDE_\w+)"/gu)].map((m) =>
				group(m, 1),
			),
		),
	];
	const base: Defs = {};
	for (const k of baseKeys) {
		base[k] = { ...UNVERIFIED };
	}
	const baseNote = `Base attributes (keys assigned by the attribute builder, in code order); the builder also copies keys of OTEL_RESOURCE_ATTRIBUTES when OTEL_METRICS_INCLUDE_RESOURCE_ATTRIBUTES is set. ${baseGates.length > 0 ? ` Gates found in the builder: ${baseGates.join(", ")}.` : ""}`;
	return { base, baseNote };
};

/** Attribution keys (agent, skill, plugin, mcp) that cost/token metrics spread in. */
const buildAttrib = async (): Promise<Defs> => {
	const attrRe = /\{\.\.\.[\w$]+&&\{"agent\.name":/u;
	const found = mods.find((m) => attrRe.test(m.text));
	if (!found) {
		throw new Error("attribution anchor not found");
	}
	const attrSrc = await parsed(found);
	const attrAt = idx(attrSrc, attrRe);
	const attrib: Defs = {};
	await attrsToProps(await R.objectAt(attrSrc, attrAt), attrib);
	for (const v of Object.values(attrib)) {
		v["x-unverified"] = true;
	}
	return attrib;
};

const parseString = (text: string): string => {
	const v: unknown = JSON.parse(text);
	if (typeof v !== "string") {
		throw new TypeError(`not a string: ${text}`);
	}
	return v;
};

const findSlots = (mSrc: Src): Map<string, Slot> => {
	const slot = new Map<string, Slot>();
	for (const m of mSrc.text.matchAll(
		/this\.(#\w+)=[\w$]+\("claude_code\.([\w.]+)",\{description:"((?:[^"\\]|\\.)*)"(?:,unit:[\w$]+\("(\w+)"\))?\}/gu,
	)) {
		slot.set(group(m, 1), {
			name: group(m, 2),
			description: parseString(`"${group(m, 3)}"`),
			unit: m[4],
		});
	}
	return slot;
};

const findMethods = (
	mSrc: Src,
	slot: Map<string, Slot>,
): Map<string, string> => {
	const method = new Map<string, string>();
	for (const m of mSrc.text.matchAll(
		/(\w+Counter)\(\)\{return this\.(#\w+)\}/gu,
	)) {
		const s = slot.get(group(m, 2));
		if (s) {
			method.set(group(m, 1), s.name);
		}
	}
	return method;
};

/** Add the attributes of each `acc()?.add(value, attrs)` call in one module. */
const collectAdds = async (
	t: Text,
	nm: string,
	p: Defs,
	attrib: Defs,
): Promise<void> => {
	const call = new RegExp(`(?<![\\w$.])${esc(nm)}\\(\\)\\?\\.add\\(`, "gu");
	const hits = [...t.text.matchAll(call)];
	if (hits.length === 0) {
		return;
	}
	const m = await parsed(t);
	await mapSeq(hits, async (hit) => {
		const open = hit.index + hit[0].length - 1;
		const arg = callAt(m, open)?.arguments[1];
		const entries = await argEntries(R, m, isNode(arg) ? arg : undefined);
		if (entries) {
			const before = R.unresolved.length;
			await attrsToProps(await R.spreads(entries), p);
			if (R.unresolved.length > before && Object.keys(attrib).length > 0) {
				for (const [k, v] of Object.entries(attrib)) {
					p[k] ??= v;
				}
			}
		}
	});
};

/** Metrics: installMeter registers each counter; accessors expose them; call sites add values. */
const buildMetrics = async (
	$defs: Defs,
	base: Defs,
	baseNote: string,
	attrib: Defs,
): Promise<void> => {
	const mSrc = await only("Count of CLI sessions started");
	const slot = findSlots(mSrc);
	const method = findMethods(mSrc, slot);
	const accessorSrc = mods.find((m) =>
		m.text.includes("telemetryHandles.sessionCounter()"),
	);
	if (!accessorSrc) {
		throw new Error("metric accessors not found");
	}
	const metricProps = new Map<string, Defs>();
	await mapSeq(method, async ([meth, name]) => {
		const acc = new RegExp(
			`function ([\\w$]+)\\(\\)\\{return [\\w$]+\\(\\)\\.host\\.telemetryHandles\\.${meth}\\(\\)\\}`,
			"u",
		).exec(accessorSrc.text);
		const p: Defs = {};
		metricProps.set(name, p);
		if (!acc) {
			return;
		}
		const accName = group(acc, 1);
		await mapSeq(mods, async (m) => {
			const names =
				m === accessorSrc ? [accName] : aliasesOf(m, accessorSrc.name, accName);
			await mapSeq(names, (nm) => collectAdds(m, nm, p, attrib));
		});
	});
	for (const s of slot.values()) {
		const own = metricProps.get(s.name) ?? {};
		$defs[`metric:claude_code.${s.name}`] = {
			"x-otel-kind": "metric",
			type: "object",
			description: s.description,
			...(s.unit !== undefined && s.unit !== ""
				? { $comment: `Unit: ${s.unit}. ${baseNote}` }
				: { $comment: baseNote }),
			properties: { ...base, ...own },
		};
	}
};

/** Events: bi(name, attrs) emits a log record with the base attributes and event.* fields. */
const buildEvents = async (
	$defs: Defs,
	base: Defs,
	baseNote: string,
): Promise<void> => {
	const evProps: Defs = {
		"event.name": { type: "string" },
		"event.timestamp": { type: "string" },
		"event.sequence": { type: "number" },
		"prompt.id": { ...UNVERIFIED },
		"workspace.host_paths": { type: "array" },
	};
	const events = await eventSites(bundle, R);
	await mapSeq(events, async ([name, lists]) => {
		const p: Defs = {};
		await attrsToProps(await mergeEntries(lists), p);
		$defs[`event:${name}`] = {
			"x-otel-kind": "event",
			type: "object",
			$comment: `${baseNote} Call sites read: ${lists.length}. A key missing from some sites is optional.`,
			properties: { ...base, ...evProps, ...p, "event.name": { const: name } },
		};
	});
};

export const buildOtel = async (): Promise<{ file: string; schema: Json }> => {
	const $defs: Defs = {};
	const { base, baseNote } = await buildBase();
	const attrib = await buildAttrib();
	await buildMetrics($defs, base, baseNote, attrib);
	await buildSpans($defs, base, baseNote);
	await buildEvents($defs, base, baseNote);

	const ordered = Object.fromEntries(
		sortedKeys($defs).map((k): [string, Json] => [k, $defs[k] ?? {}]),
	);
	const count = (kind: string) =>
		Object.values(ordered).filter((d) => d["x-otel-kind"] === kind).length;
	note(
		`otel: ${count("metric")} metrics, ${count("span")} spans, ${count("event")} events`,
	);
	const out: Json = {
		...header(
			"claude-code-otel.json",
			"Claude Code OpenTelemetry metrics, spans, and events",
			`For the OpenTelemetry data Claude Code emits. Each $defs entry is one metric, span, or event; the kind is in x-otel-kind and the properties are its attributes. Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: "Count of CLI sessions started" (the meter setup that registers each metric with its description and unit) with the counter accessor functions and their .add(value, attributes) call sites; the span helpers (startSpan("claude_code.<name>") with the attribute literal built just before it, and the wrapper that takes {spanType, attrs, contentAttrs}); the event emitter that sets "event.name", "event.timestamp", "event.sequence" and its call sites with the attribute literal; the base attribute builder behind "OTEL_METRICS_INCLUDE_SESSION_ID". No probe in captures/ records telemetry, so nothing is marked x-observed. Do not edit by hand.`,
		),
		$defs: ordered,
	};
	return { file: "claude-code-otel.json", schema: out };
};
