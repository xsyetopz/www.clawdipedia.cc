// 2.1.321 probes for the subcommands with their own argument parsers: remote-control, self-hosted-runner and its
// orchestrator, and the daemon subcommands that the help text leaves out. Each case records the lines the program printed.
// remote-control checks the sign-in, the base URL, the API key, the organization, and the bridge gate before it parses.
// With telemetry off and a max login, the program skips the gate fetch, so its cases carry a fake max login with an
// organization, the real base URL, and no API key. The sandbox HTTPS_PROXY is a dead port, so no request leaves the machine.
import { OAUTH_CREDS, one } from "./err319/one.ts";
import { type CaseDef, json, runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const ORG = json({
	oauthAccount: {
		organizationUuid: "00000000-0000-4000-8000-000000000000",
		accountUuid: "00000000-0000-4000-8000-000000000001",
		emailAddress: "probe@example.invalid",
	},
});

const ANY = /\S/u;
const DEAD_API = ["--api-url", "http://127.0.0.1:9"];

const rc = (name: string, args: string[]): CaseDef =>
	one(
		`rc-${name}`,
		{
			argv: ["remote-control", ...args],
			auth: "none",
			cfgFiles: { ".credentials.json": OAUTH_CREDS, ".claude.json": ORG },
			env: {
				ANTHROPIC_BASE_URL: "https://api.anthropic.com",
				CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
			},
			allowOverride: [
				"ANTHROPIC_BASE_URL",
				"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
			],
			timeoutMs: 20_000,
		},
		ANY,
	);

const runner = (name: string, args: string[]): CaseDef =>
	one(`runner-${name}`, { argv: ["self-hosted-runner", ...args] }, ANY);

const daemon = (name: string, args: string[]): CaseDef =>
	one(`daemon-${name}`, { argv: ["daemon", ...args] }, ANY);

export const CASES: CaseDef[] = [
	rc("sandbox", ["--sandbox"]),
	rc("no-sandbox", ["--no-sandbox"]),
	rc("settings-missing", ["--settings"]),
	rc("settings-json", ["--settings", '{"model":"opus"}']),
	rc("spawn-bad", ["--spawn", "tabs"]),
	rc("spawn-twice", ["--spawn", "worktree", "--spawn=same-dir"]),
	rc("capacity-zero", ["--capacity", "0"]),
	rc("capacity-twice", ["--capacity", "2", "--capacity=3"]),
	rc("capacity-session", ["--spawn", "session", "--capacity", "2"]),
	rc("continue-spawn", ["--continue", "--spawn", "worktree"]),
	rc("continue-session-id", ["-c", "--session-id", "abc"]),
	rc("session-id-empty", ["--session-id="]),
	rc("unattended-continue", ["--allow-unattended-tool-calls", "--continue"]),
	rc("live-preview", ["--enable-live-preview", "--preview-port", "3000"]),
	rc("preview-port-low", ["--preview-port", "80"]),
	rc("unknown", ["--model", "opus"]),
	runner("sigkill", [...DEAD_API, "--sigkill-timeout-sec", "5"]),
	runner("pool-secret-file", [
		...DEAD_API,
		"--pool-secret-file",
		"{HOME}/missing",
	]),
	runner("drain-wait-bg-tasks", [
		...DEAD_API,
		"--drain-wait-bg-tasks-sec",
		"x",
	]),
	runner("retire-at-ms", [...DEAD_API, "--retire-at", "1900000000000"]),
	runner("confine-bad", [...DEAD_API, "--confine-repo-settings", "strict"]),
	runner("lists-bad", [...DEAD_API, "--server-auto-mode-lists", "some"]),
	runner("snapshot-bad", [...DEAD_API, "--host-config-snapshot", "tmpfs"]),
	runner("host-config-dir-flag", [...DEAD_API, "--host-config-dir", "/tmp"]),
	runner("positional", [...DEAD_API, "start"]),
	runner("empty-argument", [...DEAD_API, ""]),
	runner("git-host-rewrite-url", [
		...DEAD_API,
		"--git-host-rewrite",
		"https://a=b",
	]),
	runner("orchestrator-min-idle", [
		"orchestrator",
		...DEAD_API,
		"--min-idle",
		"500",
	]),
	runner("orchestrator-hook-timeout", [
		"orchestrator",
		...DEAD_API,
		"--hook-timeout",
		"200",
	]),
	runner("orchestrator-scm-id-only", [
		"orchestrator",
		...DEAD_API,
		"--scm-connector-id",
		"4",
	]),
	runner("orchestrator-no-hooks", ["orchestrator", ...DEAD_API]),
	daemon("list", ["list"]),
	daemon("hub", ["hub"]),
	daemon("install", ["install"]),
	daemon("start", ["start"]),
	daemon("restart", ["restart"]),
	daemon("remote-control", ["remote-control", "list"]),
	daemon("unknown", ["bogus"]),
];

export const cli321: PrintGroup = {
	id: "cli321",
	title:
		"2.1.321: hand-parsed subcommands (remote-control, self-hosted-runner, daemon)",
	run: (ctx) => runCases(ctx, "cli321", CASES),
};
