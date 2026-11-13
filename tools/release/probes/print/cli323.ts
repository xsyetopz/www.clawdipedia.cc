import { events } from "./run.ts";
import type { Run } from "./run.ts";
// 2.1.323 probes that need no model call: `claude workspace-trust --json`, the `unsetOptionCount` field of
// `claude plugin install --json`, a settings file that still holds the removed `subagentStatusLine` key, and the
// examples of `claude mcp add --help`. The subcommand cases use `argv`, so no request leaves the sandbox.
// The plugin cases install from a local directory marketplace that `plugins/known_marketplaces.json` names.
// Not probed: the `CLAUDE_CODE_OVERLOADED_RETRY_MAX_DELAY_MS` range. The program reads an out-of-range value as unset
// with no warning, and only a retry after an overloaded response shows the delay. The stub cannot send one.
import { json, runCases, scalar, withRun } from "./run/helpers.ts";
import type { CaseDef } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const firstJson = (r: Run): Record<string, unknown> => {
	try {
		const v: unknown = JSON.parse(r.stdout.split("\n")[0] ?? "");
		return typeof v === "object" && v !== null && !Array.isArray(v)
			? Object.fromEntries(Object.entries(v))
			: {};
	} catch {
		return {};
	}
};

const lines = (s: string): string =>
	s
		.split("\n")
		.filter((l) => l.trim() !== "")
		.slice(0, 12)
		.join("\n");

const mentions = (s: string): string =>
	s
		.split("\n")
		.filter((l) => /subagentStatusLine|invalid|settings/iu.test(l))
		.join("\n");

const MARKETPLACE = {
	"m/.claude-plugin/marketplace.json": json({
		name: "mk",
		owner: { name: "probe" },
		plugins: [
			{ name: "pp", source: "./pp", description: "two options" },
			{ name: "none", source: "./none", description: "no options" },
		],
	}),
	"m/pp/.claude-plugin/plugin.json": json({
		name: "pp",
		version: "1.0.0",
		description: "two options",
		userConfig: {
			tok: { type: "string", title: "Tok", description: "first" },
			two: { type: "string", title: "Two", description: "second" },
		},
	}),
	"m/none/.claude-plugin/plugin.json": json({
		name: "none",
		version: "1.0.0",
		description: "no options",
	}),
};
const KNOWN = {
	"plugins/known_marketplaces.json": json({
		mk: {
			source: { source: "directory", path: "{PROJ}/m" },
			installLocation: "{PROJ}/m",
			lastUpdated: "2026-01-01T00:00:00.000Z",
		},
	}),
};
const TRUSTED = {
	".claude.json": json({
		hasCompletedOnboarding: true,
		projects: { "{PROJ}": { hasTrustDialogAccepted: true } },
	}),
};

const trust = (
	name: string,
	argv: string[],
	extra: Partial<Parameters<typeof withRun>[1]> = {},
): CaseDef => ({
	name: `workspace-trust-${name}`,
	run: (ctx) =>
		withRun(ctx, { argv, ...extra }, (r) => {
			const o = firstJson(r);
			return {
				from: r,
				data: {
					exit: r.code,
					keys: Object.keys(o).toSorted().join(","),
					trusted: scalar(o["trusted"]),
					directoryIsProject: o["directory"] === r.sb.proj,
					sandboxLimitsFiles: scalar(o["sandbox_limits_files"]),
					requests: r.reqs.length,
				},
				samples: { stdout: lines(r.stdout), stderr: lines(r.stderr) },
			};
		}),
});

const install = (
	name: string,
	plugin: string,
	args: string[] = [],
): CaseDef => ({
	name: `plugin-install-${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				argv: ["plugin", "install", plugin, "--json", ...args],
				projFiles: MARKETPLACE,
				cfgFiles: KNOWN,
			},
			(r) => {
				const o = firstJson(r);
				return {
					from: r,
					data: {
						exit: r.code,
						outcome: scalar(o["outcome"]),
						hasUnsetOptionCount: "unsetOptionCount" in o,
						unsetOptionCount: scalar(o["unsetOptionCount"]),
						configApplied: scalar(o["configApplied"]),
						keys: Object.keys(o).toSorted().join(","),
						requests: r.reqs.length,
					},
					samples: { stdout: lines(r.stdout), stderr: lines(r.stderr) },
				};
			},
		),
});

const SUBAGENT = { subagentStatusLine: { type: "command", command: "echo x" } };

const statusLine = (
	name: string,
	spec: Partial<Parameters<typeof withRun>[1]>,
): CaseDef => ({
	name: `subagent-status-line-${name}`,
	run: (ctx) =>
		withRun(ctx, spec, (r) => {
			const result = events(r).find((e) => e["type"] === "result");
			return {
				from: r,
				data: {
					exit: r.code,
					subtype: scalar(result?.["subtype"]),
					isError: scalar(result?.["is_error"]),
					result: scalar(result?.["result"]),
					stderrMentions: mentions(r.stderr).length > 0,
					requests: r.reqs.length,
				},
				samples: { stderr: lines(mentions(r.stderr)) },
			};
		}),
});

export const CASES: CaseDef[] = [
	trust("json", ["workspace-trust", "--json"]),
	trust("no-json", ["workspace-trust"]),
	trust("help", ["workspace-trust", "--help"]),
	trust("ignore-first", [
		"--ignore-persisted-trust",
		"workspace-trust",
		"--json",
	]),
	trust("ignore-last", [
		"workspace-trust",
		"--json",
		"--ignore-persisted-trust",
	]),
	trust("persisted", ["workspace-trust", "--json"], { cfgFiles: TRUSTED }),
	trust(
		"persisted-ignored",
		["--ignore-persisted-trust", "workspace-trust", "--json"],
		{ cfgFiles: TRUSTED },
	),
	trust("persisted-env-ignored", ["workspace-trust", "--json"], {
		cfgFiles: TRUSTED,
		env: { CLAUDE_CODE_IGNORE_PERSISTED_TRUST: "1" },
	}),
	install("json", "pp@mk"),
	install("config-one", "pp@mk", ["--config", "tok=x"]),
	install("no-options", "none@mk"),
	statusLine("file", {
		cfgFiles: { "settings.json": json(SUBAGENT) },
	}),
	statusLine("flag", { args: ["--settings", json(SUBAGENT)] }),
	statusLine("bad-type", {
		args: ["--settings", json({ subagentStatusLine: 5 })],
	}),
	statusLine("absent", {}),
	{
		name: "mcp-add-help",
		run: (ctx) =>
			withRun(ctx, { argv: ["mcp", "add", "--help"] }, (r) => {
				const examples = r.stdout
					.split("\n")
					.filter((l) => l.includes("claude mcp add"))
					.map((l) => l.trim());
				return {
					from: r,
					data: {
						exit: r.code,
						exampleCount: examples.length,
						examples: examples.join("\n"),
						requests: r.reqs.length,
					},
				};
			}),
	},
];

export const cli323: PrintGroup = {
	id: "cli323",
	title:
		"2.1.323: workspace-trust, plugin install unsetOptionCount, subagentStatusLine, mcp add help",
	run: (ctx) => runCases(ctx, "cli323", CASES),
};
