// A local OTLP/HTTP JSON receiver for the OpenTelemetry probes. It keeps the attributes of every export, by signal.
import { allocPort } from "./ports.ts";

export type Signal = "metrics" | "logs" | "traces";
interface Attr {
	key: string;
	value: Record<string, unknown>;
}

const SIGNALS: Signal[] = ["metrics", "logs", "traces"];

const isAttr = (a: unknown): a is Attr =>
	typeof a === "object" &&
	a !== null &&
	"key" in a &&
	typeof a.key === "string" &&
	"value" in a &&
	typeof a.value === "object" &&
	a.value !== null;

/** Same order as the default sort: by the text of each element. */
const byText = (a: unknown, b: unknown): number => {
	const x = String(a);
	const y = String(b);
	if (x < y) {
		return -1;
	}
	return x > y ? 1 : 0;
};

const scalar = (v: Attr["value"]): string =>
	String(
		v["stringValue"] ?? v["boolValue"] ?? v["intValue"] ?? v["doubleValue"],
	);

/** Every `attributes` list in an OTLP JSON body (resource, data point, log record, span), flattened to key and value text. */
export const attributesOf = (body: unknown): [string, string][] => {
	const out: [string, string][] = [];
	const walk = (x: unknown): void => {
		if (Array.isArray(x)) {
			for (const y of x) {
				walk(y);
			}
			return;
		}
		if (typeof x !== "object" || x === null) {
			return;
		}
		for (const [k, v] of Object.entries(x)) {
			if (k === "attributes" && Array.isArray(v)) {
				for (const a of v.filter((item) => isAttr(item))) {
					out.push([a.key, scalar(a.value)]);
				}
			} else {
				walk(v);
			}
		}
	};
	walk(body);
	return out;
};

/** Distinct values by attribute name, for the names that start with `prefix`, over all exports of one signal. */
export const valuesOf = (
	bodies: unknown[],
	prefix: string,
): Record<string, string[]> => {
	const m = new Map<string, Set<string>>();
	for (const b of bodies) {
		for (const [k, v] of attributesOf(b)) {
			if (k.startsWith(prefix)) {
				m.set(k, (m.get(k) ?? new Set()).add(v));
			}
		}
	}
	return Object.fromEntries(
		[...m].toSorted(byText).map(([k, v]) => [k, [...v].toSorted(byText)]),
	);
};

export const startOtlp = async () => {
	const bodies: Record<Signal, unknown[]> = {
		metrics: [],
		logs: [],
		traces: [],
	};
	const srv = Bun.serve({
		port: await allocPort(),
		hostname: "127.0.0.1",
		async fetch(req) {
			const sig = SIGNALS.find((s) => new URL(req.url).pathname === `/v1/${s}`);
			if (sig !== undefined && req.method === "POST") {
				try {
					bodies[sig].push(JSON.parse(await req.text()));
				} catch {
					// an export that is not JSON is not stored
				}
			}
			return Response.json({});
		},
	});
	return {
		url: `http://127.0.0.1:${srv.port}`,
		bodies,
		stop: () => srv.stop(true),
	};
};
