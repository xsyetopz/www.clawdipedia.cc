import type { CaseDef } from "../run/helpers.ts";
import { hooksOff, inert } from "./inert.ts";

const RESTRICTED = { CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG: "1" };
const REMOTE = { CLAUDE_CODE_REMOTE: "true" };

export const inertCases: CaseDef[] = [
	inert("tunnel-binary-frames", {
		CLAUDE_CODE_MCP_SERVE_TUNNEL_BINARY_FRAMES: "1",
	}),
	inert("native-app-bundle", { CLAUDE_CODE_NATIVE_APP_BUNDLE: "1" }),
	inert("normalize-prefix-cache", { CLAUDE_CODE_NORMALIZE_PREFIX_CACHE: "1" }),
	inert("normalize-prefix-cache-verify", {
		CLAUDE_CODE_NORMALIZE_PREFIX_CACHE: "1",
		CLAUDE_CODE_NORMALIZE_PREFIX_CACHE_VERIFY: "1",
	}),
	inert("personal-hooks-off-plain", {
		CLAUDE_CODE_PERSONAL_HOOKS_OFF: "launch",
	}),
	inert(
		"personal-hooks-off-restricted",
		{ CLAUDE_CODE_PERSONAL_HOOKS_OFF: "launch" },
		RESTRICTED,
	),
	inert(
		"personal-hooks-off-host",
		{ CLAUDE_CODE_PERSONAL_HOOKS_OFF: "host" },
		RESTRICTED,
	),
	inert("use-case-id", { CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe_case_1" }),
	inert("use-case-id-stamped", {
		CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe_case_1",
		CLAUDE_CODE_PROGRAM_USE_CASE_STAMPED: "1",
	}),
	inert("resume-hint-flags", {
		CLAUDE_CODE_RELAUNCH_RESUME_HINT_FLAGS: "--model sonnet",
	}),
	inert("remote-stall-interval", {
		CLAUDE_CODE_REMOTE_STALL_CHECK_INTERVAL_MS: "1000",
	}),
	inert(
		"remote-stall-interval-remote",
		{ CLAUDE_CODE_REMOTE_STALL_CHECK_INTERVAL_MS: "1000" },
		REMOTE,
	),
	inert("resume-cache-warm", { CLAUDE_CODE_RESUME_CACHE_WARM: "1" }),
	inert(
		"resume-cache-warm-remote",
		{ CLAUDE_CODE_RESUME_CACHE_WARM: "1" },
		REMOTE,
	),
	inert("spare-keeps-boot-session-id", {
		CLAUDE_CODE_SPARE_KEEPS_BOOT_SESSION_ID: "1",
	}),
	inert("stream-timer-slack", { CLAUDE_CODE_STREAM_TIMER_SLACK_MS: "100" }),
	inert("teleport-move", { CLAUDE_CODE_TELEPORT_MOVE: "1" }),
	inert("thread-cpu-one-in", { CLAUDE_CODE_THREAD_CPU_ONE_IN: "1" }, REMOTE),
	inert("transcript-tail-load", { CLAUDE_CODE_TRANSCRIPT_TAIL_LOAD: "1" }),
	inert("ultrareview-launch-record", {
		CLAUDE_CODE_ULTRAREVIEW_LAUNCH_RECORD: "{HOME}/ur-record",
	}),
	hooksOff("unset-restricted", undefined, true),
	hooksOff("launch-restricted", "launch", true),
	hooksOff("retry-restricted", "retry", true),
	hooksOff("fix-restricted", "fix", true),
	hooksOff("host-restricted", "host", true),
	hooksOff("other-restricted", "banana", true),
	hooksOff("off-restricted", "off", true),
	hooksOff("host-plain", "host", false),
];
