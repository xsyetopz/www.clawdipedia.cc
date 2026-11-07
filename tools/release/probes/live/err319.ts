// Live probes for 2.1.319 error texts that need a real login and real feature values.
// 1. One `-p` run (`--chrome`, debug file): is RemoteTrigger in the tool list, what does Chrome print, which gate lines show.
// 2. Only when RemoteTrigger is listed: ask the model for `get_run_log` with cursor `bad` (read-only action; the cursor check runs before any request).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Data } from "../../lib/results.ts";
import {
  arr,
  baseResult,
  type LiveCase,
  type LiveCtx,
  liveSandbox,
  type Obj,
  obj,
  PROMPT,
  runPrint,
  scrub,
} from "./harness.ts";

const ID = "err319";

const initTools = (evs: Obj[]): string[] =>
  arr(
    evs.find((e) => e["type"] === "system" && e["subtype"] === "init")?.[
      "tools"
    ],
  ).map(String);

const lines = (text: string, re: RegExp, n = 8): string =>
  text
    .split("\n")
    .filter((l) => re.test(l))
    .slice(0, n)
    .map((l) => scrub(l).slice(0, 400))
    .join("\n");

export const err319Live: LiveCase = {
  id: ID,
  title: "2.1.319 error texts that need a live login (RemoteTrigger, Chrome)",
  requests: "1 to 2 model requests, plus account and feature calls",
  run: async (x: LiveCtx) => {
    const sb = liveSandbox();
    const data: Record<string, Data> = {};
    const samples: Record<string, string> = {};
    try {
      const dbg = join(sb.cfg, "d.log");
      const main = await runPrint(
        x,
        sb,
        ["-p", PROMPT, "--chrome", "--debug-file", dbg],
        { featureGates: true },
      );
      const tools = initTools(main.events);
      data["main.exit"] = main.code;
      data["main.remote_trigger_listed"] = tools.includes("RemoteTrigger");
      data["main.chrome_tools"] = tools.filter((t) => /chrome/i.test(t)).length;
      let debug = "";
      try {
        debug = readFileSync(dbg, "utf8");
      } catch {
        debug = "";
      }
      samples["main.debug"] = lines(
        debug,
        /hrome|RemoteTrigger|bughunter|policy/i,
      );

      if (tools.includes("RemoteTrigger")) {
        const rt = await runPrint(
          x,
          sb,
          [
            "-p",
            "Call the RemoteTrigger tool once with action get_run_log, session_id session_01ABCDEFGHJKLMNPQRSTUVWX and cursor bad. Then reply with the exact error text it gave.",
            "--allowedTools",
            "ToolSearch",
          ],
          { featureGates: true },
        );
        data["trigger.exit"] = rt.code;
        samples["trigger.tool_results"] = lines(
          rt.events
            .flatMap((e) => arr(obj(e["message"])["content"]))
            .map((c) => JSON.stringify(obj(c)["content"] ?? ""))
            .join("\n"),
          /cursor|RemoteTrigger/,
        );
      }
      return [
        baseResult(x, ID, {
          args: ["-p", "--chrome"],
          exit: main.code,
          timedOut: main.timedOut,
          data,
          samples,
          notes:
            "Feature values come from the live account; no model call is made unless RemoteTrigger is listed.",
        }),
      ];
    } finally {
      sb.cleanup();
    }
  },
};
