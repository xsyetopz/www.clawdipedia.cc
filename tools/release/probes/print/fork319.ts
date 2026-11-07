// The `effort` option of `$.model.fork` (2.1.318). A mod calls the fork in its `turn.complete` hook and logs each result to the debug log;
// the case also reads the fork's own request from the stub: the `output_config.effort` field, the message after the transcript, and the tools.
import type { Data } from "../../lib/results.ts";
import {
  bodyOf,
  type CaseDef,
  json,
  msgs,
  readCfg,
  runCases,
  withRun,
} from "./run/helpers.ts";
import { obj } from "./run.ts";
import type { PrintGroup } from "./types.ts";

type Fork = [label: string, request: Record<string, unknown>];
const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };
const PROMPT = "Reply with 'OK'.";

const forkMod = (forks: Fork[]): string => `export const register = (on) => {
  on("turn.complete", async ($, e, next) => {
    for (const [label, req] of ${json(forks)}) {
      let out;
      try {
        const r = await $.model.fork(req);
        out = { isAnswered: r.isAnswered, effort: r.effort, reason: r.reason };
      } catch (x) { out = { err: String(x && x.message) }; }
      $.ui.log("FORK " + label + " " + JSON.stringify(out), { to: "debug" });
    }
    return next(e);
  });
};
`;

type Opt = {
  forks: Fork[];
  model?: string;
  env?: Record<string, string>;
  args?: string[];
  settings?: unknown;
};

const forkCase = (name: string, o: Opt): CaseDef => ({
  name: `model-fork.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        homeFiles: {
          "plug/.claude-plugin/plugin.json": json({
            name: "forkprobe",
            version: "1.0.0",
          }),
          "plug/hooks/hooks.json": json({ modules: ["./register.ts"] }),
          "plug/hooks/register.ts": forkMod(o.forks),
        },
        ...(o.env ? { env: o.env } : {}),
        ...(o.settings
          ? { cfgFiles: { "settings.json": json(o.settings) } }
          : {}),
        args: [
          "--plugin-dir",
          "{HOME}/plug",
          "--debug-file",
          "{CFG}/d.log",
          ...(o.model ? ["--model", o.model] : []),
          ...(o.args ?? []),
        ],
        timeoutMs: 90_000,
      },
      (r) => {
        const qs = msgs(r);
        const lines = readCfg(r, "d.log")
          .split("\n")
          .filter((l) => /FORK /.test(l))
          .map((l) => l.replace(/^.*?FORK /, ""));
        // The first request is the main thread; each later one is a fork. `top` is the request's own `output_config.effort`;
        // `trailer` is the effort on a closing `system` message after the prompt, the way a model that takes effort per message gets it.
        const perFork = qs.slice(1).map((q) => {
          const b = bodyOf(q);
          const ms = b.messages ?? [];
          const last = ms.at(-1);
          const trailer =
            last?.role === "system" ? obj(last)["output_config"] : undefined;
          return `top=${obj(b["output_config"])["effort"] ?? "none"} trailer=${obj(trailer)["effort"] ?? "none"} messages=${ms.length} tools=${(b.tools ?? []).length}`;
        });
        const main = qs[0] ? bodyOf(qs[0]) : undefined;
        const data: Record<string, Data> = {
          precondition: qs.length >= 1 && lines.length === o.forks.length,
          forkRequests: qs.length - 1,
          mainEffort: main
            ? ((obj(main["output_config"])["effort"] ?? null) as Data)
            : null,
          mainMessages: main?.messages?.length ?? null,
        };
        o.forks.forEach(([label], i) => {
          data[`fork.${label}`] = lines[i]?.replace(/^\S+\s/, "") ?? null;
        });
        return {
          from: r,
          data,
          samples: { perFork: perFork.join("\n") },
        };
      },
    ),
});

const ask = (label: string, effort?: unknown): Fork => [
  label,
  effort === undefined ? { prompt: PROMPT } : { prompt: PROMPT, effort },
];

export const fork319: PrintGroup = {
  id: "fork319",
  title: "Mod API model.fork effort (2.1.318)",
  run: (ctx) =>
    runCases(ctx, "fork319", [
      forkCase("per-message", {
        forks: [
          ask("none"),
          ask("low", "low"),
          ask("medium", "medium"),
          ask("max", "max"),
        ],
      }),
      forkCase("bad-value", {
        forks: [
          ask("extreme", "extreme"),
          ask("number", 5),
          ask("empty", ""),
          ["no-prompt", { effort: "low" }],
          ask("uppercase", "LOW"),
        ],
      }),
      forkCase("session-max", {
        args: ["--effort", "max"],
        forks: [ask("none"), ask("low", "low"), ask("high", "high")],
      }),
      forkCase("env-ceiling", {
        env: { CLAUDE_CODE_EFFORT_LEVEL: "medium" },
        forks: [ask("none"), ask("low", "low"), ask("max", "max")],
      }),
      forkCase("env-auto", {
        env: { CLAUDE_CODE_EFFORT_LEVEL: "auto" },
        forks: [ask("none"), ask("low", "low"), ask("max", "max")],
      }),
      forkCase("env-unset", {
        env: { CLAUDE_CODE_EFFORT_LEVEL: "unset" },
        forks: [ask("none"), ask("low", "low")],
      }),
      forkCase("max-effort-setting", {
        settings: { maxEffortLevel: "medium" },
        forks: [ask("none"), ask("low", "low"), ask("max", "max")],
      }),
      forkCase("whole-request", {
        model: "claude-opus-4-8",
        forks: [ask("none"), ask("low", "low"), ask("max", "max")],
      }),
      forkCase("whole-request-capability", {
        model: "claude-opus-4-8",
        env: {
          CLAUDE_CODE_MODEL_CAPABILITIES: "per_turn_effort",
          ...FIRST_PARTY,
        },
        forks: [ask("none"), ask("low", "low")],
      }),
      forkCase("no-effort-model", {
        model: "claude-haiku-4-5",
        forks: [ask("none"), ask("low", "low")],
      }),
    ]),
};
