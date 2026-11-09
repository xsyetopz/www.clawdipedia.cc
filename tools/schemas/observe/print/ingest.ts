// Collector side of observe/print.ts: reads the OTLP/JSON the program posts and tallies the key paths and
// types of the three recorded files.
import { Tally } from "../../observe.ts";

export type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj =>
	typeof x === "object" && x !== null && !Array.isArray(x);
export const obj = (x: unknown): Obj => (isObj(x) ? x : {});
export const arr = (x: unknown): unknown[] => {
	if (!Array.isArray(x)) {
		return [];
	}
	const list: unknown[] = x;
	return list;
};

export const otel = new Tally();
export const transcripts = new Tally();
export const claudeJson = new Tally();
export const counts = {
	runs: 0,
	logRecords: 0,
	metricPoints: 0,
	spans: 0,
	transcriptLines: 0,
	claudeJsonFiles: 0,
};

/** OTLP AnyValue to the JSON type the attribute has. intValue is a JSON string in OTLP/JSON. */
const anyType = (v: unknown): string => {
	const o = obj(v);
	if ("stringValue" in o) {
		return "string";
	}
	if ("intValue" in o) {
		return "integer";
	}
	if ("doubleValue" in o) {
		return Number.isInteger(o["doubleValue"]) ? "integer" : "number";
	}
	if ("boolValue" in o) {
		return "boolean";
	}
	if ("arrayValue" in o) {
		return "array";
	}
	if ("kvlistValue" in o) {
		return "object";
	}
	return "null";
};
const attrsOf = (list: unknown): Map<string, string> => {
	const m = new Map<string, string>();
	for (const a of arr(list)) {
		m.set(String(obj(a)["key"]), anyType(obj(a)["value"]));
	}
	return m;
};
/** Record each attribute as `<root>.<key>` with its type. Counts one sample per attribute. */
const note = (root: string, attrs: Map<string, string>): void => {
	otel.stats.set(root, bump(otel.stats.get(root), "object"));
	for (const [k, t] of attrs) {
		const p = `${root}.${k}`;
		otel.stats.set(p, bump(otel.stats.get(p), t));
	}
};
const bump = (
	s: { n: number; types: Record<string, number> } | undefined,
	t: string,
) => {
	const r = s ?? { n: 0, types: {} };
	r.n++;
	r.types[t] = (r.types[t] ?? 0) + 1;
	return r;
};

const eventName = (rec: Obj): string | undefined => {
	for (const a of arr(rec["attributes"])) {
		if (obj(a)["key"] === "event.name") {
			return String(obj(obj(a)["value"])["stringValue"]);
		}
	}
	return undefined;
};

/** The leaf records of an OTLP body: resource list, then scope list, then the records. */
const leaves = (
	body: Obj,
	resourceKey: string,
	scopeKey: string,
	leafKey: string,
): unknown[] =>
	arr(body[resourceKey])
		.flatMap((r) => arr(obj(r)[scopeKey]))
		.flatMap((s) => arr(obj(s)[leafKey]));

const ingestLogs = (body: Obj): void => {
	for (const rec of leaves(body, "resourceLogs", "scopeLogs", "logRecords")) {
		const name = eventName(obj(rec));
		counts.logRecords++;
		note(`event:${name ?? "?"}`, attrsOf(obj(rec)["attributes"]));
	}
};

const ingestMetrics = (body: Obj): void => {
	for (const m of leaves(body, "resourceMetrics", "scopeMetrics", "metrics")) {
		const mm = obj(m);
		const pts = arr(
			obj(mm["sum"])["dataPoints"] ?? obj(mm["gauge"])["dataPoints"],
		);
		for (const dp of pts) {
			counts.metricPoints++;
			note(`metric:${String(mm["name"])}`, attrsOf(obj(dp)["attributes"]));
		}
	}
};

const ingestTraces = (body: Obj): void => {
	for (const sp of leaves(body, "resourceSpans", "scopeSpans", "spans")) {
		counts.spans++;
		note(`span:${String(obj(sp)["name"])}`, attrsOf(obj(sp)["attributes"]));
	}
};

export const ingest = (path: string, body: Obj): void => {
	if (path.endsWith("/v1/logs")) {
		ingestLogs(body);
	} else if (path.endsWith("/v1/metrics")) {
		ingestMetrics(body);
	} else if (path.endsWith("/v1/traces")) {
		ingestTraces(body);
	}
};
