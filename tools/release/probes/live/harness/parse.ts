import { type CaseResult, isCaseResult } from "../../../lib/results.ts";
import { show } from "../../print/run/helpers.ts";
import { isObj, type Obj, obj } from "../../print/run/types.ts";

export { arr, type Obj, obj } from "../../print/run/types.ts";

/** The model the program really used, from the system/init event. */
export const initModel = (evs: Obj[]): string =>
	show(
		evs.find((e) => e["type"] === "system" && e["subtype"] === "init")?.[
			"model"
		] ?? "",
	);

const UUID =
	/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/giu;
/** Live-only scrub: ids and URLs that identify the account (uuids, artifact URLs, org/account path parts). */
export const scrub = (s: string): string =>
	s
		.replaceAll(/https?:\/\/\S*claude\.ai\S*/giu, "<claude.ai-url>")
		.replaceAll(/\/(organizations|accounts?|orgs)\/[^/\s?"']+/giu, "/$1/<id>")
		.replaceAll(UUID, "<uuid>")
		.replaceAll(
			/\b(org|acct|account|user|artifact)_[A-Za-z0-9]{6,}/giu,
			"<id>",
		);

const deep = (v: unknown): unknown => {
	if (typeof v === "string") {
		return scrub(v);
	}
	if (Array.isArray(v)) {
		return v.map((x) => deep(x));
	}
	if (typeof v === "object" && v !== null) {
		return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, deep(x)]));
	}
	return v;
};

export const scrubResult = (r: CaseResult): CaseResult => {
	const out = deep(r);
	if (!isCaseResult(out)) {
		throw new Error(`scrub broke the shape of ${r.id}`);
	}
	return out;
};

export const events = (stdout: string): Obj[] =>
	stdout
		.split("\n")
		.filter((l) => l !== "")
		.flatMap((l) => {
			try {
				return [obj(JSON.parse(l))];
			} catch {
				return [];
			}
		});

/** Usage of the first model response: its cache_read_input_tokens says if the cache was warm. */
export const firstUsage = (evs: Obj[]): Obj | null => {
	for (const e of evs) {
		const u = obj(obj(e["message"])["usage"]);
		if (e["type"] === "assistant" && Object.keys(u).length > 0) {
			return u;
		}
	}
	const r = evs.find((e) => e["type"] === "result");
	return r === undefined ? null : obj(r["usage"]);
};

/** The context_usage object, wherever the event keeps it (port of p305-live/sum.py). */
export const contextUsage = (evs: Obj[]): Obj | null => {
	let found: Obj | null = null;
	for (const e of evs) {
		const c = e["context_usage"] ?? obj(e["message"])["context_usage"];
		if (isObj(c)) {
			found = c;
		}
		for (const v of Object.values(e)) {
			if (isObj(v) && "context_usage" in v) {
				found = obj(v["context_usage"]);
			}
		}
	}
	return found;
};

export const sumTokens = (xs: unknown[]): number =>
	xs.reduce<number>((n, m) => n + Number(obj(m)["tokens"] ?? 0), 0);
