// Result and negative checks of release:check --selftest: the facts a result lists, refused secrets and paths.
import { join } from "node:path";
import { factsForProbe } from "../facts/map.ts";
import { childEnv, PROMPT } from "../lib/env.ts";
import { gatewayYaml, mintJwt } from "../lib/gateway.ts";
import { startOtlp, valuesOf } from "../lib/otlp.ts";
import { openRun, readRun, writeCase } from "../lib/results.ts";
import { makeSandbox } from "../lib/sandbox.ts";
import { readLog, type startStub } from "../lib/stub.ts";
import { runCases } from "../probes/print/run/helpers.ts";
import type { Ctx } from "../util.ts";

export type ResultChecks = {
  ctx: Ctx;
  step: (name: string, ok: boolean, detail?: string) => void;
  sb: ReturnType<typeof makeSandbox>;
  stub: ReturnType<typeof startStub>;
  stubPort: number;
  out: string;
  /** the run dir that openRun made for the smoke case */
  dir: string;
};

export const runResultChecks = async (c: ResultChecks): Promise<void> => {
  const { ctx, step, sb, stub, stubPort, out, dir } = c;
  // a probe result lists the facts that map.json maps to its case, without each probe asking
  // a print case whose required file is missing is skipped with a reason, not marked invalid, and does not run
  let ran = false;
  const gone = join(out, "no-such-file");
  const sk = await runCases(
    { version: ctx.to, bin: "", runDir: out, dry: false },
    "selftest",
    [
      {
        name: "needs-file",
        requires: { path: gone, reason: "needs a file" },
        run: async () => {
          ran = true;
          return { data: {} };
        },
      },
    ],
  );
  step(
    "a print case with a missing required file is skipped, not invalid",
    !ran &&
      sk.length === 1 &&
      typeof sk[0]?.data["skipped"] === "string" &&
      sk[0]?.data["precondition"] === undefined,
    String(sk[0]?.data["skipped"] ?? "no result"),
  );
  const mapped = factsForProbe("print.control.requests");
  writeCase(openRun("0.0.1", out), {
    schema: 1,
    id: "print.control.requests",
    group: "print",
    version: ctx.to,
    prompt: PROMPT,
    args: [],
    envSet: [],
    exit: 0,
    timedOut: false,
    data: {},
    facts: ["control.own"],
  });
  const listed = readRun("0.0.1", out)[0]?.facts ?? [];
  step(
    "writeCase adds the map.json facts of the case",
    mapped.length > 0 &&
      [...mapped, "control.own"].every((c) => listed.includes(c)),
    `${listed.length} listed, ${mapped.length} mapped`,
  );
  let refused = false;
  try {
    writeCase(dir, {
      schema: 1,
      id: "print.selftest.leak",
      group: "print",
      version: ctx.to,
      prompt: PROMPT,
      args: [],
      envSet: [],
      exit: 0,
      timedOut: false,
      data: { k: "sk-ant-oat01-abcdef" },
      facts: [],
    });
  } catch {
    refused = true;
  }
  step("writeCase refuses secret-shaped strings", refused);

  // Cheap negative checks.
  const base = {
    home: sb.home,
    configDir: sb.cfg,
    baseUrl: "http://127.0.0.1:1/x",
  };
  const throws = (f: () => unknown): boolean => {
    try {
      f();
      return false;
    } catch {
      return true;
    }
  };
  step(
    "childEnv accepts *_TOKENS names",
    !throws(() =>
      childEnv({ ...base, extra: { CLAUDE_CODE_MAX_OUTPUT_TOKENS: "9" } }),
    ),
  );
  step(
    "childEnv: extra cannot overwrite fixed keys",
    throws(() => childEnv({ ...base, extra: { HOME: "/x" } })) &&
      !throws(() =>
        childEnv({ ...base, extra: { HOME: "/x" }, allowOverride: ["HOME"] }),
      ),
  );
  step(
    "stub: dotted ids ok, '..' rejected, stray requests logged bad",
    !throws(() =>
      stub.register("print.a.b", { log: join(sb.root, "d.jsonl") }),
    ) &&
      throws(() => stub.register("a..b", { log: join(sb.root, "e.jsonl") })) &&
      (await fetch(`http://127.0.0.1:${stubPort}/nope/v1/messages`, {
        method: "POST",
        body: "{}",
      }).then(() => readLog(stub.strayLog).some((r) => r.bad))),
  );
  const sgUrl = stub.register("sg", {
    log: join(sb.root, "sg.jsonl"),
    seq: [{ name: "Bash", input: { command: "true" } }],
    safeguard: "flagged",
  });
  const ask = (stream: boolean) =>
    fetch(`${sgUrl}/v1/messages`, {
      method: "POST",
      body: JSON.stringify({ stream, tools: [{ name: "Bash" }], messages: [] }),
    }).then((r) => r.text());
  const sgVerdict = JSON.stringify([
    {
      type: "dangerous_tool_use",
      status: {
        type: "available",
        tool_uses: { toolu_probe0: { type: "evaluated", outcome: "flagged" } },
      },
    },
  ]);
  const [sgPlain, sgStream] = [await ask(false), await ask(true)];
  const sgDelta =
    sgStream
      .split("\n")
      .find((l) => l.includes("message_delta") && l.startsWith("data:")) ?? "";
  step(
    "stub: safeguard puts the auto mode verdict on the tool call, in plain and streamed replies",
    JSON.stringify(JSON.parse(sgPlain).safeguard_results) === sgVerdict &&
      JSON.stringify(JSON.parse(sgDelta.slice(5)).delta.safeguard_results) ===
        sgVerdict &&
      sgStream.split("safeguard_results").length === 2,
  );
  const gapUrl = stub.register("gap", {
    log: join(sb.root, "gap.jsonl"),
    text: "abcdef",
    deltas: 3,
    gapMs: 150,
  });
  const gapStart = Date.now();
  const gapText = await fetch(`${gapUrl}/v1/messages`, {
    method: "POST",
    body: JSON.stringify({ stream: true, messages: [] }),
  }).then((r) => r.text());
  step(
    "stub: gapMs spaces the events of a streamed reply and deltas splits the text",
    Date.now() - gapStart >= 150 * 7 &&
      gapText.split("event: content_block_delta").length === 4 &&
      gapText.includes('"text":"ab"') &&
      gapText.includes('"text":"ef"'),
  );
  const tlUrl = stub.register("tl", {
    log: join(sb.root, "tl.jsonl"),
    tooLongOn: 2,
  });
  const askTl = () =>
    fetch(`${tlUrl}/v1/messages`, {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    }).then(async (r) => [r.status, await r.text()] as const);
  const [tl1, tl2, tl3] = [await askTl(), await askTl(), await askTl()];
  step(
    "stub: tooLongOn answers only the Nth messages request with the prompt-is-too-long 400",
    tl1[0] === 200 &&
      tl2[0] === 400 &&
      /^prompt is too long: \d+ tokens > \d+ maximum$/.test(
        JSON.parse(tl2[1]).error.message,
      ) &&
      tl3[0] === 200,
  );
  const orUrl = stub.register("orch", {
    log: join(sb.root, "orch.jsonl"),
    orchestrator: {
      secret: "pool-secret",
      assignment: "sess-1",
      hints: [{ session_uuid: "s1", attempt: 1 }],
    },
  });
  const poll = () =>
    fetch(`${orUrl}/v1/code/runners/self-hosted/spawn-hints/poll`, {
      method: "POST",
      headers: { authorization: "Bearer pool-secret" },
      body: "{}",
    }).then((r) => r.json() as Promise<{ hints: { session_uuid: string }[] }>);
  const [op1, op2] = [await poll(), await poll()];
  step(
    "stub: orchestrator returns its hints to the first spawn-hints poll and none to later polls",
    op1.hints.length === 1 &&
      op1.hints[0]?.session_uuid === "s1" &&
      op2.hints.length === 0 &&
      readLog(join(sb.root, "orch.jsonl")).every((r) => !r.bad),
  );
  const workOf = async (path: string) =>
    fetch(`${orUrl}/v1/code/runners/self-hosted/${path}`, {
      method: "POST",
      headers: { authorization: "Bearer pool-secret" },
      body: "{}",
    }).then((r) => r.json() as Promise<Record<string, unknown>>);
  const reg = await workOf("runners/register");
  const w1 = await workOf("runners/runner-probe/poll");
  const w2 = await workOf("runners/runner-probe/poll");
  step(
    "stub: orchestrator registers a runner, keeps its session assigned, and issues a session token",
    reg["runner_id"] === "runner-probe" &&
      typeof reg["runner_token"] === "string" &&
      JSON.stringify(w1["assignment_ids"]) === '["sess-1"]' &&
      JSON.stringify(w2["assignment_ids"]) === '["sess-1"]' &&
      (await workOf("sessions/sess-1/token"))["session_token"] ===
        "probe-session-token",
  );
  const jwtUrl = stub.register("jwt", {
    log: join(sb.root, "jwt.jsonl"),
    orchestrator: { secret: "pool-secret", hints: [], runnerTokenTtlS: 8 },
  });
  const jwtPost = (path: string) =>
    fetch(`${jwtUrl}${path}`, {
      method: "POST",
      headers: { authorization: "Bearer pool-secret" },
      body: "{}",
    }).then((r) => r.json() as Promise<Record<string, string>>);
  const expOf = (jwt: string | undefined) =>
    JSON.parse(Buffer.from(jwt?.split(".")[1] ?? "", "base64url").toString())
      .exp as number;
  const jwtReg = await jwtPost("/v1/code/runners/self-hosted/runners/register");
  const jwtNext = await jwtPost("/v1/code/auth/refresh");
  step(
    "stub: runnerTokenTtlS issues a JWT runner token that expires in that many seconds, and auth/refresh issues the next one",
    expOf(jwtReg["runner_token"]) - Date.now() / 1000 <= 8 &&
      expOf(jwtReg["runner_token"]) > Date.now() / 1000 &&
      typeof jwtNext["token"] === "string" &&
      jwtNext["token"] !== jwtReg["runner_token"],
  );
  const rrUrl = stub.register("rr", {
    log: join(sb.root, "rr.jsonl"),
    orchestrator: { secret: "pool-secret", hints: [], refuseRemote: true },
  });
  const remote = () =>
    fetch(`${rrUrl}/v1/code/sessions/s1/remote`).then((r) => r.status);
  step(
    "stub: refuseRemote answers the first two session config fetches and refuses later ones with 400",
    (await remote()) === 200 &&
      (await remote()) === 200 &&
      (await remote()) === 400,
  );
  const rfUrl = stub.register("rf", {
    log: join(sb.root, "rf.jsonl"),
    refuseServerCheck: true,
  });
  const askBeta = (beta: string) =>
    fetch(`${rfUrl}/v1/messages`, {
      method: "POST",
      headers: { "anthropic-beta": beta },
      body: JSON.stringify({ messages: [] }),
    }).then((r) => r.status);
  step(
    "stub: refuseServerCheck answers 400 only to the dangerous-tool-use beta",
    (await askBeta("oauth-2025-04-20,dangerous-tool-use-2026-09-03")) === 400 &&
      (await askBeta("oauth-2025-04-20")) === 200,
  );
  const mcp = (body: unknown) =>
    fetch(`${new URL(rfUrl).origin}/v2/ccr-sessions/rf/memory/mcp`, {
      method: "POST",
      body: JSON.stringify(body),
    });
  const memTools = await mcp({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  }).then(
    (r) => r.json() as Promise<{ result: { tools: { name: string }[] } }>,
  );
  step(
    "stub: the cloud memory path of a case lists the memory tools and takes notifications",
    memTools.result.tools.map((t) => t.name).includes("memory_write") &&
      (await mcp({ jsonrpc: "2.0", method: "notifications/initialized" }))
        .status === 202,
  );
  // The gateway probes mint their own session token and write their own config.
  const jwt = mintJwt({ sub: "u" }, "k".repeat(32), 1000).split(".");
  const [jh, jp] = jwt
    .slice(0, 2)
    .map((x) => JSON.parse(Buffer.from(x, "base64url").toString()));
  step(
    "gateway: mintJwt gives an HS256 token with the key id, the audience and the claims",
    jwt.length === 3 &&
      jh.alg === "HS256" &&
      /^[0-9a-f]{16}$/.test(jh.kid) &&
      jp.aud === "claude-gateway" &&
      jp.sub === "u" &&
      jp.exp === 4600,
  );
  step(
    "gateway: the config sets billing_group_tag only when asked",
    gatewayYaml({
      port: 1,
      upstream: "http://x",
      pgPort: 2,
      billingGroupTag: true,
    }).includes("billing_group_tag: team") &&
      !gatewayYaml({
        port: 1,
        upstream: "http://x",
        pgPort: 2,
        billingGroupTag: false,
      }).includes("billing_group_tag"),
  );
  const yamlBase = { port: 1, upstream: "http://x", pgPort: 2 };
  const yamlOpts = gatewayYaml({
    ...yamlBase,
    billingGroupTag: false,
    identityRetentionDays: 30,
    upstreams: "  - provider: mantle\n",
  });
  step(
    "gateway: the config sets identity_retention_days and the upstreams only when asked",
    yamlOpts.includes("identity_retention_days: 30") &&
      yamlOpts.includes("provider: mantle") &&
      !yamlOpts.includes("provider: anthropic") &&
      !gatewayYaml({ ...yamlBase, billingGroupTag: false }).includes(
        "identity_retention_days",
      ),
  );
  const otlp = await startOtlp();
  const otlpBody = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: "anthropic.plan", value: { stringValue: "max" } },
            { key: "other", value: { stringValue: "x" } },
          ],
        },
        scopeMetrics: [
          {
            metrics: [
              {
                sum: {
                  dataPoints: [
                    {
                      attributes: [
                        {
                          key: "anthropic.custom_base_url",
                          value: { boolValue: true },
                        },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
  await fetch(`${otlp.url}/v1/metrics`, {
    method: "POST",
    body: JSON.stringify(otlpBody),
  });
  await fetch(`${otlp.url}/v1/metrics`, { method: "POST", body: "not json" });
  step(
    "otlp: the receiver keeps JSON exports by signal and valuesOf lists the attributes with a prefix",
    JSON.stringify(valuesOf(otlp.bodies.metrics, "anthropic.")) ===
      JSON.stringify({
        "anthropic.custom_base_url": ["true"],
        "anthropic.plan": ["max"],
      }) &&
      otlp.bodies.metrics.length === 1 &&
      otlp.bodies.logs.length === 0,
  );
  otlp.stop();
  step(
    "paths: bad case id and fixture traversal rejected",
    throws(() =>
      writeCase(out, {
        schema: 1,
        id: "../x",
        group: "print",
        version: ctx.to,
        prompt: PROMPT,
        args: [],
        envSet: [],
        exit: 0,
        timedOut: false,
        data: {},
        facts: [],
      }),
    ) && throws(() => makeSandbox({ projFiles: { "../../evil": "x" } })),
  );
};
