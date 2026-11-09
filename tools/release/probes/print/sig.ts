// Run signature and diff, ported from p305-print/base.ts. A signature is a flat map of strings that describes
// what one program run sent (headers, body parts, init event, hook env, files). Used by the sweep and request probes.
import { dirname, join } from "node:path";

import { normalise } from "../../lib/results.ts";
import type { LoggedRequest } from "../../lib/stub.ts";
import {
	arr,
	type Case,
	dispose,
	events,
	listFiles,
	msgs,
	obj,
	readIf,
	type Run,
	runCase,
} from "./run.ts";

const MCP_SERVER = `
let buf="";
process.stdin.on("data",d=>{buf+=d;let i;while((i=buf.indexOf("\\n"))>=0){const l=buf.slice(0,i);buf=buf.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}
 const send=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");
 if(m.method==="initialize")send({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"probe",version:"1"}});
 else if(m.method==="tools/list")send({tools:[{name:"ping",description:"ping",inputSchema:{type:"object",properties:{}}}]});
 else if(m.id!==undefined)send({});
}});
`;

/** Baseline A: plain print run. */
export const baselineA = (): Case => ({});

const hk = (ev: string) => ({
	hooks: [
		{
			type: "command",
			command: `cat >> {CFG}/hook.log; echo >> {CFG}/hook.log; env | cut -d= -f1 | sort > {CFG}/hookenv.${ev}`,
		},
	],
});

/** Baseline B: one Bash tool turn, a plugin (skill + MCP server), and a logging hook on five events. */
export const baselineB = (): Case => {
	const hooks: Record<string, unknown> = {};
	for (const ev of [
		"SessionStart",
		"UserPromptSubmit",
		"PreToolUse",
		"PostToolUse",
		"Stop",
	]) {
		hooks[ev] = [
			{ ...(ev.includes("Tool") ? { matcher: "Bash" } : {}), ...hk(ev) },
		];
	}
	return {
		tool: "Bash",
		toolInput: { command: "echo hi" },
		args: ["--allowedTools", "Bash", "--plugin-dir", "{HOME}/plug"],
		cfgFiles: { "settings.json": JSON.stringify({ hooks }) },
		homeFiles: {
			"plug/.claude-plugin/plugin.json": JSON.stringify({
				name: "pp",
				version: "1.0.0",
				description: "probe plugin",
			}),
			"plug/skills/pskill/SKILL.md":
				"---\nname: pskill\ndescription: Probe skill\n---\nDo nothing.\n",
			"plug/srv.js": MCP_SERVER,
			"plug/.mcp.json": JSON.stringify({
				mcpServers: { psrv: { command: "bun", args: ["{HOME}/plug/srv.js"] } },
			}),
		},
	};
};

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gu;
const norm0 = (s: string, r: Run): string =>
	s
		.split(r.sb.cfg)
		.join("<CFG>")
		.split(r.sb.home)
		.join("<HOME>")
		.split(r.sb.proj)
		.join("<PROJ>")
		.split(dirname(r.sb.cfg))
		.join("<ROOT>")
		.replaceAll(UUID, "<U>")
		.replaceAll(/\d{4}-\d\d-\d\dT[\d:.]+Z/gu, "<TS>")
		.replaceAll(
			/"(duration_ms|duration_api_ms|total_cost_usd|ttft_ms)":[\d.]+/gu,
			'"$1":0',
		)
		.replaceAll(/cc_version=[\d.]+\.[0-9a-f]{3}/gu, "cc_version=<VER>.XXX")
		.replaceAll(/[0-9a-f]{64}/gu, "<DEV>")
		.replaceAll(/\.backup\.\d+/gu, ".backup.N")
		.replaceAll(/ccrel-[A-Za-z0-9]+/gu, "ccrel-X")
		.replaceAll(/\d{4}-\d\d-\d\dT\d\d-\d\d-\d\d-\d+Z/gu, "<TS>")
		.replaceAll(/sessions\/\d+\.json/gu, "sessions/<pid>.json")
		.replaceAll(/OS Version: [^"\\\n]*/gu, "OS Version: <os>");
const norm = (s: string, r: Run): string => normalise(norm0(s, r));

export type Sig = Record<string, string>;
const json = (x: unknown): string => JSON.stringify(x) ?? "undefined";
const str = (v: unknown): string =>
	typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);

const msgSig = (x: LoggedRequest, i: number, r: Run, out: Sig): void => {
	const h = x.headers;
	const b = obj(x.body);
	const k = `m${i}`;
	out[`${k}.beta`] = h["anthropic-beta"] ?? "<none>";
	out[`${k}.hdrnames`] = (x.headerNames ?? Object.keys(h))
		.filter((n) => !["host", "content-length"].includes(n))
		.toSorted()
		.join(",");
	out[`${k}.ua`] = h["user-agent"] ?? "";
	out[`${k}.system`] = norm(json(b["system"]), r);
	out[`${k}.tools`] = arr(b["tools"])
		.map((t) => String(obj(t)["name"]))
		.join(",");
	out[`${k}.bodykeys`] = Object.keys(b).join(",");
	out[`${k}.thinking`] =
		json(b["thinking"]) +
		json(b["output_config"]) +
		json(b["context_management"]) +
		String(b["max_tokens"]) +
		String(b["model"]);
	out[`${k}.metadata`] = norm(json(b["metadata"]), r);
	out[`${k}.messages`] = norm(json(b["messages"]), r);
};

const INIT_SKIP = new Set([
	"session_id",
	"uuid",
	"cwd",
	"memory_paths",
	"messaging_socket_path",
]);

const eventKind = (e: Record<string, unknown>): string => {
	const content = arr(obj(e["message"])["content"]);
	const sub =
		e["subtype"] ??
		(content.length > 0
			? content.map((c) => String(obj(c)["type"])).join("+")
			: "");
	return `${str(e["type"])}/${str(sub)}`;
};

const eventSig = (r: Run, out: Sig): void => {
	const ev = events(r);
	out["events"] = ev.map((e) => eventKind(e)).join(" ");
	const init = ev.find((e) => e["subtype"] === "init");
	if (init) {
		out["initkeys"] = Object.keys(init).join(",");
		for (const k of Object.keys(init)) {
			if (!INIT_SKIP.has(k)) {
				out[`init.${k}`] = norm(json(init[k]), r);
			}
		}
	}
	out["evkeys"] = ev
		.map((e) => `${str(e["type"])}:${Object.keys(e).join(",")}`)
		.join("|");
};

const SKIP_CFG =
	/^(projects|session-env|shell-snapshots|todos|statsig|\.claude\.json\.backup)/u;
const ENV_NOISE = /^(PWD|OLDPWD|SHLVL|_|TMPDIR)$/u;

const fileSig = async (r: Run, out: Sig): Promise<void> => {
	const cfg = await listFiles(r.sb.cfg);
	const home = await listFiles(r.sb.home);
	out["cfgfiles"] = cfg
		.filter((f) => !SKIP_CFG.test(f))
		.map((f) => norm(f, r))
		.join(",");
	out["homefiles"] = home
		.filter((f) => !f.startsWith("plug/") && !f.startsWith("tmp/"))
		.map((f) => norm(f, r))
		.join(",");
	const henv = cfg.filter((f) => f.startsWith("hookenv."));
	const texts = await Promise.all(henv.map((f) => readIf(join(r.sb.cfg, f))));
	for (const [i, f] of henv.entries()) {
		out[`henv.${f}`] = (texts[i] ?? "")
			.split("\n")
			.filter((x) => !ENV_NOISE.test(x))
			.join(",");
	}
};

export const sig = async (r: Run): Promise<Sig> => {
	const out: Sig = {};
	const m = msgs(r);
	out["nreq"] = `${r.reqs.length}/${m.length}`;
	out["paths"] = [...new Set(r.reqs.map((x) => x.path))].toSorted().join(" ");
	for (const [i, x] of m.entries()) {
		msgSig(x, i, r, out);
	}
	eventSig(r, out);
	await fileSig(r, out);
	out["code"] = String(r.code);
	out["stderr"] = norm(r.stderr, r).slice(0, 300);
	return out;
};

export const diffSig = (a: Sig, b: Sig): string[] =>
	[...new Set([...Object.keys(a), ...Object.keys(b)])].filter(
		(k) => a[k] !== b[k],
	);

/** A `cap`-long window of each value from just before their first difference, so a shared prefix does not hide it. */
export const diffSample = (
	a: string,
	b: string,
	cap = 400,
): [string, string] => {
	if (a.length <= cap && b.length <= cap) {
		return [a, b];
	}
	let i = 0;
	while (i < a.length && i < b.length && a[i] === b[i]) {
		i++;
	}
	const start = Math.max(0, i - Math.floor(cap / 4));
	const cut = (s: string) =>
		(start > 0 ? "…" : "") + s.slice(start, start + cap - (start > 0 ? 1 : 0));
	return [cut(a), cut(b)];
};

export interface Baseline {
	sig: Sig;
	/** keys that differ between two identical runs */
	noise: string[];
	/** probe still valid: exit 0, an init event, and for B the hook and tool ran */
	valid: boolean;
	why: string;
}

/** Run a baseline twice; the keys that differ between the two are noise and must be ignored later. */
export const stableBaseline = async (
	bin: string,
	mk: () => Case,
	needHook: boolean,
): Promise<Baseline> => {
	const a = await runCase(bin, mk());
	const sa = await sig(a);
	const hookRan = (await readIf(join(a.sb.cfg, "hook.log"))) !== "";
	const hasInit = events(a).some((e) => e["subtype"] === "init");
	const ok = a.code === 0;
	await dispose(a);
	const b = await runCase(bin, mk());
	const sb = await sig(b);
	await dispose(b);
	const why = [
		ok ? "" : `exit ${a.code}`,
		hasInit ? "" : "no init event",
		needHook && !hookRan ? "hook did not run" : "",
	]
		.filter(Boolean)
		.join("; ");
	return { sig: sa, noise: diffSig(sa, sb), valid: !why, why };
};
