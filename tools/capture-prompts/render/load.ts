import { join } from "node:path";

import { normalizeHost, numberUuids } from "../normalize.ts";
import { SUB_MARK, type Variant, VARIANTS } from "../variants.ts";
import { CAPTURES, ctx, OUT } from "./ctx.ts";
import type { Cap, Part, Tool } from "./types.ts";

type Rec = Record<string, unknown>;
type Normalize = (s: string) => string;

const isRec = (v: unknown): v is Rec =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

const esc = (s: string) =>
	s.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const slug = (p: string) => p.replaceAll(/[^a-zA-Z0-9]/gu, "-");

const normalizer = (meta: { cwd: string; cfg: string; home: string }) => {
	const pairs: [RegExp, string][] = [];
	for (const [p, ph] of [
		[meta.cwd, "<project-slug>"],
		[meta.cfg, "<config-slug>"],
	] as const) {
		pairs.push(
			[new RegExp(esc(slug(p)), "gu"), ph],
			[new RegExp(esc(slug(p.replace(/^\/private/u, ""))), "gu"), ph],
		);
	}
	for (const [p, ph] of [
		[meta.cwd, "<cwd>"],
		[meta.cfg, "<config-dir>"],
		[meta.home, "<home>"],
	] as const) {
		for (const q of [p, p.replace(/^\/private/u, "")]) {
			pairs.push([new RegExp(esc(q), "gu"), ph]);
		}
	}
	const ids = numberUuids();
	return (s: string) => {
		let t = s;
		for (const [re, r] of pairs) {
			t = t.replace(re, r);
		}
		return ids(normalizeHost(t))
			.replaceAll(/\d{4}-\d\d-\d\d/gu, "<date>")
			.replaceAll(/\b[0-9a-f]{7,40}\b(?= initial)/gu, "<sha>")
			.replaceAll("🤖", "<robot-emoji>")
			.replaceAll(/\/plans\/[a-z]+(-[a-z]+)*\.md/gu, "/plans/<plan-name>.md");
	};
};

const blockText = (c: unknown): string => {
	if (!isRec(c)) {
		return "";
	}
	const type = str(c["type"]);
	return type === "text"
		? str(c["text"])
		: `[${type}] ${JSON.stringify(c["input"] ?? c["content"] ?? c).slice(0, 400)}`;
};

const blocks = (content: unknown): string[] =>
	typeof content === "string"
		? [content]
		: list(content).map((c) => blockText(c));

const readMeta = (v: unknown): { cwd: string; cfg: string; home: string } => {
	const m = isRec(v) ? v : {};
	return { cwd: str(m["cwd"]), cfg: str(m["cfg"]), home: str(m["home"]) };
};

/** The recorded `/v1/messages` requests of a capture, in order. */
const messageRequests = (jsonl: string): Rec[] =>
	jsonl
		.trim()
		.split("\n")
		.filter((l) => l !== "")
		.map((l): unknown => JSON.parse(l))
		.filter((r): r is Rec => isRec(r))
		.filter(
			(r) =>
				str(r["path"]).startsWith("/v1/messages") &&
				isRec(r["body"]) &&
				Boolean(r["body"]["messages"]),
		);

const bodyOf = (r: Rec): Rec => (isRec(r["body"]) ? r["body"] : {});

const pickRequest = (reqs: Rec[], v: Variant): Rec | undefined => {
	if (v.pick === "last") {
		return reqs.at(-1);
	}
	if (v.pick === "subagent") {
		return reqs.find((q) => {
			const j = JSON.stringify(bodyOf(q)["messages"]);
			return j.includes(SUB_MARK) && !j.includes("tool_result");
		});
	}
	if (v.pick === "marker") {
		return reqs.find(
			(q, i) =>
				i > 0 &&
				JSON.stringify([bodyOf(q)["system"], bodyOf(q)["messages"]]).includes(
					v.marker ?? "",
				),
		);
	}
	return reqs[0];
};

interface SysBlock {
	text: string;
	cacheControl: unknown;
}

const systemBlocks = (system: unknown): SysBlock[] =>
	typeof system === "string"
		? [{ text: system, cacheControl: undefined }]
		: list(system).map((s) => {
				const b = isRec(s) ? s : {};
				return { text: str(b["text"]), cacheControl: b["cache_control"] };
			});

const requestParts = (b: Rec, sys: SysBlock[], n: Normalize): Part[] => {
	const parts: Part[] = [];
	for (const [i, s] of sys.entries()) {
		const marker =
			s.cacheControl === undefined || s.cacheControl === null
				? "no cache marker"
				: `cache marker: ${JSON.stringify(s.cacheControl)}`;
		parts.push({ label: `system[${i}] (${marker})`, text: n(s.text) });
	}
	for (const [i, m] of list(b["messages"]).entries()) {
		const msg = isRec(m) ? m : {};
		for (const [j, t] of blocks(msg["content"]).entries()) {
			parts.push({
				label: `messages[${i}].content[${j}] (role: ${str(msg["role"])})`,
				text: n(t),
			});
		}
	}
	return parts;
};

const requestTools = (b: Rec, n: Normalize): Tool[] =>
	list(b["tools"]).map((raw) => {
		const t = isRec(raw) ? raw : {};
		const desc = str(t["description"]);
		const schema = t["input_schema"] ?? {};
		return {
			name: str(t["name"]),
			desc: desc.length,
			schema: JSON.stringify(schema).length,
			text: n(desc),
			schemaText: JSON.stringify(schema, null, 2),
		};
	});

const EMPTY_CAP = (v: Variant): Cap => ({
	v,
	text: "",
	parts: [],
	chars: 0,
	tools: [],
	sections: [],
	model: "",
	ok: false,
});

export const load = async (v: Variant): Promise<Cap> => {
	const dir = join(CAPTURES, v.id);
	const metaRaw: unknown = JSON.parse(
		await Bun.file(join(dir, "meta.json")).text(),
	);
	const n = normalizer(readMeta(metaRaw));
	const reqs = messageRequests(
		await Bun.file(join(dir, "requests.jsonl")).text(),
	);
	const r = pickRequest(reqs, v);
	if (!r) {
		return EMPTY_CAP(v);
	}
	const b = bodyOf(r);
	const sys = systemBlocks(b["system"]);
	const parts = requestParts(b, sys, n);
	const text = parts
		.map((p) => `=== ${p.label} ===\n${p.text.replace(/\s+$/u, "")}\n`)
		.join("\n");
	const sections = [
		...new Set(
			sys.flatMap((s) =>
				[...n(s.text).matchAll(/^# (.+)$/gmu)].map((m) => m[1] ?? ""),
			),
		),
	];
	return {
		v,
		text,
		parts,
		chars: text.length,
		tools: requestTools(b, n),
		sections,
		model: str(b["model"]),
		ok: true,
	};
};

type Loaded =
	| { v: Variant; status: "missing" }
	| { v: Variant; status: "empty" }
	| { v: Variant; status: "ok"; cap: Cap };

const loadOne = async (v: Variant): Promise<Loaded> => {
	if (!(await Bun.file(join(CAPTURES, v.id, "meta.json")).exists())) {
		return { v, status: "missing" };
	}
	const cap = await load(v);
	return cap.ok ? { v, status: "ok", cap } : { v, status: "empty" };
};

export const loadCaps = async (): Promise<void> => {
	const loaded = await Promise.all(VARIANTS.map((v) => loadOne(v)));
	const writes: Promise<number>[] = [];
	for (const l of loaded) {
		if (l.status === "missing") {
			console.info(`skip ${l.v.id}: not captured`);
		} else if (l.status === "empty") {
			console.info(`skip ${l.v.id}: no matching request`);
		} else {
			ctx.caps.set(l.v.id, l.cap);
			writes.push(Bun.write(join(OUT, `${l.v.id}.txt`), l.cap.text));
		}
	}
	await Promise.all(writes);
};

export const findDups = () => {
	const seen = new Map<string, string>();
	for (const [id, c] of ctx.caps) {
		const h = Bun.hash(c.text + JSON.stringify(c.tools)).toString();
		const first = seen.get(h);
		if (first === undefined) {
			seen.set(h, id);
		} else {
			ctx.dupOf.set(id, first);
		}
	}
};
