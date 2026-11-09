// Live look at the 2.1.319 API surface that a fake key cannot reach: the tool-provenance beta, and the paths that startup
// and the org pin call. Runs `-p` with the real token behind the local proxy. Only paths, beta names and tool names are kept;
// ownership_metadata is reduced to its key names, and the output of the child is dropped (the org-pin error prints an org id).
import { liveEnv } from "../../lib/live/env.ts";
import { type Mitm, startMitm } from "../../lib/mitm.ts";
import { runChild } from "../../lib/proc.ts";
import type { Data } from "../../lib/results.ts";
import type { Sandbox } from "../../lib/sandbox.ts";
import { assertShimReady } from "../../lib/shim.ts";
import { httpServer, writeMcp } from "./api319/mcp.ts";
import { type Seen, seenOf } from "./api319/seen.ts";
import {
	baseResult,
	type LiveCase,
	type LiveCtx,
	liveSandbox,
	PROMPT,
} from "./harness.ts";

// A UUID no account has, so the pin always fails and the run ends after the org check.
const OTHER_ORG = "00000000-0000-4000-8000-000000000000";

interface Opts {
	nonessential?: boolean;
	pin?: boolean;
	mcp?: "stdio" | "http";
	remoteCowork?: boolean;
}

const startApiMitm = (x: LiveCtx, seen: Seen[]): Promise<Mitm> =>
	startMitm({
		onMessages: (r) => {
			seen.push(seenOf(r.body, r.betas));
		},
		...(x.dry
			? {
					tunnelOthers: false,
					upstream: () =>
						new Response("{}", {
							status: 404,
							headers: { "content-type": "application/json" },
						}),
				}
			: {}),
	});

const apiEnv = (x: LiveCtx, sb: Sandbox, mitm: Mitm, o: Opts) =>
	liveEnv({
		home: sb.home,
		configDir: sb.cfg,
		token: x.token,
		mitm,
		extra: {
			...(o.mcp === undefined ? {} : { ENABLE_TOOL_SEARCH: "false" }),
			// The entry point that gives the auth warm its known credential lifetime.
			...(o.remoteCowork === true
				? {
						CLAUDE_CODE_REMOTE: "1",
						CLAUDE_CODE_ENTRYPOINT: "remote_cowork",
					}
				: {}),
		},
		...(o.nonessential === true ? { allowNonessential: true } : {}),
	});

const apiArgv = (x: LiveCtx, o: Opts, mcpCfg: string | undefined): string[] => [
	x.bin,
	"-p",
	PROMPT,
	...(mcpCfg === undefined ? [] : ["--mcp-config", mcpCfg]),
	...(o.pin === true
		? ["--managed-settings", JSON.stringify({ forceLoginOrgUUID: OTHER_ORG })]
		: []),
];

const apiData = (o: Opts, seen: Seen[], mitm: Mitm): Record<string, Data> => {
	const a = seen[0];
	return {
		precondition: o.pin ?? a !== undefined,
		"mitm.paths": [
			...new Set(mitm.log().map((l) => `${l.method} ${l.path} ${l.status}`)),
		].toSorted(),
		"mitm.connects": [...new Set(mitm.connects())].toSorted(),
		"live.requests": seen.length,
		...(a === undefined
			? {}
			: {
					betas: a.betas,
					"betas.hasToolProvenance": a.betas.includes(
						"tool-provenance-2026-10-26",
					),
					bodyKeys: a.bodyKeys,
					"tools.withOwnershipMetadata": a.owned,
					"tools.mcp": a.mcp,
				}),
	};
};

const notesOf = (o: Opts): string =>
	`${o.remoteCowork === true ? "CLAUDE_CODE_REMOTE=1 and CLAUDE_CODE_ENTRYPOINT=remote_cowork. " : ""}${o.pin === true ? "The hidden --managed-settings flag pins forceLoginOrgUUID to an id no account has. " : ""}${o.nonessential === true ? "Nonessential traffic is allowed. " : ""}Real token behind a local proxy with a throw-away CA. Kept: paths, beta names, tool names and the key names of ownership_metadata. No header, body text or child output is kept.`;

const apiCase = (id: string, title: string, o: Opts): LiveCase => ({
	id,
	title,
	requests: o.pin === true ? "none (the pin fails first)" : "1 live",
	run: async (x: LiveCtx) => {
		const sb = await liveSandbox();
		const seen: Seen[] = [];
		const mitm = await startApiMitm(x, seen);
		const http = o.mcp === "http" ? httpServer() : undefined;
		try {
			const mcpCfg = o.mcp === undefined ? undefined : await writeMcp(sb, http);
			const env = apiEnv(x, sb, mitm, o);
			await assertShimReady(env);
			const res = await runChild(apiArgv(x, o, mcpCfg), {
				cwd: sb.proj,
				env,
				timeoutMs: 120_000,
			});
			return [
				baseResult(x, id, {
					args: ["-p"],
					exit: res.code,
					timedOut: res.timedOut,
					data: apiData(o, seen, mitm),
					notes: notesOf(o),
				}),
			];
		} finally {
			await http?.stop(true);
			await mitm.stop();
			await sb.cleanup();
		}
	},
});

export const api319Cases: LiveCase[] = [
	apiCase(
		"api319.provenance",
		"Betas and ownership_metadata with the real login",
		{},
	),
	apiCase(
		"api319.provenance-mcp",
		"ownership_metadata with a stdio MCP tool, tool search off",
		{
			mcp: "stdio",
		},
	),
	apiCase(
		"api319.provenance-http",
		"ownership_metadata with a local HTTP MCP tool, tool search off",
		{ mcp: "http" },
	),
	apiCase("api319.startup", "Startup paths with nonessential traffic on", {
		nonessential: true,
	}),
	apiCase(
		"api319.auth-warm",
		"Does the remote cowork entry point send GET /v1/me with the real login",
		// Essential-traffic mode turns the warm off, so nonessential traffic stays on.
		{ remoteCowork: true, nonessential: true },
	),
	apiCase("api319.org-pin", "Paths called when managed settings pin the org", {
		pin: true,
	}),
];
