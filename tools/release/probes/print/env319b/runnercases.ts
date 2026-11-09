import type { CaseDef } from "../run/helpers.ts";
import { gateway, offline, orchestrator, runnerSession } from "./runner.ts";

const UR = ["ultrareview", "1", "--trust-workspace"];
const BAD_CONFIG = ["gateway", "--config", "/nonexistent/gw.json"];
const STALE = { CLAUDE_RUNNER_SPAWN_REASON: "stale" };

export const runnerCases: CaseDef[] = [
	runnerSession("base", {}),
	runnerSession("renewal-unset", {}, true),
	runnerSession(
		"renewal-disabled",
		{ CLAUDE_RUNNER_DISABLE_RENEWAL_WARNING: "1" },
		true,
	),
	runnerSession("offers-1", { CLAUDE_RUNNER_OFFERS_NEW_MACHINE: "1" }),
	runnerSession("update-bin", { CLAUDE_RUNNER_UPDATE_BIN: "/probe/up" }),
	orchestrator("reason-set", { spawn_reason: "runner_lost" }, STALE),
	orchestrator("hook-fails", {}, {}, "echo boom >&2\nexit 1\n"),
	runnerSession("child-exits-1", {}, false, "exit 1"),
	runnerSession("token-ttl-8", {}, false, undefined, 8),
	runnerSession("retire-at", {}, false, undefined, undefined, () => [
		"--retire-at",
		String(Math.floor(Date.now() / 1000) + 7),
	]),
	runnerSession("child-exits-0", {}, false, "exit 0"),
	orchestrator("reason-none", {}, STALE),
	orchestrator("reason-token", { spawn_reason: "Runner.Lost-1_x" }, {}),
	orchestrator("reason-long", { spawn_reason: "a".repeat(200) }, {}),
	orchestrator("reason-upper-colon", { spawn_reason: "A:b" }, {}),
	orchestrator("reason-bad", { spawn_reason: "bad value!" }, {}),
	offline("ur-base", UR, {}),
	offline("ur-record", UR, {
		CLAUDE_CODE_ULTRAREVIEW_LAUNCH_RECORD: "{HOME}/ur-record",
	}),
	gateway("help", ["gateway", "--help"], {}),
	gateway("cmds", ["--help"], {}),
	gateway("ur-help", ["ultrareview", "--help"], {}),
	gateway("runner-help", ["self-hosted-runner", "--help"], {}),
	gateway("bad-config-default", BAD_CONFIG, {}),
	gateway("bad-config-json", BAD_CONFIG, { CLAUDE_GATEWAY_LOG_FORMAT: "json" }),
	gateway("bad-config-JSON-upper", BAD_CONFIG, {
		CLAUDE_GATEWAY_LOG_FORMAT: "JSON",
	}),
	gateway("bad-config-text", BAD_CONFIG, { CLAUDE_GATEWAY_LOG_FORMAT: "text" }),
];
