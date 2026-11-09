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

/** Where `q` (without the `g` flag) matches in a run: each request body, stdout, stderr, and each file the run wrote. */
export const placesOf = (
  r: Pick<RunResult, "requests" | "stdout" | "stderr" | "files">,
  q: RegExp,
): string[] => [
  ...r.requests.flatMap((x, i) =>
    q.test(JSON.stringify(x.body ?? ""))
      ? [`request ${i + 1} ${x.method} ${x.path}`]
      : [],
  ),
  ...(q.test(r.stdout) ? ["stdout"] : []),
  ...(q.test(r.stderr) ? ["stderr"] : []),
  ...Object.entries(r.files)
    .filter(([, t]) => q.test(t))
    .map(([p]) => `file ${p}`),
];

const bytes = (v: unknown): number =>
  v === undefined ? 0 : Buffer.byteLength(JSON.stringify(v));

/**
 * The UTF-8 size of a request body as compact JSON, and of its `tools`, `system`, and `messages`,
 * with the path of each block that holds a `cache_control`, in body order.
 */
export const bodyOf = (body: unknown) => {
  const b = (body && typeof body === "object" ? body : {}) as Record<
    string,
    unknown
  >;
  const cacheControl: string[] = [];
  const walk = (v: unknown, path: string) => {
    if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${path}[${i}]`));
    else if (v && typeof v === "object") {
      if ("cache_control" in v) cacheControl.push(path);
      for (const [k, x] of Object.entries(v))
        if (k !== "cache_control") walk(x, `${path}.${k}`);
    }
  };
  for (const [k, v] of Object.entries(b)) walk(v, k);
  return {
    bytes: typeof body === "string" ? Buffer.byteLength(body) : bytes(body),
    tools: bytes(b["tools"]),
    system: bytes(b["system"]),
    messages: bytes(b["messages"]),
    cacheControl,
  };
};

const isTurn = (path: string): boolean =>
  path.startsWith("/v1/messages") && !path.includes("count_tokens");

/** The entry of tool `name` (name, description, input_schema, ...) in the last Messages API request that sends it. */
export const toolEntry = (
  r: Pick<RunResult, "requests">,
  name: string,
): Record<string, unknown> | undefined =>
  r.requests
    .filter((q) => isTurn(q.path))
    .flatMap(
      (q) => (q.body as { tools?: Record<string, unknown>[] } | null)?.tools ?? [],
    )
    .reverse()
    .find((t) => t["name"] === name);

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
