// Print-mode cases where a tool host answers the model's tool call. For a case with `host`, the runner starts the host
// mock of tools/release/lib/stub/host.ts, adds its `env()` to the child, and puts `hostSdkUrl()` in place of `{SDK_URL}`.
import type { HostDisposition } from "../../../release/lib/stub/host.ts";
import type { Case } from "./case.ts";

// With telemetry off the disk cache of feature flags is read only when this variable is set.
const DISK_FLAGS = { CLAUDE_CODE_GB_DISK_CACHE_WHEN_TELEMETRY_OFF: "1" };
// tengu_violin_wood admits a host announce (chunk-0dgam5n0.js@31283: readAccountFlag).
const FLAGS = {
	cachedGrowthBookFeatures: {
		tengu_violin_wood: true,
		tengu_violin_strad: true,
	},
};

// The model calls Bash on the announced machine; `_host` names it.
const HOST_BASH = {
	kind: "message" as const,
	content: [
		{
			type: "tool_use" as const,
			id: "toolu_host1",
			name: "Bash",
			input: { command: "echo hi", description: "echo", _host: "testhost" },
		},
	],
	stop_reason: "tool_use" as const,
};
const DONE = {
	kind: "message" as const,
	content: [{ type: "text" as const, text: "done" }],
	stop_reason: "end_turn" as const,
};

const hostCase = (id: string, host: HostDisposition): Case => ({
	id,
	host,
	args: ["--sdk-url", "{SDK_URL}"],
	env: DISK_FLAGS,
	claudeJson: FLAGS,
	turns: [HOST_BASH, DONE],
	// the fake service delivers the user message over the worker stream; stdin only keeps the run open
	stdin: [25_000],
	// a worker session does not end by itself: stop it once the rows are written
	timeoutMs: 35_000,
});

/**
 * Cases that make the host answer a tool call. The mock's `disposition` option picks the answer:
 * `denied_by_rule` gives `toolDenialKind: "permission-rule"` and `denied_by_user` gives `"user-rejected"`;
 * both set `toolDenialFromHost: true` on the tool-result user row.
 */
export const HOST_CASES: Case[] = [
	hostCase("host-denied-by-rule", "denied_by_rule"),
	hostCase("host-denied-by-user", "denied_by_user"),
];
