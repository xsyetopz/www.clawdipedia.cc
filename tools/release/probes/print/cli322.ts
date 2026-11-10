// 2.1.322 probes for fast mode on Vertex: what `/fast` answers for each provider, region, model, and switch.
// `/fast` is a local command, so a `/fast` case sends no request. In print mode the program takes `/fast` only with
// `fastMode` in the `--settings` value. The `request-*` cases send one first-party request and record its `speed`
// field and fast mode beta. The Vertex request and the fallback after a refusal need a Vertex stub, which the
// cc-inspect `code` `cli` action has (`provider: "vertex"`).
import { PROMPT } from "../../lib/env.ts";
import { events, msgs } from "./run.ts";
import type { CaseDef } from "./run/helpers.ts";
import { bodyOf, runCases, scalar, withRun } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const FAST_ON = ["--settings", '{"fastMode":true}'];
const VERTEX = {
	CLAUDE_CODE_USE_VERTEX: "1",
	ANTHROPIC_VERTEX_PROJECT_ID: "probe-project",
	CLAUDE_CODE_SKIP_VERTEX_AUTH: "1",
};

interface Fast {
	prompt?: string;
	env: Record<string, string>;
	args?: string[];
	model?: string;
}

const fast = (
	name: string,
	{ prompt = "/fast on", env, args = FAST_ON, model }: Fast,
): CaseDef => ({
	name: `fast-${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				prompt,
				...(prompt !== PROMPT && {
					promptReason: "/fast is the command under test",
				}),
				env,
				args,
				...(model !== undefined && { model }),
			},
			(r) => {
				const result = events(r).find((e) => e["type"] === "result");
				const [q] = msgs(r);
				return {
					from: r,
					data: {
						exit: r.code,
						requests: msgs(r).length,
						speed: q === undefined ? null : scalar(bodyOf(q)["speed"]),
						fastBeta:
							q === undefined
								? null
								: (q.headers["anthropic-beta"] ?? "")
										.split(",")
										.includes("fast-mode-2026-02-01"),
						result: scalar(result?.["result"]),
						fastModeState: scalar(result?.["fast_mode_state"]),
						fastModeDisabledReason: scalar(
							result?.["fast_mode_disabled_reason"],
						),
					},
				};
			},
		),
});

const vertex = (
	name: string,
	region: string,
	rest: Partial<Fast> = {},
): CaseDef =>
	fast(`vertex-${name}`, {
		...rest,
		env: { ...VERTEX, CLOUD_ML_REGION: region, ...rest.env },
	});

export const CASES: CaseDef[] = [
	vertex("global", "global"),
	vertex("us", "us"),
	vertex("eu", "eu"),
	vertex("us-east5", "us-east5"),
	vertex("model-region", "us-east5", {
		env: { VERTEX_REGION_CLAUDE_FABLE_5_2: "eu" },
	}),
	vertex("model-region-bad", "global", {
		env: { VERTEX_REGION_CLAUDE_FABLE_5_2: "europe-west1" },
	}),
	vertex("mythos", "eu", { model: "claude-mythos-5-2" }),
	vertex("mythos-region", "global", {
		model: "claude-mythos-5-2",
		env: { VERTEX_REGION_CLAUDE_MYTHOS_5_2: "us-east5" },
	}),
	vertex("no-settings", "us", { args: [] }),
	vertex("settings-off", "us", { args: ["--settings", '{"fastMode":false}'] }),
	vertex("flag", "us", { args: ["--fast-mode", "on"] }),
	vertex("toggle", "us", { prompt: "/fast" }),
	vertex("disabled", "global", { env: { CLAUDE_CODE_DISABLE_FAST_MODE: "1" } }),
	vertex("off", "global", { prompt: "/fast off" }),
	vertex("bad-argument", "global", { prompt: "/fast maybe" }),
	vertex("capability-on", "global", {
		env: { CLAUDE_CODE_MODEL_CAPABILITIES: "claude-opus-5-5=vertex_fast_mode" },
	}),
	vertex("capability-off", "global", {
		model: "claude-fable-5-2",
		env: {
			CLAUDE_CODE_MODEL_CAPABILITIES: "claude-fable-5-2=-vertex_fast_mode",
		},
	}),
	vertex("fable", "global", { model: "claude-fable-5-2" }),
	fast("capability-first-party", {
		model: "claude-sonnet-5",
		env: { CLAUDE_CODE_MODEL_CAPABILITIES: "claude-sonnet-5=fast_mode" },
	}),
	fast("first-party-sonnet", { model: "claude-sonnet-5", env: {} }),
	fast("request-first-party", { prompt: PROMPT, env: {} }),
	fast("request-first-party-off", { prompt: PROMPT, env: {}, args: [] }),
	fast("request-first-party-disabled", {
		prompt: PROMPT,
		env: { CLAUDE_CODE_DISABLE_FAST_MODE: "1" },
	}),
	fast("first-party", { env: {} }),
	fast("bedrock", {
		env: { CLAUDE_CODE_USE_BEDROCK: "1", AWS_REGION: "us-east-1" },
	}),
	fast("foundry", {
		env: {
			CLAUDE_CODE_USE_FOUNDRY: "1",
			ANTHROPIC_FOUNDRY_RESOURCE: "probe-resource",
		},
	}),
];

export const cli322: PrintGroup = {
	id: "cli322",
	title: "2.1.322: fast mode on Vertex (/fast by provider, region, and model)",
	run: (ctx) => runCases(ctx, "cli322", CASES),
};
