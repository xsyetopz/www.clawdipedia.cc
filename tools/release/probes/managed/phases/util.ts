// Types and helpers of the managed phases: the phase context, a case definition, the run readers, the shared fixtures.
import type { Data } from "../../../lib/results.ts";
import {
	arr,
	type Case,
	events,
	msgs,
	obj,
	type Run,
} from "../../print/run.ts";
import { srvDef } from "../fixtures.ts";

export interface PhaseCtx {
	version: string;
	bin: string;
	/** MCP probe servers append here; truncated before each case. */
	startedLog: string;
	only?: string[] | undefined;
	dry: boolean;
}

export interface Out {
	data: Record<string, Data>;
	samples?: Record<string, string>;
	facts?: string[];
}
export interface Def {
	/** Case name inside the phase. */
	name: string;
	c: Case;
	/** Turn the run into data. `started` is the list of MCP servers that started. */
	data: (r: Run, x: Ex) => Out;
	notes?: string;
}
export interface Ex {
	main: Obj | undefined;
	mainText: string;
	init: Obj | undefined;
	started: string[];
	classifierRequests: number;
}
export type Obj = Record<string, unknown>;

export const isCls = (b: unknown): boolean =>
	JSON.stringify(obj(b)["system"] ?? "").includes(
		"security monitor for autonomous AI coding agents",
	);
export const has = (t: string, m: string): boolean => t.includes(m);
export const toolNames = (b: Obj | undefined): string[] =>
	arr(b?.["tools"]).map((t) => String(obj(t)["name"]));
export const head = (t: string, n = 12): string =>
	t.trim().split("\n").slice(0, n).join("\n");

export const extend = (r: Run, started: string[]): Ex => {
	const all = msgs(r);
	const main = all.find((x) => !isCls(x.body));
	const body = main ? obj(main.body) : undefined;
	return {
		main: body,
		mainText: body ? JSON.stringify(body) : "",
		init: events(r).find(
			(e) => e["type"] === "system" && e["subtype"] === "init",
		),
		started,
		classifierRequests: all.filter((x) => isCls(x.body)).length,
	};
};

export const userCfg = (extra: Obj = {}): string =>
	JSON.stringify({ enableAllProjectMcpServers: true, ...extra });

/** Shared fixtures: user CLAUDE.md, user MCP server, project CLAUDE.md and .mcp.json. */
export const base = (ctx: PhaseCtx, c: Case): Case => ({
	...c,
	cfgFiles: {
		"CLAUDE.md": "PROBE-USER-MD\n",
		".claude.json": JSON.stringify({
			hasCompletedOnboarding: true,
			mcpServers: { user_srv: srvDef("user_srv", ctx.startedLog) },
		}),
		"settings.json": userCfg(),
		...c.cfgFiles,
	},
	projFiles: {
		"CLAUDE.md": "PROBE-PROJ-MD\n",
		".mcp.json": JSON.stringify({
			mcpServers: { proj_srv: srvDef("proj_srv", ctx.startedLog) },
		}),
		...c.projFiles,
	},
});
