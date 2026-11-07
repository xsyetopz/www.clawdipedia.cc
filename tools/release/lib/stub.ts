// Multi-tenant fake of the Messages API. One server, many cases: the base URL path starts with the case id.
// Never forwards anything, never stores credentials, answers with canned SSE or JSON.
import { appendFileSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FAKE_KEY } from "./env.ts";

export type StubCase = {
  log: string; // JSONL request log
  text?: string; // default "OK"
  tool?: string;
  toolInput?: unknown; // one tool_use on first turn
  seq?: { name: string; input: unknown }[]; // several tool turns
  respHeaders?: Record<string, string>;
  safeguard?: "flagged" | "not_flagged"; // server-side auto mode verdict for each tool call
  orchestrator?: {
    secret: string;
    hints: Record<string, unknown>[];
    assignment?: string; // runner mode: every work poll assigns this session id
    refuseRemote?: boolean; // runner mode: every session config fetch after the second gets a 400 with an error type
    runnerTokenTtlS?: number; // runner mode: the runner token is a JWT that expires in this many seconds, and POST /v1/code/auth/refresh issues the next one
  }; // self-hosted runner API: the first spawn-hints poll returns these hints, later polls none
  tooLongOn?: number; // answer the Nth POST /v1/messages with HTTP 400 "prompt is too long", as a full context does
  gapMs?: number; // wait this long between SSE events of a streamed reply
  deltas?: number; // split a text block into this many text_delta events
  refuseServerCheck?: boolean; // HTTP 400 for requests with the dangerous-tool-use beta, as a gateway that does not know it
};

export type LoggedRequest = {
  id: string;
  method: string;
  path: string;
  authIsFakeKey: boolean | null;
  bad: boolean; // a different key was sent: the runner fails the case
  headers: Record<string, string>; // allow-listed only
  headerNames?: string[]; // every header name sent (names only, no values)
  body: unknown;
};

const HEADER_ALLOW = new Set([
  "anthropic-beta",
  "anthropic-version",
  "content-type",
  "user-agent",
  "x-app",
  "x-stainless-lang",
  "x-stainless-package-version",
  "x-claude-code-session-id",
  "x-client-request-id",
  "accept",
  "x-api-key",
  "authorization",
]);

type Block = {
  type: string;
  text?: string;
  input?: unknown;
  [k: string]: unknown;
};
type ApiBody = {
  model?: string;
  stream?: boolean;
  messages?: { content?: unknown }[];
  tools?: { name: string }[];
};
type Msg = {
  id: string;
  type: "message";
  role: "assistant";
  model: string;
  content: Block[];
  stop_reason: string;
  stop_sequence: null;
  usage: Record<string, number>;
  safeguard_results?: unknown;
};

const sse = (ev: string, d: unknown) =>
  `event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`;
const USAGE = {
  input_tokens: 10,
  output_tokens: 5,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

const verdict = (m: Msg, o: StubCase): Msg => {
  const ids = m.content.flatMap((b) =>
    b.type === "tool_use" ? [b["id"]] : [],
  );
  return o.safeguard && ids.length > 0
    ? {
        ...m,
        safeguard_results: [
          {
            type: "dangerous_tool_use",
            status: {
              type: "available",
              tool_uses: Object.fromEntries(
                ids.map((id) => [
                  id,
                  { type: "evaluated", outcome: o.safeguard },
                ]),
              ),
            },
          },
        ],
      }
    : m;
};

const reply = (body: ApiBody | null, o: StubCase): Msg => {
  const msgs = body?.messages ?? [];
  const results = msgs.reduce(
    (a, m) =>
      a +
      (Array.isArray(m?.content)
        ? (m.content as Block[]).filter((b) => b.type === "tool_result").length
        : 0),
    0,
  );
  const names = (body?.tools ?? []).map((t) => t.name);
  const base = {
    id: "msg_probe",
    type: "message" as const,
    role: "assistant" as const,
    model: body?.model ?? "claude-sonnet-5-5",
    stop_sequence: null,
    usage: USAGE,
  };
  const nx = o.seq?.[results];
  if (nx && names.includes(nx.name))
    return {
      ...base,
      content: [
        {
          type: "tool_use",
          id: `toolu_probe${results}`,
          name: nx.name,
          input: nx.input,
        },
      ],
      stop_reason: "tool_use",
    };
  if (!o.seq && o.tool && results === 0 && names.includes(o.tool))
    return {
      ...base,
      content: [
        {
          type: "tool_use",
          id: "toolu_probe1",
          name: o.tool,
          input: o.toolInput ?? {},
        },
      ],
      stop_reason: "tool_use",
    };
  return {
    ...base,
    content: [{ type: "text", text: o.text ?? "OK" }],
    stop_reason: "end_turn",
  };
};

const stream = (m: Msg, deltas = 1): string => {
  const { safeguard_results: _, ...head } = m;
  let out = sse("message_start", {
    type: "message_start",
    message: { ...head, content: [], stop_reason: null },
  });
  m.content.forEach((b, i) => {
    const start =
      b.type === "text" ? { type: "text", text: "" } : { ...b, input: {} };
    const full = b.type === "text" ? (b.text ?? "") : JSON.stringify(b.input);
    const n = b.type === "text" ? Math.max(1, deltas) : 1;
    const size = Math.ceil(full.length / n) || 1;
    const parts = Array.from({ length: n }, (_, k) =>
      full.slice(k * size, (k + 1) * size),
    );
    out += sse("content_block_start", {
      type: "content_block_start",
      index: i,
      content_block: start,
    });
    for (const p of parts)
      out += sse("content_block_delta", {
        type: "content_block_delta",
        index: i,
        delta:
          b.type === "text"
            ? { type: "text_delta", text: p }
            : { type: "input_json_delta", partial_json: p },
      });
    out += sse("content_block_stop", { type: "content_block_stop", index: i });
  });
  out += sse("message_delta", {
    type: "message_delta",
    delta: {
      stop_reason: m.stop_reason,
      stop_sequence: null,
      ...(m.safeguard_results !== undefined && {
        safeguard_results: m.safeguard_results,
      }),
    },
    usage: { output_tokens: 5 },
  });
  return out + sse("message_stop", { type: "message_stop" });
};

const MEMORY_TOOLS = ["read", "write", "str_replace", "append"].map((t) => ({
  name: `memory_${t}`,
  description: `memory ${t}`,
  inputSchema: { type: "object", properties: {} },
}));
/** Minimal streamable-HTTP MCP server for the cloud memory path: lists the memory tools, answers each call with "ok". */
const memoryMcp = (body: unknown): Response => {
  const q = body as {
    id?: number | string;
    method?: string;
    params?: { protocolVersion?: string };
  } | null;
  if (q?.id === undefined) return new Response(null, { status: 202 });
  const result =
    q.method === "initialize"
      ? {
          protocolVersion: q.params?.protocolVersion ?? "2025-06-18",
          capabilities: { tools: {} },
          serverInfo: { name: "memory", version: "1" },
        }
      : q.method === "tools/list"
        ? { tools: MEMORY_TOOLS }
        : q.method === "tools/call"
          ? { content: [{ type: "text", text: "ok" }] }
          : {};
  return Response.json({ jsonrpc: "2.0", id: q.id, result });
};

/** The same events as `stream`, one every `gapMs` ms. */
const slowStream = (
  text: string,
  gapMs: number,
): ReadableStream<Uint8Array> => {
  const events = text.split("\n\n").filter(Boolean);
  const enc = new TextEncoder();
  let i = 0;
  return new ReadableStream({
    async pull(c) {
      if (i >= events.length) return c.close();
      if (i > 0) await Bun.sleep(gapMs);
      c.enqueue(enc.encode(`${events[i++]}\n\n`));
    },
  });
};

export type Stub = {
  port: number;
  register(id: string, c: StubCase): string;
  unregister(id: string): void;
  stop(): LoggedRequest[]; // returns the stray requests (and removes the stray log)
  strayLog: string; // requests whose first path segment is not a registered case (bad=true)
};

const RUNNER_TOKEN = "probe-runner-token";
const SESSION_TOKEN = "probe-session-token";
const issuedJwts = new Set<string>();
const mintRunnerJwt = (ttlS: number): string => {
  const b64u = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString("base64url");
  const jwt = `${b64u({ alg: "none" })}.${b64u({ exp: Math.floor(Date.now() / 1000) + ttlS, jti: crypto.randomUUID() })}.sig`;
  issuedJwts.add(jwt);
  return jwt;
};

export const startStub = (
  port: number,
  strayLog = join(
    tmpdir(),
    `cc-release-stub-stray-${process.pid}-${port}.jsonl`,
  ),
): Stub => {
  writeFileSync(strayLog, "");
  const cases = new Map<string, StubCase>();
  const calls = new Map<string, number>();
  const server = Bun.serve({
    port,
    hostname: "127.0.0.1",
    async fetch(req) {
      const url = new URL(req.url);
      // the cloud memory server must sit at the origin root, so its case id is the session id
      const mem = url.pathname.match(
        /^\/v2\/ccr-sessions\/([A-Za-z0-9_-]+)\/memory\/mcp$/,
      );
      const m = url.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9._-]*)(\/.*)$/);
      const key = mem?.[1] ?? m?.[1];
      const id = key && cases.has(key) ? key : "";
      if (id && m?.[2] && !mem) url.pathname = m[2];
      const o = cases.get(id) ?? { log: strayLog };
      const headers: Record<string, string> = {};
      let auth: boolean | null = null;
      req.headers.forEach((v, k) => {
        if (k === "x-api-key" || k === "authorization") {
          headers[k] = "<redacted>";
          const ok =
            v === FAKE_KEY ||
            v === `Bearer ${FAKE_KEY}` ||
            (o.orchestrator !== undefined &&
              (v === `Bearer ${o.orchestrator.secret}` ||
                v === `Bearer ${RUNNER_TOKEN}` ||
                v === `Bearer ${SESSION_TOKEN}` ||
                issuedJwts.has(v.replace("Bearer ", ""))));
          auth = auth === false ? false : ok;
        } else if (HEADER_ALLOW.has(k)) headers[k] = v;
      });
      const raw = await req.text();
      let body: unknown = raw;
      try {
        body = JSON.parse(raw);
      } catch {
        // keep raw text
      }
      if (o.log) {
        const rec: LoggedRequest = {
          id,
          method: req.method,
          path: url.pathname + url.search,
          authIsFakeKey: auth,
          bad: auth === false || !id,
          headers,
          headerNames: [...req.headers.keys()].sort(),
          body,
        };
        appendFileSync(o.log, `${JSON.stringify(rec)}\n`);
      }
      if (url.pathname === "/v1/messages" && req.method === "POST") {
        const beta = req.headers.get("anthropic-beta") ?? "";
        const refused = beta
          .split(",")
          .find((b) => b.trim().startsWith("dangerous-tool-use"));
        if (o.refuseServerCheck && refused)
          return Response.json(
            {
              type: "error",
              error: {
                type: "invalid_request_error",
                message: `Unexpected value(s) \`${refused.trim()}\` for the \`anthropic-beta\` header. Please consult our documentation at docs.claude.com or try again without the header.`,
              },
            },
            { status: 400 },
          );
        const nth = (calls.get(id) ?? 0) + 1;
        calls.set(id, nth);
        if (o.tooLongOn === nth)
          return Response.json(
            {
              type: "error",
              error: {
                type: "invalid_request_error",
                message: "prompt is too long: 250000 tokens > 200000 maximum",
              },
            },
            { status: 400 },
          );
        const msg = verdict(reply(body as ApiBody | null, o), o);
        const extra = o.respHeaders ?? {};
        if ((body as ApiBody | null)?.stream)
          return new Response(
            o.gapMs
              ? slowStream(stream(msg, o.deltas), o.gapMs)
              : stream(msg, o.deltas),
            { headers: { "content-type": "text/event-stream", ...extra } },
          );
        return Response.json(msg, { headers: extra });
      }
      if (o.orchestrator) {
        const ses = url.pathname.match(/^\/v1\/code\/sessions\/([^/]+)\/(.*)$/);
        if (ses && req.method === "GET" && ses[2] === "remote") {
          const nth = (calls.get(`${id}:remote`) ?? 0) + 1;
          calls.set(`${id}:remote`, nth);
          if (nth > 2 && o.orchestrator.refuseRemote)
            return Response.json(
              {
                error: {
                  type: "invalid_request_error",
                  message: "renewal refused",
                },
              },
              { status: 400 },
            );
        }
        if (ses && req.method === "GET" && ses[2] === "remote")
          return Response.json({
            api_base_url: `${url.origin}/${id}`,
            inference_auth: {
              access_token: FAKE_KEY,
              expires_in_seconds: 10,
            },
          });
        if (ses && ses[2] === "worker/register")
          return Response.json({ worker_epoch: 1 });
        if (ses?.[2]?.startsWith("worker")) return Response.json({});
      }
      if (o.orchestrator && req.method === "POST") {
        const base = "/v1/code/runners/self-hosted/";
        if (url.pathname === `${base}spawn-hints/poll`) {
          const nth = (calls.get(`${id}:poll`) ?? 0) + 1;
          calls.set(`${id}:poll`, nth);
          return Response.json({
            hints: nth === 1 ? o.orchestrator.hints : [],
            warm_hints: [],
            pending_count: 0,
            backing_off_count: 0,
            circuit_broken_count: 0,
          });
        }
        if (url.pathname === `${base}spawn-hints/nack`)
          return Response.json({});
        const ttl = o.orchestrator.runnerTokenTtlS;
        if (ttl !== undefined && url.pathname === "/v1/code/auth/refresh")
          return Response.json({ token: mintRunnerJwt(ttl) });
        if (url.pathname === `${base}runners/register`)
          return Response.json({
            runner_id: "runner-probe",
            runner_token: ttl === undefined ? RUNNER_TOKEN : mintRunnerJwt(ttl),
          });
        if (url.pathname === `${base}runners/runner-probe/poll`) {
          return Response.json({
            assignment_ids: o.orchestrator.assignment
              ? [o.orchestrator.assignment]
              : [],
          });
        }
        if (/\/sessions\/[^/]+\/token$/.test(url.pathname))
          return Response.json({ session_token: SESSION_TOKEN });
        if (/\/sessions\/[^/]+\/(release|report-failure)$/.test(url.pathname))
          return Response.json({
            released: true,
            excluded_count: 0,
            stuck: false,
          });
        if (url.pathname === `${base}deregister`) return Response.json({});
      }
      if (mem && id) return memoryMcp(body);
      if (url.pathname === "/v1/messages/count_tokens")
        return Response.json({ input_tokens: 10 });
      return new Response("{}", {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    },
  });
  return {
    port: server.port ?? port,
    register(id, c) {
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) || id.includes(".."))
        throw new Error(`bad case id: ${id}`);
      writeFileSync(c.log, "");
      cases.set(id, c);
      calls.delete(id);
      return `http://127.0.0.1:${server.port}/${id}`;
    },
    strayLog,
    unregister: (id) => void cases.delete(id),
    stop() {
      server.stop(true);
      let stray: LoggedRequest[] = [];
      try {
        stray = readLog(strayLog);
      } catch {
        // already gone
      }
      rmSync(strayLog, { force: true });
      return stray;
    },
  };
};

export const readLog = (log: string): LoggedRequest[] =>
  readFileSync(log, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => JSON.parse(l) as LoggedRequest);
