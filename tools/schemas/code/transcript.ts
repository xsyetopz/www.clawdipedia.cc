// Surface 2: transcript lines, from the entry type registry and every literal that writes a line.
import { join } from "node:path";

import { type Entry, mergeEntries } from "../../../inspect/mcp/src/resolve.ts";
import { isTranscriptSite } from "../transcript-sites.ts";
import {
	CAPTURES,
	group,
	header,
	idx,
	isJson,
	isStringArray,
	type Json,
	markObserved,
	mods,
	note,
	only,
	OUT,
	props,
	R,
	readJson,
	sortedKeys,
	type Src,
	VERSION,
} from "./ctx.ts";
import { objSchema } from "./schema.ts";
import { laterWrite } from "./transcript-write.ts";

const CHAIN = new Set([
	"user",
	"assistant",
	"system",
	"attachment",
	"progress",
]);

interface Site {
	src: Src;
	at: number;
	entries: Entry[];
}
type Sites = Map<string, Site[]>;

const REGISTRY = '{user:"transcript",assistant:"transcript"';

/** Entry types of the registry, and the policy string of each that has one. */
const readRegistry = (
	reg: Src,
): { types: string[]; policy: Map<string, string> } => {
	const registry = R.objectAt(reg, idx(reg, REGISTRY));
	const types = registry.flatMap((e) => ("key" in e ? [e.key] : []));
	const policy = new Map<string, string>();
	for (const e of registry) {
		if ("key" in e && e.val.k === "str") {
			policy.set(e.key, e.val.v);
		}
	}
	return { types, policy };
};

/** Fields the writer adds to every message line: the literal in insertMessageChain plus its spreads. */
const commonFields = (): Json => {
	const wRe = /parentUuid:[\w$]+\?null:[\w$]+,logicalParentUuid:/u;
	const w = mods.find((m) => wRe.test(m.text));
	if (!w) {
		throw new Error("insertMessageChain literal not found");
	}
	const wAt = w.text.lastIndexOf("{", idx(w, wRe));
	return objSchema(R.objectAt(w, wAt), "const");
};

const addSite = (sites: Sites, t: string, site: Site): void => {
	const list = sites.get(t) ?? [];
	list.push(site);
	sites.set(t, list);
};

/** Literals where `type:"<t>"` comes later, such as an assistant message built as {message, ..., type:"assistant"}: the literal that holds the key. */
const midSites = (m: Src, types: string[], sites: Sites): void => {
	const mid = /,type:"([\w-]+)"[,}]/gu;
	for (let h = mid.exec(m.text); h; h = mid.exec(m.text)) {
		const t = group(h, 1);
		if (!types.includes(t)) {
			continue;
		}
		const prop = m.parent(m.nodeAt(h.index + 1));
		const obj = prop && m.parent(prop);
		if (prop?.type !== "Property" || obj?.type !== "ObjectExpression") {
			continue;
		}
		const list = sites.get(t) ?? [];
		if (!list.some((x) => x.src === m && x.at === obj.start)) {
			list.push({ src: m, at: obj.start, entries: R.entries(m, obj) });
		}
		sites.set(t, list);
	}
};

/** Every `{type:"<t>",...}` literal in the program. */
const collectSites = (types: string[]): Sites => {
	const sites: Sites = new Map();
	const re = /\{(?:\.\.\.[\w$.()]+,)?type:"([\w-]+)"[,}]/gu;
	for (const m of mods) {
		let hit: RegExpExecArray | null = re.exec(m.text);
		while (hit) {
			const t = group(hit, 1);
			if (types.includes(t)) {
				addSite(sites, t, {
					src: m,
					at: hit.index,
					entries: R.objectAt(m, hit.index),
				});
			}
			hit = re.exec(m.text);
		}
		midSites(m, types, sites);
	}
	return sites;
};

const keysOf = (entries: Entry[]): string[] =>
	entries.flatMap((e) => ("key" in e ? [e.key] : []));

/** Every property name in the stream-json schema, which generate.ts wrote before this step. */
const streamKeysOf = (): Set<string> => {
	const streamKeys = new Set<string>();
	const walk = (o: unknown): void => {
		if (!isJson(o)) {
			return;
		}
		const p = o["properties"];
		if (isJson(p)) {
			for (const k of Object.keys(p)) {
				streamKeys.add(k);
			}
		}
		for (const v of Object.values(o)) {
			walk(v);
		}
	};
	walk(readJson(join(OUT, "claude-code-stream-json.json")));
	return streamKeys;
};

interface Shared {
	reg: Src;
	sites: Sites;
	common: Json;
	streamKeys: Set<string>;
	data: Json;
	policy: Map<string, string>;
}

/** The write sites of one entry type that describe it. */
const useSites = (t: string, x: Shared): Site[] => {
	const all = x.sites.get(t) ?? [];
	if (CHAIN.has(t)) {
		// Message constructors: they carry uuid, and no stream-json snake_case key.
		return all.filter((s) =>
			isTranscriptSite(
				t,
				keysOf(s.entries),
				x.streamKeys,
				s.src.text.slice(Math.max(0, s.at - 8), s.at),
			),
		);
	}
	const use = all.filter((s) => keysOf(s.entries).includes("sessionId"));
	return use.length === 0 ? all.filter((s) => s.src === x.reg) : use;
};

/** Add the keys a probe saw that no constructor has: find the later write of each. */
const addProbeKeys = (
	t: string,
	schema: Json,
	withType: Record<string, Json>,
	seen: unknown,
): void => {
	if (!isStringArray(seen)) {
		return;
	}
	const lost: string[] = [];
	for (const k of seen.filter((s) => !(s in withType))) {
		const site = laterWrite(k);
		if (site) {
			withType[k] = site;
		} else {
			lost.push(k);
		}
	}
	markObserved(schema, seen);
	if (lost.length > 0) {
		note(`transcript ${t}: probe keys with no write site: ${lost.join(", ")}`);
	}
};

/** The schema of one entry type; `noCode` collects types no code writes. */
const typeDef = (t: string, x: Shared, noCode: string[]): Json => {
	const use = useSites(t, x);
	const schema = objSchema(
		mergeEntries(use.map((s) => R.pin(s.entries))),
		"const",
	);
	// `type` is the discriminator, whatever the sites say.
	const withType: Record<string, Json> = { type: { const: t } };
	for (const [k, v] of Object.entries(props(schema))) {
		if (k !== "type") {
			withType[k] = v;
		}
	}
	schema["properties"] = withType;
	if (CHAIN.has(t)) {
		for (const [k, v] of Object.entries(props(x.common))) {
			if (!(k in withType)) {
				withType[k] = v;
			}
		}
	}
	if (use.length === 0) {
		noCode.push(t);
	}
	// toolUseResult is a tool's output data (an object, or an array or a string for some tools) or an error string.
	const tur = withType["toolUseResult"];
	if (t === "user" && tur !== undefined && tur["type"] === undefined) {
		tur["type"] = ["object", "string", "array"];
	}
	addProbeKeys(t, schema, withType, x.data[`line.${t}`]);
	schema["$comment"] =
		`Registry policy: ${x.policy.get(t) ?? "none"}. Code sites used: ${use.length}.${use.length > 0 ? "" : " The program reads this type, and no code in this build writes it, so only `type` is known."}`;
	return schema;
};

export const buildTranscript = (): { file: string; schema: Json } => {
	const reg = only(REGISTRY);
	const { types, policy } = readRegistry(reg);
	const probe = readJson(join(CAPTURES, "print/transcripts.lines.json"));
	const rawData = probe?.["data"];
	const x: Shared = {
		reg,
		sites: collectSites(types),
		common: commonFields(),
		streamKeys: streamKeysOf(),
		data: isJson(rawData) ? rawData : {},
		policy,
	};

	const $defs: Record<string, Json> = {};
	const noCode: string[] = [];
	for (const t of types) {
		$defs[t] = typeDef(t, x, noCode);
	}
	if (noCode.length > 0) {
		note(
			`transcript: read-only types (the program reads them, and no code in this build writes them): ${noCode.join(", ")}`,
		);
	}
	for (const k of Object.keys(x.data)) {
		if (k.startsWith("line.") && !types.includes(k.slice(5))) {
			note(`transcript: probe line type ${k.slice(5)} is not in the registry`);
		}
	}

	const ordered = Object.fromEntries(
		sortedKeys($defs).map((k): [string, Json] => [k, $defs[k] ?? {}]),
	);
	const out: Json = {
		...header(
			"claude-code-transcript.json",
			"Claude Code transcript JSONL entry",
			`For one line of a session transcript (.jsonl). Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: the entry type registry (an object literal whose first keys are user, assistant, system, attachment, mapped to "transcript"); the literal built in the writer's insertMessageChain (key logicalParentUuid) and its two spreads for the common fields of message lines; every object literal with a top-level type:"<entry type>" (non-message types need a sessionId key), with its spreads resolved in the module that declares each function (imports followed); and, for a key a probe saw that no such literal has, the later write: a copy of the line ({...line, key}), a function spread into one, or last a property assignment. Keys are the union over all write sites; a string value that differs between sites is an enum, and one that is a literal at one site and computed at another is x-unverified. Probe print/transcripts.lines.json marks the observed keys. Do not edit by hand.`,
		),
		type: "object",
		oneOf: Object.keys(ordered).map((t) => ({ $ref: `#/$defs/${t}` })),
		$defs: ordered,
	};
	return { file: "claude-code-transcript.json", schema: out };
};
