// Live look at CLAUDE_CODE_EXPERIMENTAL_CODE_MODE (2.1.319, chunk-f0e5mbbe.js@3460). The gate needs the cli entrypoint, a
// firstParty login and the server flag tengu_rustling_blossom (payload or override). A fake key cannot reach the payload.
// The sandbox sets the variable to "on" in user settings, accepts both caveats, keeps telemetry on so the program fetches
// its feature values, sends the prompt, and then reads the flag value the program cached from the live payload.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { READY } from "../pty/harness.ts";
import {
  baseResult,
  type LiveCase,
  liveSandbox,
  obj,
  PROMPT,
  runLivePty,
} from "./harness.ts";

const ID = "code-mode";
const FLAG = "tengu_rustling_blossom";

export const codeModeCase: LiveCase = {
  id: ID,
  title: "EXPERIMENTAL_CODE_MODE gate with the real login",
  requests: "1 live",
  run: async (x) => {
    const sb = liveSandbox();
    try {
      writeFileSync(
        join(sb.cfg, "settings.json"),
        JSON.stringify({
          permissions: { deny: ["Artifact"] },
          env: { CLAUDE_CODE_EXPERIMENTAL_CODE_MODE: "on" },
        }),
      );
      const cj = join(sb.cfg, ".claude.json");
      writeFileSync(
        cj,
        JSON.stringify({
          ...obj(JSON.parse(readFileSync(cj, "utf8"))),
          codeModeCaveatsAcceptedV1: true,
          codeModeAutoModeCaveatAcceptedV1: true,
        }),
      );
      const dbg = join(sb.root, "debug.log");
      const pty = await runLivePty(x, sb, {
        schedule: [READY, { t: 3, send: `${PROMPT}\r`, label: "prompt" }],
        secs: 40,
        featureGates: true,
        args: ["--debug-file", dbg],
      });
      const cache = obj(
        obj(JSON.parse(readFileSync(cj, "utf8")))["cachedGrowthBookFeatures"],
      );
      let log = "";
      try {
        log = readFileSync(dbg, "utf8");
      } catch {}
      const lines = log
        .split("\n")
        .filter((l) => /code.?mode|repl_mode|rustling|REPL tool/i.test(l))
        .slice(0, 20)
        .map((l) => l.slice(0, 200));
      return [
        baseResult(x, ID, {
          exit: pty.exit,
          data: {
            precondition: /OK/.test(pty.screen),
            flagName: FLAG,
            flagCached: FLAG in cache,
            flagValue: FLAG in cache ? String(cache[FLAG]) : "absent",
            cachedFlagCount: Object.keys(cache).length,
            cachedTenguFlags: Object.keys(cache).filter((k) =>
              k.startsWith("tengu_"),
            ).length,
            cachedBlossomNames: Object.keys(cache).filter((k) =>
              /blossom/.test(k),
            ),
            debugLines: lines,
            screenMentionsReplOrCodeMode: /code mode|REPL tool/i.test(
              pty.screen,
            ),
          },
          samples: { screenTail: pty.screen.split("\n").slice(-25).join("\n") },
          notes:
            "User settings env sets CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=on; both caveats are accepted in .claude.json; telemetry stays on so the live feature payload is fetched. flagValue is the cached live value.",
        }),
      ];
    } finally {
      sb.cleanup();
    }
  },
};
