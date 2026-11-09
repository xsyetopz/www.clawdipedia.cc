import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { type Mitm, startMitm } from "../../../lib/mitm.ts";
import {
	type CaseDef,
	msgs,
	type Run,
	type Spec,
	withRun,
} from "../run/helpers.ts";
import { grep, one } from "./one.ts";

const OPEN_SCRIPT = `#!/bin/sh\nfor a in "$@"; do case "$a" in http*) u="$a";; esac; done\nr=$(printf %s "$u" | sed -n 's/.*redirect_uri=\\([^&]*\\).*/\\1/p' | sed 's/%3A/:/g;s/%2F/\\//g')\ns=$(printf %s "$u" | sed -n 's/.*[?&]state=\\([^&]*\\).*/\\1/p')\ncurl -s --noproxy '*' "$r?code=probe-code&state=$s" >/dev/null &\nexit 0\n`;

const TOKEN = {
	access_token: "probe-access",
	refresh_token: "probe-refresh",
	expires_in: 3600,
	token_type: "Bearer",
	scope: "org:create_api_key user:profile",
	account: { uuid: "probe-account", email_address: "probe@example.invalid" },
	organization: { uuid: "probe-org", name: "probe" },
};

const upstream = (req: Request, url: URL): Response => {
	if (url.pathname === "/v1/oauth/token") {
		return Response.json(TOKEN);
	}
	if (url.pathname.endsWith("/create_api_key")) {
		return Response.json({});
	}
	return Response.json(
		{ path: url.pathname, method: req.method },
		{ status: 404 },
	);
};

const loginSpec = (mitm: Mitm): Spec => ({
	auth: "none",
	setup: async (sb) => {
		const open = join(sb.home, ".probe-bin", "open");
		await Bun.write(open, OPEN_SCRIPT);
		await chmod(open, 0o755);
	},
	env: {
		NODE_EXTRA_CA_CERTS: mitm.caFile,
		HTTPS_PROXY: mitm.proxyUrl,
		BROWSER: "{HOME}/.probe-bin/open",
	},
	allowOverride: ["HTTPS_PROXY"],
	argv: ["auth", "login", "--console"],
	timeoutMs: 30_000,
});

const loginResult = async (r: Run, mitm: Mitm) => ({
	from: r,
	data: {
		exit: r.code,
		timedOut: r.timedOut,
		tlsPaths: mitm
			.log()
			.map((l) => `${l.method} ${l.path} ${l.status}`)
			.join(", "),
	},
	samples: { text: await grep(r, /Unable to create API key|rror|^err: \S/u) },
});

// A stand-in `open` plays the browser: it calls the program's localhost callback with the state of the sign-in URL. A local TLS stub answers the token exchange with no inference scope, and create_api_key with no key.
const consoleLogin: CaseDef = {
	name: "console-login-no-key",
	run: async (ctx) => {
		const mitm = await startMitm({
			tunnelOthers: false,
			hosts: ["platform.claude.com"],
			upstream,
		});
		try {
			return await withRun(ctx, loginSpec(mitm), (r) => loginResult(r, mitm));
		} finally {
			await mitm.stop();
		}
	},
};

const RUNNER_SPEC: Spec = {
	cfgFiles: {
		"settings.json": JSON.stringify({
			hooks: {
				PreToolUse: [
					{
						matcher: "self_hosted_runner_spawn_local",
						hooks: [{ type: "command", command: 'rm -f "$PROBE_BIN"' }],
					},
				],
			},
		}),
	},
	args: [
		"--permission-mode",
		"bypassPermissions",
		"--tools",
		"self_hosted_runner_spawn_local",
	],
	stub: {
		seq: [
			{
				name: "self_hosted_runner_spawn_local",
				input: { secret_file_path: "{HOME}/secret" },
			},
		],
	},
};

// The runner tool spawns the program's own file. The case runs a copy, and a PreToolUse hook deletes the copy before the tool call.
const runnerSpawn: CaseDef = {
	name: "runner-spawn-missing-binary",
	run: async (ctx) => {
		const dir = await mkdtemp(join(tmpdir(), "probe-bin-"));
		const bin = join(dir, "claude");
		try {
			await copyFile(ctx.bin, bin);
			return await withRun(
				{ ...ctx, bin },
				{ ...RUNNER_SPEC, env: { PROBE_BIN: bin } },
				async (r) => ({
					from: r,
					data: { exit: r.code, requests: msgs(r).length },
					samples: {
						text: await grep(r, /Failed to spawn runner|^tool_result/u),
					},
				}),
			);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	},
};

export const loginCases: CaseDef[] = [
	consoleLogin,
	runnerSpawn,
	// A `.invalid` name never resolves (RFC 6761), so the host check fails before a socket opens.
	one(
		"monitor-ws-unresolvable",
		{
			args: ["--permission-mode", "bypassPermissions", "--tools", "Monitor"],
			stub: {
				seq: [
					{
						name: "Monitor",
						input: {
							description: "probe",
							ws: { url: "ws://cc-probe.invalid/" },
						},
					},
				],
			},
		},
		/could not resolve/u,
	),
];
