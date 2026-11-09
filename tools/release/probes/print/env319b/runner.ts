import { chmod } from "node:fs/promises";

import {
	type CaseDef,
	type Run,
	show,
	type Spec,
	withRun,
} from "../run/helpers.ts";
import { b64u, lines, readOrNull, secret, uniquePaths } from "./util.ts";

/** `claude gateway` with a config file that does not exist: the error line shows the log format. */
export const gateway = (
	name: string,
	argv: string[],
	env: Record<string, string>,
): CaseDef => ({
	name: `gateway.${name}`,
	run: (ctx) =>
		withRun(ctx, { noPrompt: true, argv, env }, (r) => ({
			from: r,
			data: {
				precondition: r.stderr.length + r.stdout.length > 0,
				exit: r.code,
				jsonLine: r.stderr
					.split("\n")
					.some((l) => l.startsWith('{"severity":')),
				plainLine: /^claude gateway: /mu.test(r.stderr),
			},
			samples: {
				stderr: r.stderr.slice(0, 600),
				stdout: r.stdout.slice(0, 600),
			},
		})),
});

/** Commands that need a server, run against a closed local port. Each name is read only after the server answers. */
export const offline = (
	name: string,
	argv: string[],
	env: Record<string, string>,
): CaseDef => ({
	name: `offline.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				noPrompt: true,
				argv,
				env,
				timeoutMs: 20_000,
				homeFiles: { sec: "fake-secret" },
			},
			async (r) => {
				const record = await readOrNull(`${r.sb.home}/ur-record`);
				return {
					from: r,
					data: {
						precondition: r.stderr.length + r.stdout.length > 0,
						exit: r.code,
						recordFile: (record ?? "").length > 0,
					},
					samples: {
						stderr: r.stderr.slice(0, 500),
						stdout: r.stdout.slice(0, 300),
					},
				};
			},
		),
});

const orchestratorSpec = (
	hint: Record<string, unknown>,
	env: Record<string, string>,
	hookTail: string,
): Spec => ({
	noPrompt: true,
	argv: [
		"self-hosted-runner",
		"orchestrator",
		"--api-url",
		"{BASE}",
		"--environment-secret-file",
		"{HOME}/sec",
		"--hooks-dir",
		"{HOME}/hooks",
		"--health-port",
		"0",
		"--log-level",
		"debug",
	],
	env,
	timeoutMs: 8000,
	homeFiles: {
		sec: `sk-ant-oat-${secret}`,
		"hooks/spawn-runner": `#!/bin/sh\nprintf "%s" "\${CLAUDE_RUNNER_SPAWN_REASON-UNSET}" > "$HOME/hook-env"\n${hookTail}`,
	},
	setup: async (sb) => {
		await chmod(`${sb.home}/hooks/spawn-runner`, 0o755);
	},
	orchestrator: {
		secret: `sk-ant-oat-${secret}`,
		hints: [
			{
				session_uuid: "11111111-1111-4111-8111-111111111111",
				attempt: 1,
				jti: "jti-probe",
				work_order_jwt: `${b64u({ alg: "none" })}.${b64u({ jti: "jti-probe" })}.sig`,
				sources: [],
				...hint,
			},
		],
	},
	afterExit: async (sb) => ({
		hookSaw: await readOrNull(`${sb.home}/hook-env`),
	}),
});

const orchestratorOut = (r: Run) => ({
	from: r,
	data: {
		precondition: r.stdout.includes("[runner:orchestrator] starting"),
		hookSaw: show(r.after["hookSaw"] ?? "null"),
		paths: uniquePaths(r, false),
		okLine: lines(r.stdout, /ok session=/u, 2),
	},
	samples: {
		stdout: r.stdout.slice(0, 900),
		stderr: lines(r.stderr, /spawn_reason|spawn-hint/u, 3),
	},
});

/** Orchestrator mode: the stub serves one spawn hint; the spawn-runner hook writes what it sees to {HOME}/hook-env. */
export const orchestrator = (
	name: string,
	hint: Record<string, unknown>,
	env: Record<string, string>,
	hookTail = "",
): CaseDef => ({
	name: `orchestrator.${name}`,
	run: (ctx) =>
		withRun(ctx, orchestratorSpec(hint, env, hookTail), (r) =>
			orchestratorOut(r),
		),
});

const runnerSpec = (
	env: Record<string, string>,
	refuse: boolean,
	childBody: string,
	runnerTokenTtlS: number | undefined,
	extraArgv: () => string[],
): Spec => ({
	noPrompt: true,
	argv: [
		"self-hosted-runner",
		"--api-url",
		"{BASE}",
		"--environment-secret-file",
		"{HOME}/sec",
		"--base-dir",
		"{HOME}/base",
		"--log-level",
		"debug",
		"--exec-path",
		"{HOME}/fakeclaude",
		...extraArgv(),
	],
	env,
	timeoutMs: refuse ? 170_000 : 12_000,
	homeFiles: {
		sec: `sk-ant-oat-${secret}`,
		// stands in for the claude child: records its environment, then waits
		fakeclaude: `#!/bin/sh\nenv | grep "^CLAUDE_RUNNER_" | sort > "$HOME/child-env"\n${childBody}\n`,
	},
	setup: async (sb) => {
		await chmod(`${sb.home}/fakeclaude`, 0o755);
	},
	afterExit: async (sb) => ({
		childEnv: await readOrNull(`${sb.home}/child-env`),
	}),
	orchestrator: {
		secret: `sk-ant-oat-${secret}`,
		hints: [],
		assignment: "11111111-1111-4111-8111-111111111111",
		refuseRemote: refuse,
		...(runnerTokenTtlS !== undefined && { runnerTokenTtlS }),
	},
});

const runnerOut = (r: Run) => ({
	from: r,
	data: {
		precondition: r.stdout.length + r.stderr.length > 0,
		paths: uniquePaths(r, false),
		childEnv: show(r.after["childEnv"] ?? "null"),
		remoteFetches: r.reqs.filter((q) => q.path.endsWith("/remote")).length,
		warningEvents: r.reqs.filter((q) =>
			JSON.stringify(q.body).includes("model_access_renewal_refused"),
		).length,
	},
	samples: {
		stdout: r.stdout.slice(0, 1500),
		stderr: r.stderr.slice(-1200),
	},
});

/** Runner mode: the stub assigns one session; the case records which routes the runner calls and what it logs. */
export const runnerSession = (
	name: string,
	env: Record<string, string>,
	refuse = false,
	childBody = 'trap "exit 0" TERM\nwhile :; do sleep 1; done',
	runnerTokenTtlS?: number,
	extraArgv: () => string[] = () => [],
): CaseDef => ({
	name: `runner.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			runnerSpec(env, refuse, childBody, runnerTokenTtlS, extraArgv),
			(r) => runnerOut(r),
		),
});
