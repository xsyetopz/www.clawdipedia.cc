import { z } from "zod";
import { listInstalls, program } from "../binary.ts";
import { cut, lines as linesOf } from "../diff.ts";
import { findUnits } from "../find.ts";
import { fetchPackage, findText } from "../npm.ts";
import { prepared } from "../prepare.ts";
import { readable } from "../readable.ts";
import {
  bodyOf,
  placesOf,
  resultText,
  toolEntry,
  toolNames,
} from "../requests.ts";
import { API_HOST, runArgs, runPrompt, userText } from "../run.ts";
import {
  type Args,
  clip,
  group,
  MAX_CHARS,
  need,
  P,
  regex,
  text,
  WRITES_CACHE,
} from "./app.ts";

// Only an install: `run` and `cli` execute the file, where the other actions only read it.
const installed = (version: string | undefined) => {
  const all = listInstalls();
  const bin = version
    ? all.find((i) => i.version === version)
    : (all.find((i) => i.current) ?? all[0]);
  if (!bin)
    throw new Error(
      `run and cli take an installed version; installed: ${all.map((i) => i.version).join(", ") || "none"}`,
    );
  return bin;
};

group<
  Args & {
    context?: number;
    length?: number;
    view?: string;
    prompt?: string;
    env?: Record<string, string>;
    args?: string[];
    prompts?: string[];
    request?: number;
    tool?: string;
    files?: Record<string, string>;
    replies?: Record<string, unknown>;
    login?: "key" | "oauth";
    packageVersion?: string;
    show?: string;
    apiHost?: boolean;
    baseUrl?: boolean;
    calls?: {
      name: string;
      input: Record<string, unknown>;
      safeguard?: "flagged" | "not_flagged";
    }[];
  }
>(
  "code",
  // biome-ignore lint/suspicious/noTemplateCurlyInString: ${…} is the hole marker of a query
  "Read the code inside a Claude Code binary: list installs or modules, search literal text, find code by plain words, read a module slice, prepare a cleaned index for release diffs, run a prompt in an installed version against a local fake API to see the text it sends, or run it with other args (cli), such as a subcommand; check with `npm` whether a text (`query`, with ${…} holes) is in the published source of the npm package in `name`; with `query`, cli names each request, stream, and transcript file that holds that text.",
  "action",
  {
    installs: () => {
      const installs = listInstalls();
      return text(
        installs.length
          ? installs
              .map(
                (i) =>
                  `- ${i.version}${i.current ? " (current)" : ""}  ${i.path}`,
              )
              .join("\n")
          : "No Claude Code install found.",
        { installs },
      );
    },
    modules: ({ version, name }) => {
      const p = program(version);
      const modules = p.modules
        .filter((m) => !name || m.name.includes(name))
        .map((m) => ({ name: m.name, bytes: m.bytes.length }));
      return text(
        `${p.path}: ${modules.length} modules\n${modules.map((m) => `- ${m.name}  ${m.bytes} bytes`).join("\n")}`,
        { path: p.path, modules },
      );
    },
    search: ({
      query,
      regex: isRegex = false,
      module,
      version,
      context = 150,
      limit = 20,
    }) => {
      const re = new RegExp(regex(need(query, "query"), isRegex).source, "g");
      const hits: { module: string; offset: number; snippet: string }[] = [];
      for (const m of program(version).bundle.modules.values()) {
        if (module && !m.name.includes(module)) continue;
        for (const h of m.text.matchAll(re)) {
          hits.push({
            module: m.name,
            offset: h.index,
            snippet: m.text.slice(
              Math.max(0, h.index - context),
              h.index + h[0].length + context,
            ),
          });
          if (hits.length >= limit) break;
        }
        if (hits.length >= limit) break;
      }
      return text(
        hits.length
          ? hits
              .map((h) => `- ${h.module}@${h.offset}: ${h.snippet}`)
              .join("\n\n")
          : `No match for ${re}.`,
        { hits },
      );
    },
    read: async ({ module, offset = 0, length = 4000, version, view }) => {
      const p = program(version);
      const mod = need(module, "module");
      const m =
        p.modules.find((x) => x.name.endsWith(`/${mod}`)) ??
        p.modules.find((x) => x.name === mod);
      if (!m) throw new Error(`no module "${mod}" in ${p.path}`);
      if (view !== undefined && view !== "readable")
        throw new Error(`unknown view "${view}"; views: readable`);
      if (view) {
        const t = await readable(version, m.name);
        const end = Math.min(t.length, offset + length);
        const slice = t.slice(offset, end);
        return text(
          `${m.name} (readable) [${offset}, ${end}) of ${t.length}\n${slice}`,
          { module: m.name, view, offset, end, total: t.length, text: slice },
        );
      }
      const end = Math.min(m.source.length, offset + length);
      return text(
        `${m.name} [${offset}, ${end}) of ${m.source.length}\n${m.source.slice(offset, end)}`,
      );
    },
    find: ({ query, version, limit = 10 }) => {
      const q = need(query, "query");
      const r = prepared(version);
      const found = findUnits(r.index, q, Math.min(limit, 10)).map((f) => ({
        ...f,
        excerpt: linesOf(f.u.t).slice(0, 4).map(cut),
      }));
      return text(
        found.length
          ? `${r.index.version}: top ${found.length} for "${clip(q, 100)}"\n${found
              .map(
                ({ u, n, hits, excerpt }) =>
                  `## ${u.k}  ${u.m}:${u.s}  score ${n} (${hits.join(", ")})\n${excerpt.join("\n")}`,
              )
              .join("\n\n")}`
          : `No unit holds a word of "${clip(q, 100)}".`,
        {
          found: found.map(({ u, n, hits, excerpt }) => ({
            label: u.k,
            module: u.m,
            offset: u.s,
            score: n,
            hits,
            excerpt,
          })),
        },
      );
    },
    run: async ({ prompt, name, version, offset = 0, length = 4000, env }) => {
      const q = need(prompt, "prompt");
      const cmd = /^\/([\w:-]+)/.exec(q)?.[1];
      const mark = name ?? (cmd ? `<command-name>/${cmd}</command-name>` : q);
      const bin = installed(version);
      const r = await runPrompt(bin.path, q, undefined, undefined, env);
      const t = userText(r, mark);
      const sent = r.requests.map((x) => `${x.method} ${x.path}`);
      const out = resultText(r);
      const said = out === null ? "" : `\nResult: ${clip(out, 2000)}`;
      const head = `${bin.version}: exit ${r.exit}, ${sent.length} requests.${r.exit !== 0 || t === null ? `\nstderr: ${clip(r.stderr, 500)}` : ""}`;
      if (t === null)
        return text(
          `${head}\nNo user turn holds "${clip(mark, 100)}".${said}`,
          {
            exit: r.exit,
            requests: sent,
            result: out,
          },
        );
      const start = Math.min(offset, t.length);
      const end = Math.min(t.length, start + length);
      return text(
        `${head}\nUser turn [${start}, ${end}) of ${t.length}\n${t.slice(start, end)}${said}`,
        {
          exit: r.exit,
          requests: sent,
          offset: start,
          end,
          total: t.length,
          result: out,
        },
      );
    },
    cli: async ({
      args = [],
      prompts,
      files,
      version,
      env,
      query,
      regex: isRegex = false,
      replies,
      login,
      show,
      apiHost,
      baseUrl,
      calls,
      request,
      tool,
      offset = 0,
      length = 4000,
    }) => {
      if (!args.length && !prompts)
        throw new Error('cli needs args, such as ["auto-mode", "config"]');
      const bin = installed(version);
      const r = await runArgs(
        bin.path,
        prompts
          ? [
              "-p",
              "--input-format",
              "stream-json",
              "--output-format",
              "stream-json",
              "--verbose",
              ...args,
            ]
          : args,
        {
          env: env ?? {},
          files: files ?? {},
          replies: replies ?? {},
          login: login ?? "key",
          apiHost: apiHost ?? false,
          baseUrl: baseUrl ?? true,
          ...(calls && { calls }),
          ...(prompts && {
            input: prompts
              .map(
                (content) =>
                  `${JSON.stringify({ type: "user", message: { role: "user", content } })}\n`,
              )
              .join(""),
          }),
        },
      );
      const sent = r.requests.map(
        (x) =>
          `${x.method} ${x.host === API_HOST ? `https://${API_HOST}` : ""}${x.path}`,
      );
      const tools = toolNames(r);
      const found =
        query === undefined ? undefined : placesOf(r, regex(query, isRegex));
      const stdout = clip(r.stdout, 4000);
      const stderr = clip(r.stderr, 2000);
      const file =
        show === undefined ? undefined : (r.files[show] ?? r.projectFiles[show]);
      const shown =
        show === undefined
          ? ""
          : `\n${show}: ${file === undefined ? "not written" : clip(file, 8000)}`;
      let body: Record<string, unknown> | undefined;
      if (request !== undefined) {
        const q = r.requests[request - 1];
        if (!q)
          throw new Error(
            `no request ${request}; the run sent ${r.requests.length}`,
          );
        const json =
          typeof q.body === "string" ? q.body : JSON.stringify(q.body);
        const start = Math.min(offset, json.length);
        const end = Math.min(json.length, start + length);
        body = {
          request,
          ...bodyOf(q.body),
          offset: start,
          end,
          total: json.length,
          text: json.slice(start, end),
        };
      }
      const entry = tool === undefined ? undefined : toolEntry(r, tool);
      const entryBytes =
        entry && Buffer.byteLength(JSON.stringify(entry));
      return text(
        `${bin.version}: exit ${r.exit}, requests: ${sent.join(", ") || "none"}, files: ${Object.keys(r.files).join(", ") || "none"}.${tools.length ? `\ntools: ${tools.map((t) => t.join(" ")).join(" | ")}` : ""}${found ? `\nquery found in: ${found.join("; ") || "nothing"}` : ""}\nstdout: ${stdout}\nstderr: ${stderr}${shown}${
          body
            ? `\nrequest ${request}: ${body["bytes"]} bytes (tools ${body["tools"]}, system ${body["system"]}, messages ${body["messages"]}), cache_control at: ${(body["cacheControl"] as string[]).join(", ") || "none"}\nbody [${body["offset"]}, ${body["end"]}) of ${body["total"]}: ${body["text"]}`
            : ""
        }${
          tool === undefined
            ? ""
            : `\ntool ${tool}: ${entry ? `${entryBytes} bytes\n${JSON.stringify(entry)}` : "not sent"}`
        }`,
        {
          exit: r.exit,
          requests: sent,
          tools,
          found,
          stdout,
          stderr,
          ...(body && { body }),
          ...(tool !== undefined && { tool: entry ?? null }),
        },
      );
    },
    npm: async ({ name, packageVersion, query }) => {
      const pkg = await fetchPackage(need(name, "name"), packageVersion);
      const r = findText(pkg.dir, need(query, "query"));
      return text(
        `${name}@${pkg.version}: ${r.file ? `text found in ${r.file}` : r.short ? "text too short to name a package" : "text not found"}`,
        { package: name, version: pkg.version, ...r },
      );
    },
    prepare: ({ version }) => {
      const r = prepared(version);
      const skipped = Object.keys(r.index.skipped);
      return text(
        `${r.index.version}: ${r.parsed ? `${r.parsed} modules cleaned` : "read from the cache"}, ${r.index.units.length} units, ${r.ms} ms -> ${r.dir}${skipped.length ? `\nNot JavaScript: ${skipped.join(", ")}` : ""}`,
        {
          dir: r.dir,
          version: r.index.version,
          parsed: r.parsed,
          units: r.index.units.length,
          skipped,
          ms: r.ms,
        },
      );
    },
  },
  {
    version: P.version,
    query: P.query,
    regex: P.regex,
    name: P.name,
    module: P.module,
    offset: P.offset,
    limit: P.limit,
    context: z
      .number()
      .int()
      .min(0)
      .max(2000)
      .optional()
      .describe(
        "Characters shown around a search hit (default 150). A hit's `offset` is where the match starts in the module, the offset `read` takes; the snippet starts up to `context` characters before it.",
      ),
    view: z
      .string()
      .optional()
      .describe(
        'With read: "readable" gives the module through Wakaru (the first call per module runs it, then it is cached).',
      ),
    length: z
      .number()
      .int()
      .min(1)
      .max(MAX_CHARS)
      .optional()
      .describe(
        "Characters to read (default 4000); with cli and `request`, of the body JSON from `offset`.",
      ),
    prompt: z
      .string()
      .min(1)
      .optional()
      .describe(
        'With run: the prompt or slash command, such as "/verify ARG". `name` is the text that picks the user turn (default: the command tag).',
      ),
    env: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'With run or cli: extra environment variables, such as {"CLAUDE_CODE_USE_BEDROCK": "1"}. Names that run fixes (key, base URL, proxies, folders), and names or values that could carry a credential or route a request, are refused.',
      ),
    args: z
      .array(z.string())
      .optional()
      .describe(
        'With cli: the program args, such as ["--settings", "<project-dir>/s.json", "auto-mode", "config"]. `<project-dir>` and `<config-dir>` become the temp project and config folders.',
      ),
    files: z
      .record(z.string(), z.string())
      .optional()
      .describe(
        'With cli: files to write in the temp project folder first, by relative path, such as {"s.json": "{}"}.',
      ),
    replies: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'With cli: JSON replies of the stub by "METHOD /path", such as {"GET /api/oauth/profile": {...}}. "<stub>" in an env value becomes the stub URL.',
      ),
    packageVersion: z
      .string()
      .optional()
      .describe(
        "With npm: the version of the package in `name`; default: the latest, looked up once and kept.",
      ),
    login: z
      .enum(["key", "oauth"])
      .optional()
      .describe(
        'With cli: "key" (default) sets the fake API key; "oauth" writes a fake claude.ai login to .credentials.json instead.',
      ),
    show: z
      .string()
      .optional()
      .describe(
        'With cli: a .json, .jsonl, or .log file of the config folder, else of the project folder, to print at exit, such as ".claude.json", or "d.log" after `--debug-file d.log`.',
      ),
    apiHost: z
      .boolean()
      .optional()
      .describe(
        "With cli: the stub also answers https://api.anthropic.com (through a local proxy and a throw-away CA), for requests that ignore ANTHROPIC_BASE_URL, such as GET /api/oauth/profile.",
      ),
    baseUrl: z
      .boolean()
      .optional()
      .describe(
        "With cli: false leaves ANTHROPIC_BASE_URL unset, so that with apiHost the Messages API requests also go to https://api.anthropic.com, as on a direct connection.",
      ),
    calls: z
      .array(
        z.object({
          name: z.string(),
          input: z.record(z.string(), z.unknown()),
          safeguard: z.enum(["flagged", "not_flagged"]).optional(),
        }),
      )
      .optional()
      .describe(
        'With cli: the model calls these tools in order, one per turn, such as [{"name": "Bash", "input": {"command": "echo hi"}}], then answers OK after the last result. safeguard ("flagged" or "not_flagged") adds the server-side auto mode verdict for that call.',
      ),
    prompts: z
      .array(z.string())
      .min(1)
      .optional()
      .describe(
        'With cli: prompts sent in one session, as stream-json user messages on stdin; cli adds "-p --input-format stream-json --output-format stream-json --verbose" before `args`, so a hook that acts from the second prompt on runs.',
      ),
    request: z
      .number()
      .int()
      .min(1)
      .optional()
      .describe(
        "With cli: the number of a request in `requests`; gives the UTF-8 bytes of its body as compact JSON and of its tools, system, and messages, the path of each block with a cache_control, and the body JSON from `offset` for `length` characters.",
      ),
    tool: z
      .string()
      .optional()
      .describe(
        'With cli: a tool name; gives its entry (name, description, input_schema, ...) from the last Messages API request that sends it, and its size in bytes. A deferred tool is sent only after a ToolSearch call, such as calls [{"name": "ToolSearch", "input": {"query": "select:WebFetch"}}]. In print mode the program sends AskUserQuestion only with "--permission-prompt-tool" (such as "stdio") in `args`.',
      ),
  },
  { ...WRITES_CACHE, openWorldHint: true },
);
