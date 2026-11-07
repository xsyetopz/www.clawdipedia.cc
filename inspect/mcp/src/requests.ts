// Reads what a run of the program sent and wrote: the tools it offered, the text it printed, and its files.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { RunResult } from "./run.ts";

/** The text of each `.json`, `.jsonl`, and `.log` file under `dir`, such as `.claude.json` or a session transcript, by path relative to `dir`. */
export const filesOf = (dir: string): Record<string, string> =>
  Object.fromEntries(
    [...new Bun.Glob("**/*.{json,jsonl,log}").scanSync({ cwd: dir, dot: true })]
      .sort()
      .map((p) => [p, readFileSync(join(dir, p), "utf8")]),
  );

/** Where `q` appears in a run: each request body, stdout, stderr, and each file the run wrote. */
export const placesOf = (
  r: Pick<RunResult, "requests" | "stdout" | "stderr" | "files">,
  q: string,
): string[] => [
  ...r.requests.flatMap((x, i) =>
    JSON.stringify(x.body ?? "").includes(q)
      ? [`request ${i + 1} ${x.method} ${x.path}`]
      : [],
  ),
  ...(r.stdout.includes(q) ? ["stdout"] : []),
  ...(r.stderr.includes(q) ? ["stderr"] : []),
  ...Object.entries(r.files)
    .filter(([, t]) => t.includes(q))
    .map(([p]) => `file ${p}`),
];

const isTurn = (path: string): boolean =>
  path.startsWith("/v1/messages") && !path.includes("count_tokens");

/** The tool names of each Messages API request, in order. Token-count calls and other requests are left out. */
export const toolNames = (r: Pick<RunResult, "requests">): string[][] =>
  r.requests
    .filter((q) => isTurn(q.path))
    .map((q) =>
      ((q.body as { tools?: { name?: unknown }[] } | null)?.tools ?? [])
        .map((t) => t.name)
        .filter((n): n is string => typeof n === "string"),
    );

/** The `result` text of the last stream-json `result` event, where `-p` puts a local command's output, or null. */
export const resultText = (r: Pick<RunResult, "events">): string | null => {
  const last = [...r.events].reverse().find((e) => e["type"] === "result");
  const text = last?.["result"];
  return typeof text === "string" ? text : null;
};
