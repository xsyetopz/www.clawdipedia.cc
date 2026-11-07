// Runs the program once, in print mode or with other args, against a local fake Messages API and keeps each request it sends.
// Free: a fake key, a dead proxy for any request that skips the stub, a temp HOME, config dir, and project,
// and a `security` shim on PATH, since with a temp HOME macOS would show a "Keychain Not Found" dialog.
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, normalize } from "node:path";
import { makePki } from "./pki.ts";
import { filesOf } from "./requests.ts";

export const FAKE_KEY = "sk-ant-fake-probe";
/** The host that `apiHost` lets the stub answer. */
export const API_HOST = "api.anthropic.com";
export type Sent = {
  method: string;
  path: string;
  host: string;
  fakeKey: boolean | null;
  body: unknown;
};
export type Dirs = { home: string; config: string; project: string };
export type RunResult = {
  exit: number;
  requests: Sent[];
  stdout: string;
  stderr: string;
  /** The stream-json events the program wrote to stdout. */
  events: Record<string, unknown>[];
  files: Record<string, string>; // The `.jsonl` files of the config folder at exit, such as the transcript.
  dirs: Dirs;
};

const sse = (ev: string, d: unknown) =>
  `event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;
const MESSAGE = {
  id: "msg_probe",
  type: "message",
  role: "assistant",
  content: [{ type: "text", text: "OK" }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
};
type Tool = {
  name: string;
  input: Record<string, unknown>;
  safeguard?: "flagged" | "not_flagged";
};
type Call = Tool & { id: string };
// The verdict of the server-side auto mode check, in the shape the program parses.
const safeguardOf = (call?: Call) =>
  call?.safeguard && {
    safeguard_results: [
      {
        type: "dangerous_tool_use",
        status: {
          type: "available",
          tool_uses: {
            [call.id]: { type: "evaluated", outcome: call.safeguard },
          },
        },
      },
    ],
  };
const streamOf = (tool?: Call) =>
  sse("message_start", {
    type: "message_start",
    message: { ...MESSAGE, content: [], stop_reason: null },
  }) +
  sse("content_block_start", {
    type: "content_block_start",
    index: 0,
    content_block: tool
      ? { type: "tool_use", id: tool.id, name: tool.name, input: {} }
      : { type: "text", text: "" },
  }) +
  sse("content_block_delta", {
    type: "content_block_delta",
    index: 0,
    delta: tool
      ? { type: "input_json_delta", partial_json: JSON.stringify(tool.input) }
      : { type: "text_delta", text: "OK" },
  }) +
  sse("content_block_stop", { type: "content_block_stop", index: 0 }) +
  sse("message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: tool ? "tool_use" : "end_turn",
      stop_sequence: null,
      ...safeguardOf(tool),
    },
    usage: { output_tokens: 5 },
  }) +
  sse("message_stop", { type: "message_stop" });
// Call k answers the main turn that holds k tool results; side requests (titles, classifiers) lack the tool.
// Each call has its own id: with one shared id, 2.1.319 looped on the second call.
const callOf = (body: unknown, calls: Tool[]) => {
  const b = body as {
    tools?: { name?: string }[];
    messages?: { content?: unknown }[];
  } | null;
  const done = (b?.messages ?? []).flatMap((m) =>
    Array.isArray(m.content)
      ? m.content.filter((c) => c?.type === "tool_result")
      : [],
  ).length;
  const call = calls[done];
  return call && b?.tools?.some((t) => t.name === call.name)
    ? { id: `toolu_probe_${done}`, ...call }
    : undefined;
};

// Names that name a credential, or that could send a request past the stub and the dead proxy.
const UNSAFE =
  /KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|SESSION|PROXY|BASE_URL|ENDPOINT|HEADERS|^(NODE|BUN)_OPTIONS$|^(LD|DYLD)_/i;
const tempDir = (p: string) => realpathSync(mkdtempSync(join(tmpdir(), p)));

/**
 * Run `prompt` (a slash command such as `/verify ARG`, or plain text) with `-p`, and return what the program sent.
 * Throws when a request has another host or key, or when the program does not end in `timeoutMs`.
 * The folders in `dirs` are removed before it returns.
 */
export const runPrompt = (
  bin: string,
  prompt: string,
  model = "claude-opus-5-5",
  timeoutMs = 60000,
  env: Record<string, string> = {},
): Promise<RunResult> =>
  runArgs(
    bin,
    [
      "-p",
      prompt,
      "--output-format",
      "stream-json",
      "--verbose",
      "--model",
      model,
    ],
    { timeoutMs, env },
  );

/**
 * Run the program with `args`, such as a subcommand, in the same safe setup as `runPrompt`.
 * `files` are written in the project folder first. `<project-dir>` and `<config-dir>` in an arg become their paths.
 */
export const runArgs = async (
  bin: string,
  args: string[],
  {
    timeoutMs = 60000,
    env = {},
    files = {},
    replies = {},
    login = "key",
    apiHost = false,
    baseUrl = true,
    calls,
  }: {
    timeoutMs?: number;
    env?: Record<string, string>;
    files?: Record<string, string>;
    /** Stub replies by `METHOD /path` (no query), such as `GET /api/oauth/profile`. */
    replies?: Record<string, unknown>;
    /** `oauth`: a claude.ai login in `.credentials.json` whose token is the fake key, and no API key. */
    login?: "key" | "oauth";
    /**
     * The stub also answers `https://api.anthropic.com`, for requests whose base URL no setting changes
     * (the OAuth profile). A CONNECT proxy sends that host to a TLS copy of the stub with a throw-away CA;
     * it refuses every other host.
     */
    apiHost?: boolean;
    /** `false` leaves `ANTHROPIC_BASE_URL` unset, so that with `apiHost` the Messages API requests also go to `https://api.anthropic.com`. */
    baseUrl?: boolean;
    /** The model calls these tools in order, one per turn, such as `[{ name: "Bash", input: { command: "echo hi" } }]`. `safeguard` adds the server-side auto mode verdict for the call. */
    calls?: Tool[];
  } = {},
): Promise<RunResult> => {
  for (const name of Object.keys(files))
    if (isAbsolute(name) || normalize(name).startsWith(".."))
      throw new Error(`file ${name} is outside the project`);
  const made: string[] = [];
  let stub: ReturnType<typeof Bun.serve> | undefined;
  let tls: ReturnType<typeof Bun.serve> | undefined;
  let proxy: http.Server | undefined;
  try {
    const mk = (p: string) => {
      const d = tempDir(p);
      made.push(d);
      return d;
    };
    const dirs: Dirs = {
      home: mk("cc-run-home-"),
      config: mk("cc-run-cfg-"),
      project: mk("cc-run-proj-"),
    };
    const shim = join(dirs.home, ".probe-bin");
    mkdirSync(shim);
    writeFileSync(
      join(shim, "security"),
      '#!/bin/sh\n[ "$1" = "-i" ] && cat >/dev/null\nexit 44\n',
    );
    chmodSync(join(shim, "security"), 0o755);
    const requests: Sent[] = [];
    const answer = async (req: Request): Promise<Response> => {
      const key =
        req.headers.get("x-api-key") ??
        req.headers.get("authorization")?.replace(/^Bearer /, "");
      const raw = await req.text();
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {}
      const url = new URL(req.url);
      requests.push({
        method: req.method,
        path: url.pathname + url.search,
        host: req.headers.get("host") ?? "",
        fakeKey: key == null ? null : key === FAKE_KEY,
        body,
      });
      if (url.pathname === "/v1/messages" && req.method === "POST") {
        const call = calls && callOf(body, calls);
        return (body as { stream?: boolean })?.stream
          ? new Response(streamOf(call), {
              headers: { "content-type": "text/event-stream" },
            })
          : Response.json(
              call
                ? {
                    ...MESSAGE,
                    content: [
                      {
                        type: "tool_use",
                        id: call.id,
                        name: call.name,
                        input: call.input,
                      },
                    ],
                    stop_reason: "tool_use",
                    ...safeguardOf(call),
                  }
                : MESSAGE,
            );
      }
      if (url.pathname === "/v1/messages/count_tokens")
        return Response.json({ input_tokens: 10 });
      const reply = replies[`${req.method} ${url.pathname}`];
      // The program trusts a profile reply only with a `req_` request id, as the real API sends.
      if (reply !== undefined)
        return Response.json(reply, { headers: { "request-id": "req_probe" } });
      return Response.json({}, { status: 404 });
    };
    stub = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: answer });
    const self = `127.0.0.1:${stub.port}`;
    // Fail closed: a request that skips the stub goes to a dead proxy.
    let proxyUrl = "http://127.0.0.1:9";
    const extra: Record<string, string> = {};
    if (apiHost) {
      const pki = makePki(mk("cc-run-pki-"));
      tls = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        tls: { key: Bun.file(pki.key), cert: Bun.file(pki.cert) },
        fetch: answer,
      });
      const tlsPort = tls.port ?? 0;
      proxy = http.createServer((_q, r) => {
        r.statusCode = 405;
        r.end();
      });
      proxy.on("connect", (req, sock, head) => {
        sock.on("error", () => sock.destroy());
        if (req.url !== `${API_HOST}:443`) {
          sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
          return;
        }
        const up = net.connect(tlsPort, "127.0.0.1", () => {
          sock.write("HTTP/1.1 200 OK\r\n\r\n");
          if (head.length) up.write(head);
          sock.pipe(up);
          up.pipe(sock);
        });
        up.on("error", () => sock.destroy());
        sock.on("close", () => up.destroy());
      });
      const px = proxy;
      const port = await new Promise<number>((res, rej) => {
        px.once("error", rej);
        px.listen(0, "127.0.0.1", () =>
          res((px.address() as net.AddressInfo).port),
        );
      });
      proxyUrl = `http://127.0.0.1:${port}`;
      extra["NODE_EXTRA_CA_CERTS"] = pki.ca;
    }
    const fixed: Record<string, string> = {
      PATH: `${shim}:${process.env["PATH"] ?? ""}`,
      HOME: dirs.home,
      TMPDIR: tmpdir(),
      CLAUDE_CONFIG_DIR: dirs.config,
      ...(login === "key" && { ANTHROPIC_API_KEY: FAKE_KEY }),
      ...(baseUrl && { ANTHROPIC_BASE_URL: `http://${self}` }),
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      DISABLE_TELEMETRY: "1",
      HTTPS_PROXY: proxyUrl,
      HTTP_PROXY: proxyUrl,
      NO_PROXY: "127.0.0.1,localhost",
      // The AWS SDK reaches 169.254.169.254 directly, not through the proxy.
      AWS_EC2_METADATA_DISABLED: "true",
      ...extra,
    };
    for (const [k, v] of Object.entries(env))
      if (k.toUpperCase() in fixed || UNSAFE.test(k) || v.includes("sk-ant-"))
        throw new Error(
          `env ${k} is not allowed: run fixes it, or it could carry a credential or route a request`,
        );
    if (login === "oauth")
      writeFileSync(
        join(dirs.config, ".credentials.json"),
        JSON.stringify({
          claudeAiOauth: {
            accessToken: FAKE_KEY,
            refreshToken: FAKE_KEY,
            expiresAt: Date.now() + 86400000,
            scopes: ["user:inference", "user:profile"],
            subscriptionType: null,
          },
        }),
      );
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dirs.project, name)), { recursive: true });
      writeFileSync(join(dirs.project, name), body);
    }
    const p = Bun.spawn(
      [
        bin,
        ...args.map((a) =>
          a
            .replaceAll("<project-dir>", dirs.project)
            .replaceAll("<config-dir>", dirs.config),
        ),
      ],
      {
        cwd: dirs.project,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
        env: {
          ...fixed,
          ...Object.fromEntries(
            Object.entries(env).map(([k, v]) => [
              k,
              v.replaceAll("<stub>", `http://${self}`),
            ]),
          ),
        },
      },
    );
    const err = new Response(p.stderr).text();
    // Read stdout as it comes, so a killed run still shows the events before the hang.
    let out = "";
    const dec = new TextDecoder();
    const read = (async () => {
      for await (const c of p.stdout) out += dec.decode(c, { stream: true });
    })().catch(() => {});
    let timedOut = false;
    const t = setTimeout(() => {
      timedOut = true;
      p.kill("SIGKILL");
    }, timeoutMs);
    let exit: number;
    try {
      exit = await p.exited;
    } finally {
      clearTimeout(t);
    }
    // A child the program left running can hold stderr open.
    const [stderr] = await Promise.all([
      Promise.race([err, Bun.sleep(1000).then(() => "")]),
      Promise.race([read, Bun.sleep(1000)]),
    ]);
    const events = out.split("\n").flatMap((l) => {
      try {
        const e = JSON.parse(l);
        return e && typeof e === "object" ? [e as Record<string, unknown>] : [];
      } catch {
        return [];
      }
    });
    if (timedOut)
      throw new Error(
        `the program did not end in ${timeoutMs} ms; events: ${events.map((e) => `${e["type"]}/${e["subtype"] ?? ""}`).join(" ") || "none"}; stderr: ${stderr.slice(-2000)}`,
      );
    const bad = requests.filter(
      (r) =>
        r.fakeKey === false ||
        (r.host !== self && !(apiHost && r.host === API_HOST)),
    );
    if (bad.length)
      throw new Error(
        `a request had another host or key: ${bad.map((r) => `${r.host}${r.path}`).join(", ")}`,
      );
    const wrote = filesOf(dirs.config);
    return { exit, requests, stdout: out, stderr, events, files: wrote, dirs };
  } finally {
    stub?.stop(true);
    tls?.stop(true);
    proxy?.close();
    proxy?.closeAllConnections();
    for (const d of made) rmSync(d, { recursive: true, force: true });
  }
};

type Msg = { role?: string; content?: unknown };
const textsOf = (m: Msg): string[] =>
  typeof m.content === "string"
    ? [m.content]
    : Array.isArray(m.content)
      ? (m.content as { type?: string; text?: string }[])
          .filter((b) => b.type === "text" && typeof b.text === "string")
          .map((b) => b.text as string)
      : [];

/**
 * The text blocks of the first user turn that holds `mark`, from the block that holds it to the end
 * (blocks the program puts before, such as reminders, are left out). Temp folders become `<home>`,
 * `<config-dir>`, `<project-dir>`, `<bundled-skill-dir>`, and `<temp-dir>`. Null when no request holds it.
 */
export const userText = (
  r: Pick<RunResult, "requests" | "dirs">,
  mark: string,
): string | null => {
  for (const q of r.requests) {
    if (!q.path.startsWith("/v1/messages") || q.path.includes("count_tokens"))
      continue;
    for (const m of (q.body as { messages?: Msg[] } | null)?.messages ?? []) {
      if (m.role !== "user") continue;
      const texts = textsOf(m);
      const i = texts.findIndex((t) => t.includes(mark));
      if (i < 0) continue;
      return texts
        .slice(i)
        .map((t) => t.trimEnd())
        .join("\n\n")
        .replaceAll(r.dirs.home, "<home>")
        .replaceAll(r.dirs.config, "<config-dir>")
        .replaceAll(r.dirs.project, "<project-dir>")
        .replace(
          /\S*\/bundled-skills\/[^/\s]+\/[0-9a-f]+/g,
          "<bundled-skill-dir>",
        )
        .replaceAll(realpathSync(tmpdir()), "<temp-dir>")
        .replaceAll(tmpdir().replace(/\/$/, ""), "<temp-dir>");
    }
  }
  return null;
};
