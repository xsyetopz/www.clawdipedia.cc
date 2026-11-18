// Print-mode cases for telemetry sites that the other cases do not reach.
import type { Case } from "./case.ts";

// The tengu_snoopy_creek flag gates every safety_event (chunk-m14bt1pz.js:4521887). The flag has no local override in
// this build, so the case seeds the cached flags in .claude.json, which the flag reader falls back to.
const SAFETY = { cachedGrowthBookFeatures: { tengu_snoopy_creek: true } };

const INIT = {
	type: "control_request",
	request_id: "init-1",
	request: { subtype: "initialize" },
};

const user = (content: string) => ({
	type: "user",
	message: { role: "user", content },
});

const OFFICIAL = "claude-plugins-official";
const STAMP = "2026-01-01T00:00:00.000Z";
// An async hook whose answer fails the schema: "none" is not a decision.
const METRICS_HOOK = {
	hooks: {
		UserPromptSubmit: [
			{
				hooks: [
					{
						type: "command",
						command: `echo '{"async":true}'; sleep 1; echo '{"metrics":{"probe_count":1,"probe_flag":true},"decision":"none"}'`,
					},
				],
			},
		],
	},
};
const OFFICIAL_MARKET = {
	"m/.claude-plugin/marketplace.json": JSON.stringify({
		name: OFFICIAL,
		owner: { name: "probe" },
		plugins: [{ name: "probe", source: "./probe", version: "1.0.0" }],
	}),
	"m/probe/.claude-plugin/plugin.json": JSON.stringify({
		name: "probe",
		version: "1.0.0",
	}),
	"m/probe/hooks/hooks.json": JSON.stringify(METRICS_HOOK),
};
const OFFICIAL_PLUGIN = {
	"plugins/known_marketplaces.json": JSON.stringify({
		[OFFICIAL]: {
			source: { source: "github", repo: `anthropics/${OFFICIAL}` },
			installLocation: "{PROJ}/m",
			lastUpdated: STAMP,
		},
	}),
	"plugins/installed_plugins.json": JSON.stringify({
		version: 2,
		plugins: {
			[`probe@${OFFICIAL}`]: [
				{
					scope: "user",
					installPath: "{PROJ}/m/probe",
					version: "1.0.0",
					installedAt: STAMP,
					lastUpdated: STAMP,
				},
			],
		},
	}),
	"settings.json": JSON.stringify({
		enabledPlugins: { [`probe@${OFFICIAL}`]: true },
	}),
};

/** Cases that emit one OpenTelemetry site each. */
export const OTEL_CASES: Case[] = [
	{
		// The hook span goes only through the beta tracing switch: lI() needs ENABLE_BETA_TRACING_DETAILED and
		// BETA_TRACING_ENDPOINT (chunk-epqcnh2q.js:2569), and cFa() starts the span (chunk-epqcnh2q.js:21792) for
		// each matched command hook (chunk-m14bt1pz.js:4233288).
		id: "otel-hook-span",
		env: {
			ENABLE_BETA_TRACING_DETAILED: "1",
			BETA_TRACING_ENDPOINT: "{COLLECTOR}",
		},
		cfgFiles: {
			"settings.json": JSON.stringify({
				hooks: {
					UserPromptSubmit: [{ hooks: [{ type: "command", command: "true" }] }],
				},
			}),
		},
	},
	{
		// A Bash command that matches /\bgh\s+pr\s+create\b/ and exits 0 adds 1 to the counter (Rzr() in
		// chunk-qpav394c.js:513508). The command only prints the words; nothing runs gh.
		id: "otel-pull-request-count",
		seq: [{ name: "Bash", input: { command: "echo gh pr create" } }],
		args: ["--allowedTools", "Bash"],
	},
	{
		// set_permission_mode reaches $N(), which logs the change (chunk-7at7cxxb.js:9067); the same mode logs nothing.
		id: "otel-permission-mode",
		stdin: [
			INIT,
			1500,
			{
				type: "control_request",
				request_id: "mode-1",
				request: { subtype: "set_permission_mode", mode: "plan" },
			},
			1000,
			user("Reply with OK."),
		],
	},
	{
		// A deny rule refuses the Bash call; e2r() logs the decision with the permission_rule category
		// (chunk-m14bt1pz.js:4522600).
		id: "otel-safety-deny",
		claudeJson: SAFETY,
		cfgFiles: {
			"settings.json": JSON.stringify({
				permissions: { deny: ["Bash(rm:*)"] },
			}),
		},
		seq: [{ name: "Bash", input: { command: "rm -f probe-none.txt" } }],
	},
	{
		// A PostToolUse hook that exits 2 sends the result back; jWs() logs it (chunk-m14bt1pz.js:4524394).
		id: "otel-safety-hook",
		claudeJson: SAFETY,
		cfgFiles: {
			"settings.json": JSON.stringify({
				hooks: {
					PostToolUse: [
						{
							matcher: "Bash",
							hooks: [{ type: "command", command: "echo blocked >&2; exit 2" }],
						},
					],
				},
			}),
		},
		seq: [{ name: "Bash", input: { command: "echo probe" } }],
		args: ["--allowedTools", "Bash"],
	},
	{
		// A 400 reply whose body is not JSON reaches logError(), which logs internal_error through aVa()
		// (chunk-f41c8jb6.js:22406); the error log sink calls aVa() for each logged error (chunk-teybq4x3.js:2361).
		id: "otel-internal-error",
		turns: [{ kind: "error", status: 400, body: "not json" }],
	},
	{
		// LCt() logs the number and boolean entries of a hook's `metrics` output only for a plugin whose marketplace
		// has an official name (RM() in chunk-m14bt1pz.js:1141673, LCt() in chunk-m14bt1pz.js:4208964). The add
		// command refuses such a name from a local source, so the case seeds the install records of an official
		// marketplace that points at a local folder. A valid answer loses `metrics` in the schema parse; only the
		// fallback for an async answer that fails the schema keeps it (zyn() in chunk-m14bt1pz.js:1203719), and the
		// next request after the answer sends it (chunk-m14bt1pz.js:4072580). The Bash call outlasts the 1 s hook.
		id: "otel-hook-plugin-metrics",
		cfgFiles: OFFICIAL_PLUGIN,
		projFiles: OFFICIAL_MARKET,
		args: ["--allowedTools", "Bash"],
		seq: [{ name: "Bash", input: { command: "sleep 3" } }],
	},
	{
		// Print mode starts the housekeeping, which runs the retention sweep 5 s later (chunk-rnt5hbrt.js:36279,
		// chunk-ddhdrc1h.js:18520); the idle check before it applies only to an interactive session. A fresh config dir
		// has no .last-cleanup, so the sweep runs, and wmi() logs it (chunk-f41c8jb6.js:21550). The open stdin keeps
		// the run alive past the 5 s.
		id: "otel-retention-sweep",
		stdin: [user("Reply with OK."), 10_000],
	},
];
