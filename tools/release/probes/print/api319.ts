// Betas and tools new in 2.1.319: tool-provenance, program-use-case-ids, claude-code-side-query, request-tags, WrapUp, ReadWidgetContext.
// Each case reads every request the stub saw: the four betas, the body fields that go with them, and the tool list.
import { mkdirSync, writeFileSync } from "node:fs";
import {
  ADMIN_READ_KEY,
  ASSUMED_KEY_ID,
  mintJwt,
  startGateway,
  startSts,
  startUpstream,
  withPostgres,
} from "../../lib/gateway.ts";
import { allocPort } from "../../lib/ports.ts";
import type { Data } from "../../lib/results.ts";
import { makeSandbox } from "../../lib/sandbox.ts";
import {
  bodyOf,
  type CaseDef,
  json,
  msgs,
  olderThan,
  runCases,
  toolNames,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const BETAS = [
  "tool-provenance-2026-10-26",
  "program-use-case-ids-2026-09-17",
  "claude-code-side-query-2026-09-29",
  "request-tags-2026-08-21",
];
// The harness turns off telemetry, which also turns off the feature flag client; the cached flags in .claude.json need it on.
const GB_ON = {
  DISABLE_TELEMETRY: "",
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };

export const SRV = `let b="";process.stdin.on("data",c=>{b+=c;let i;while((i=b.indexOf("\\n"))>=0){const l=b.slice(0,i);b=b.slice(i+1);if(!l.trim())continue;let m;try{m=JSON.parse(l)}catch{continue}const s=r=>process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:m.id,result:r})+"\\n");if(m.method==="initialize")s({protocolVersion:m.params?.protocolVersion||"2025-06-18",capabilities:{tools:{}},serverInfo:{name:"p",version:"1"}});else if(m.method==="tools/list")s({tools:[{name:"ping",description:"p",inputSchema:{type:"object",properties:{}}}]});else if(m.id!==undefined)s({});}});process.stdin.on("end",()=>process.exit(0));`;

const hasMcp = (sb: { home: string }) => {
  mkdirSync(`${sb.home}/m`, { recursive: true });
  writeFileSync(`${sb.home}/m/srv.js`, SRV);
  writeFileSync(
    `${sb.home}/m/mcp.json`,
    JSON.stringify({
      mcpServers: { psrv: { command: "bun", args: [`${sb.home}/m/srv.js`] } },
    }),
  );
};

const REQ_TAGS = "request-tags-2026-08-21";
const COST =
  "/v1/organizations/analytics/cost?starting_at=2026-11-01T00:00:00Z&ending_at=2026-11-02T00:00:00Z&time_bucket_width=1d";

type Live = {
  url: string;
  up: ReturnType<typeof startUpstream>;
  log: () => string;
  sts: Awaited<ReturnType<typeof startSts>> | null;
};

/** On a program older than the options of the case, a gateway that exits on its own config check gave an answer. Any other failed start makes the case invalid. */
const refused = async (
  g: Awaited<ReturnType<typeof startGateway>>,
  older: boolean,
) => {
  const exitCode = await Promise.race([
    g.exit(),
    Bun.sleep(1000).then(() => null),
  ]);
  const line = /claude gateway: .*/.exec(g.log().replace(/\s+/g, " "))?.[0];
  if (!older || exitCode === null || !line)
    throw new Error("gateway did not start");
  return { started: false, exitCode, refusal: line.slice(0, 400) };
};

/** One `claude gateway` run on a Postgres container and a stub upstream. `calls` sends requests and returns booleans and statuses. */
const gatewayCase = (
  name: string,
  o: {
    tag?: boolean;
    pg?: boolean;
    retention?: number | string;
    upstreams?: (url: string) => string;
    /** Reports the boot only: whether the gateway listens, its exit code and the first log line that matches. */
    boot?: RegExp;
    /** The stub STS: it answers ("ok"), answers AccessDenied ("denied"), or the proxy to it is a closed port ("down"). */
    sts?: "ok" | "denied" | "down";
    /** The first version with the options of the case: an older program may refuse the config. */
    since?: string;
  },
  calls: (g: Live) => Promise<Record<string, Data>>,
): CaseDef => ({
  name: `gateway.${name}`,
  run: async (ctx) => {
    const sb = makeSandbox();
    const up = startUpstream();
    const sts =
      o.sts === "ok" || o.sts === "denied" ? await startSts(o.sts) : null;
    const go = async (pgPort: number) => {
      const g = await startGateway(ctx.bin, sb, {
        ...(sts ? { env: sts.env } : {}),
        upstream: up.url,
        pgPort,
        billingGroupTag: o.tag ?? false,
        ...(o.retention === undefined
          ? {}
          : { identityRetentionDays: o.retention }),
        ...(o.upstreams ? { upstreams: o.upstreams(up.url) } : {}),
      });
      try {
        if (o.boot) {
          const listening = await g.ready();
          await Bun.sleep(300);
          const text = g.log().replace(/\s+/g, " ");
          const at = text.search(o.boot);
          const hit =
            at < 0 ? undefined : text.slice(Math.max(0, at - 300), at + 500);
          return {
            data: {
              listening,
              exitCode: listening ? null : await g.exit(),
              line: hit ?? null,
            },
          };
        }
        if (o.pg === false) {
          const code = await Promise.race([
            g.exit(),
            Bun.sleep(60_000).then(() => null),
          ]);
          return {
            data: {
              exitCode: code,
              connectError: /could not connect to Postgres/.test(g.log()),
              listening: /listening on/.test(g.log()),
            },
          };
        }
        if (!(await g.ready()))
          return {
            data: await refused(
              g,
              o.since !== undefined && olderThan(ctx, o.since),
            ),
          };
        return { data: await calls({ url: g.url, up, log: g.log, sts }) };
      } finally {
        await g.stop();
      }
    };
    try {
      return await (o.pg === false ? go(await allocPort()) : withPostgres(go));
    } finally {
      up.stop();
      sts?.stop();
      sb.cleanup();
    }
  },
});

/** POST /v1/messages through the gateway; reports what the upstream saw as booleans. */
const viaGateway = async (
  g: Live,
  tags: unknown,
  groups: string[],
): Promise<Record<string, Data>> => {
  g.up.seen.length = 0;
  const r = await fetch(`${g.url}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "anthropic-beta": `${REQ_TAGS},prompt-caching-scope-2026-01-05`,
      authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com", groups })}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "Reply with 'OK'." }],
      ...(tags === undefined ? {} : { tags }),
    }),
  });
  const u = g.up.seen[0];
  return {
    status: r.status,
    upstreamCalls: g.up.seen.length,
    upstreamTags: u?.tags ?? null,
    upstreamRequestTagsBeta: u?.betas.includes(REQ_TAGS) ?? null,
    upstreamOtherBetaKept:
      u?.betas.includes("prompt-caching-scope-2026-01-05") ?? null,
  };
};

const BEDROCK_SOURCE_KEY = "AKIAPROBESOURCE";
const ROLE = "arn:aws:iam::123456789012:role/probe-role";
/** A bedrock upstream on the stub, with source access keys and the given `assume_role` YAML lines. */
const bedrock = (url: string, assume = "", auth = "") =>
  `  - provider: bedrock
    region: us-east-1
    base_url: ${url}
    models: [claude-sonnet-5-5]
    auth:
${auth || `      aws_access_key_id: ${BEDROCK_SOURCE_KEY}\n      aws_secret_access_key: probe-source-secret\n`}${assume}`;
const assumeRole = (lines: string[]) =>
  `    assume_role:\n${lines.map((l) => `      ${l}`).join("\n")}\n`;

/** One request to the bedrock upstream; reports the status and what the stub STS and the stub upstream saw. */
const bedrockCall = async (g: Live): Promise<Record<string, Data>> => {
  const r = await fetch(`${g.url}/v1/messages`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com" })}`,
    },
    body: JSON.stringify({
      model: "claude-sonnet-5-5",
      max_tokens: 1,
      messages: [{ role: "user", content: "Reply with 'OK'." }],
    }),
  });
  const body = await r.text();
  const c = g.sts?.calls[0];
  const log = g.log();
  return {
    status: r.status,
    stsCalls: g.sts?.calls.length ?? null,
    stsRoleArn: c?.["RoleArn"] ?? null,
    stsExternalId: c?.["ExternalId"] ?? null,
    stsSessionName: c?.["RoleSessionName"] ?? null,
    stsSignedWithSource: c ? c.signedWith === BEDROCK_SOURCE_KEY : null,
    upstreamCalls: g.up.seen.length,
    upstreamSignedWithAssumed: g.up.seen[0]?.signedWith === ASSUMED_KEY_ID,
    upstreamSignedWithSource: g.up.seen[0]?.signedWith === BEDROCK_SOURCE_KEY,
    failClosedLog:
      log
        .split("\n")
        .find((l) => l.includes("sts:AssumeRole on"))
        ?.replace(/^\S+\s+/, "")
        .replace(/http:\/\/127\.0\.0\.1:\d+/g, "<sts>")
        .replace(/\s+at\s.*/, "")
        .slice(0, 600) ?? null,
    bodyMentionsAssumeRole: body.includes("sts:AssumeRole"),
  };
};

/** Two gateway boots on one Postgres. The first writes the identity rows, the probe backdates them, the second boots with `retention` and its boot sweep deletes what is older. */
const retentionCase = (
  name: string,
  retention: number | undefined,
): CaseDef => ({
  name: `gateway.${name}`,
  run: async (ctx) => {
    const sb = makeSandbox();
    const up = startUpstream();
    try {
      return await withPostgres(async (pgPort, query) => {
        const boot = async (r: number | undefined) => {
          const g = await startGateway(ctx.bin, sb, {
            upstream: up.url,
            pgPort,
            billingGroupTag: false,
            ...(r === undefined ? {} : { identityRetentionDays: r }),
          });
          if (!(await g.ready())) throw new Error("gateway did not start");
          return g;
        };
        const g1 = await boot(undefined);
        await viaGateway(
          { url: g1.url, up, log: g1.log, sts: null },
          undefined,
          ["g1", "g2"],
        );
        for (
          let i = 0;
          i < 40 && query("SELECT 1 FROM principal_emails") === "";
          i++
        )
          await Bun.sleep(250);
        await g1.stop();
        // a program older than the retention option has no identity group table to sweep
        if (
          olderThan(ctx, "2.1.317") &&
          query("SELECT to_regclass('principal_groups')") === ""
        )
          return { data: { principalGroupsTable: false } };
        const day = (n: number) =>
          `to_char(now() AT TIME ZONE 'UTC' - interval '${n} days', 'YYYY-MM-DD')`;
        const state = () => ({
          emails: query("SELECT principal FROM principal_emails ORDER BY 1")
            .split("\n")
            .filter(Boolean)
            .join(","),
          groups: query(
            "SELECT principal || '@' || (CURRENT_DATE - day::date) FROM principal_groups ORDER BY 1",
          )
            .split("\n")
            .filter(Boolean)
            .join(","),
        });
        const first = state();
        query(
          "UPDATE principal_emails SET updated_at = now() - interval '60 days'",
        );
        query(`UPDATE principal_groups SET day = ${day(60)}`);
        query(
          "INSERT INTO principal_emails (principal, email, updated_at) VALUES ('old', 'o@example.com', now() - interval '100 days')",
        );
        query(
          `INSERT INTO principal_groups (day, principal, groups) VALUES (${day(100)}, 'old', '["x"]'), (${day(1)}, 'orphan', '["x"]'), (${day(1)}, 'u1', '["x"]')`,
        );
        const seeded = state();
        const g2 = await boot(retention);
        try {
          for (
            let i = 0;
            i < 80 &&
            query("SELECT 1 FROM principal_emails WHERE principal = 'old'") !==
              "";
            i++
          )
            await Bun.sleep(250);
          await Bun.sleep(1500);
          const after = state();
          return {
            data: {
              firstEmails: first.emails,
              firstGroups: first.groups,
              seededEmails: seeded.emails,
              seededGroups: seeded.groups,
              afterEmails: after.emails,
              afterGroups: after.groups,
            },
          };
        } finally {
          await g2.stop();
        }
      });
    } finally {
      up.stop();
      sb.cleanup();
    }
  },
});

const prefixed = (p: string, d: Record<string, Data>) =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [`${p}.${k}`, v]));

const costCase = (name: string, key: boolean) =>
  gatewayCase(`cost-route-${name}`, {}, async (g) => {
    const r = await fetch(`${g.url}${COST}`, {
      ...(key ? { headers: { "x-api-key": ADMIN_READ_KEY } } : {}),
    });
    const b = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      status: r.status,
      bodyKeys: Object.keys(b),
      dataIsEmptyArray: Array.isArray(b["data"]) && b["data"].length === 0,
      hasMore: typeof b["has_more"] === "boolean" ? b["has_more"] : null,
    };
  });

const ANTHROPIC = (url: string) =>
  `  - provider: anthropic\n    base_url: ${url}\n    auth:\n      api_key: sk-ant-fake-probe\n`;
const WRITE_KEY = "gateway-probe-fake-write-key-0123456789abcdef";
const BLOCKED = "request an increase at https://go.probe.invalid/claude-limits";
const NOTICE = "Call IT <i>now</i> & ask for a code";
/** `gatewayYaml` has no `admin` or top-level slot, so these lines ride on `identity_retention_days` and on the end of `upstreams`. */
const adminLines = (...lines: string[]) =>
  `90\n${lines.map((l) => `  ${l}`).join("\n")}`;
const oidcYaml = (issuer: string) =>
  `oidc:\n  issuer: ${issuer}\n  client_id: probe-client\n  client_secret: probe-client-secret\n`;

/** The gateway on an OIDC stub that serves only the discovery document. `notice` goes to the top-level `login_notice`, `admin` to the `admin` block. */
const loginNoticeCase = (
  name: string,
  notice?: string,
  admin?: string,
): CaseDef => {
  let issuer = "";
  const inner = gatewayCase(
    name,
    {
      ...(admin === undefined ? {} : { retention: admin }),
      since: "2.1.319",
      upstreams: (u) =>
        `${ANTHROPIC(u)}${oidcYaml(issuer)}${notice === undefined ? "" : `login_notice: ${JSON.stringify(notice)}\n`}`,
    },
    async (g) => {
      const auth = await fetch(`${g.url}/oauth/device_authorization`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client_id: "probe" }),
      });
      const a = (await auth.json().catch(() => ({}))) as Record<
        string,
        unknown
      >;
      const page = await fetch(
        `${g.url}/device?user_code=${encodeURIComponent(String(a["user_code"] ?? ""))}`,
      );
      const html = await page.text();
      return {
        precondition: auth.status === 200 && typeof a["user_code"] === "string",
        authStatus: auth.status,
        authKeys: Object.keys(a).join(","),
        authLoginNotice: (a["login_notice"] as string | undefined) ?? null,
        pageStatus: page.status,
        pageHasRawText: html.includes(NOTICE),
        pageHasEscapedText: html.includes(
          "Call IT &lt;i&gt;now&lt;/i&gt; &amp; ask for a code",
        ),
        pageHasNotice: /Call IT/.test(html),
      };
    },
  );
  return {
    ...inner,
    run: async (ctx) => {
      const idp = Bun.serve({
        port: 0,
        hostname: "127.0.0.1",
        fetch: () =>
          Response.json({
            issuer,
            authorization_endpoint: `${issuer}/authorize`,
            token_endpoint: `${issuer}/token`,
            jwks_uri: `${issuer}/jwks`,
            response_types_supported: ["code"],
            subject_types_supported: ["public"],
            id_token_signing_alg_values_supported: ["RS256"],
          }),
      });
      issuer = `http://127.0.0.1:${idp.port}`;
      try {
        return await inner.run(ctx);
      } finally {
        idp.stop(true);
      }
    },
  };
};

/** An organization cap of 0 blocks every developer; reports the 429 the next request gets. */
const blockedCase = (name: string, message?: string): CaseDef =>
  gatewayCase(
    name,
    {
      retention: adminLines(
        `write_keys:\n    - id: probe-w\n      key: ${WRITE_KEY}`,
        ...(message === undefined
          ? []
          : [`blocked_message: ${JSON.stringify(message)}`]),
      ),
    },
    async (g) => {
      const set = await fetch(`${g.url}/v1/organizations/spend_limits`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": WRITE_KEY },
        body: JSON.stringify({
          scope: { type: "organization" },
          amount: "0",
          period: "monthly",
        }),
      });
      g.up.seen.length = 0;
      const r = await fetch(`${g.url}/v1/messages`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com", groups: ["g1"] })}`,
        },
        body: JSON.stringify({
          model: "claude-sonnet-5-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "Reply with 'OK'." }],
        }),
      });
      const b = (await r.json().catch(() => ({}))) as {
        error?: { type?: string; message?: string };
      };
      return {
        precondition: set.status === 200 || set.status === 201,
        limitStatus: set.status,
        status: r.status,
        errorType: b.error?.type ?? null,
        message: b.error?.message ?? null,
        upstreamCalls: g.up.seen.length,
      };
    },
  );

const bootCase = (name: string, boot: RegExp, retention?: string, top = "") =>
  gatewayCase(
    name,
    {
      boot,
      ...(retention === undefined ? {} : { retention }),
      ...(top ? { upstreams: (u) => `${ANTHROPIC(u)}${top}` } : {}),
    },
    async () => ({}),
  );

type Opt = {
  env?: Record<string, string>;
  mcp?: boolean;
  args?: string[];
  gb?: Record<string, boolean>;
  title?: boolean;
  user?: Record<string, unknown>;
};

const betaCase = (name: string, o: Opt): CaseDef => ({
  name,
  run: (ctx) =>
    withRun(
      ctx,
      {
        env: { ...(o.gb ? GB_ON : {}), ...o.env },
        allowOverride: Object.keys(GB_ON),
        args: [
          ...(o.mcp ? ["--mcp-config", "{HOME}/m/mcp.json"] : []),
          ...(o.args ?? []),
        ],
        ...(o.user ? { cfgFiles: { "settings.json": json(o.user) } } : {}),
        setup: (sb) => {
          hasMcp(sb);
          if (!o.gb) return;
          writeFileSync(
            `${sb.cfg}/.claude.json`,
            JSON.stringify({ cachedGrowthBookFeatures: o.gb }),
          );
        },
        ...(o.title
          ? {
              noPrompt: true,
              argv: [
                "-p",
                "--input-format",
                "stream-json",
                "--output-format",
                "stream-json",
                "--verbose",
              ],
              stdin: `${json({ type: "control_request", request_id: "t1", request: { subtype: "generate_session_title", description: "Fix the login bug" } })}\n`,
            }
          : {}),
        timeoutMs: 60_000,
      },
      (r) => {
        const qs = msgs(r);
        const perReq = qs.map((q) => {
          const betas = (q.headers["anthropic-beta"] ?? "").split(",");
          const body = bodyOf(q);
          const tools = (body.tools ?? []) as Record<string, unknown>[];
          return {
            has: BETAS.filter((b) => betas.includes(b)),
            nBetas: betas.length,
            nTools: tools.length,
            tools: toolNames(q).filter((t) =>
              /^(WrapUp|ReadWidgetContext|ExitPlanMode|EnterPlanMode|AskUserQuestion|propose_skills|enable__|request_computer|mcp__)/.test(
                t,
              ),
            ),
            ownership: tools
              .filter((t) => "ownership_metadata" in t)
              .map(
                (t) => `${String(t["name"])}=${json(t["ownership_metadata"])}`,
              ),
            deferred: json(body.messages ?? []).includes("ExitPlanMode"),
            useCaseId: body["program_use_case_id"] ?? null,
            tags: "tags" in body,
            teamInContext: json([body.system, body.messages]).includes(
              "probe@team",
            ),
          };
        });
        return {
          from: r,
          data: {
            precondition: qs.length >= 1,
            requests: qs.length,
            perRequest: json(perReq),
          },
        };
      },
    ),
});

const PROMPT_TOOL = ["--permission-prompt-tool", "mcp__psrv__ping"];
const SKILLS = {
  CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE: "probe",
  CLAUDE_CODE_SYNC_SKILLS: "1",
};
// Tool search off lists the deferred tools (ExitPlanMode) in the request, so the list shows the gate directly.
const DIRECT = { ENABLE_TOOL_SEARCH: "false" };
const TEAMS = { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" };
const DENY = { permissions: { denyInsteadOfPrompting: true } };
const TEAMMATE = [
  "--agent-id",
  "probe@team",
  "--agent-name",
  "probe",
  "--team-name",
  "team",
];
const UC = { CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe-use-case" };

// A remote session profile, the first of the two tests that list the enable stubs. The second needs host launch options that no env var sets.
const PROFILE = {
  ...DIRECT,
  CCR_SESSION_PROFILE: "1",
  SESSION_INGRESS_URL: "https://ingress.probe.invalid",
  CLAUDE_CODE_REMOTE_SESSION_ID: "cse_probe",
};

const POSSUM = { tengu_federated_possum: true };
const THUNDER = { tengu_merry_thunder: true };
const TRELLIS = { tengu_amber_trellis: true };

export const api319: PrintGroup = {
  id: "api319",
  title: "Betas and tools new in 2.1.319",
  run: (ctx) =>
    runCases(ctx, "api319", [
      betaCase("beta.plain", {}),
      betaCase("beta.plain-mcp", { mcp: true }),
      betaCase("beta.first-party", { env: FIRST_PARTY }),
      betaCase("beta.first-party-mcp", { env: FIRST_PARTY, mcp: true }),
      betaCase("beta.use-case-id", { env: { ...FIRST_PARTY, ...UC } }),
      betaCase("beta.use-case-id-flag", {
        env: { ...FIRST_PARTY, ...UC },
        gb: POSSUM,
      }),
      betaCase("beta.use-case-id-flag-no-first-party", { env: UC, gb: POSSUM }),
      betaCase("beta.first-party-experimental-off", {
        env: {
          ...FIRST_PARTY,
          ...UC,
          CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
        },
        gb: POSSUM,
        mcp: true,
      }),
      betaCase("beta.provenance.fake-key", { env: FIRST_PARTY, mcp: true }),
      betaCase("beta.side-query.title", { env: FIRST_PARTY, title: true }),
      betaCase("beta.side-query.title-no-first-party", { title: true }),
      betaCase("beta.side-query.title-experimental-off", {
        env: { ...FIRST_PARTY, CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1" },
        title: true,
      }),
      betaCase("tool.wrap-up.off", {}),
      betaCase("tool.wrap-up.env", {
        env: { CLAUDE_CODE_ENABLE_WRAP_UP: "1" },
      }),
      betaCase("tool.wrap-up.env-flag", {
        env: { CLAUDE_CODE_ENABLE_WRAP_UP: "1" },
        gb: THUNDER,
      }),
      betaCase("tool.wrap-up.flag-only", { gb: THUNDER }),
      betaCase("tool.exit-plan.print", {}),
      betaCase("tool.exit-plan.prompt-tool", { args: PROMPT_TOOL, mcp: true }),
      betaCase("tool.exit-plan.plan-mode", {
        args: [...PROMPT_TOOL, "--permission-mode", "plan"],
        mcp: true,
      }),
      betaCase("tool.exit-plan.prompt-tool-deny", {
        args: PROMPT_TOOL,
        mcp: true,
        user: { permissions: { denyInsteadOfPrompting: true } },
      }),
      betaCase("tool.exit-plan.plan-mode-deny", {
        args: [...PROMPT_TOOL, "--permission-mode", "plan"],
        mcp: true,
        user: { permissions: { denyInsteadOfPrompting: true } },
      }),
      betaCase("tool.exit-plan.direct", {
        env: DIRECT,
        args: PROMPT_TOOL,
        mcp: true,
      }),
      betaCase("tool.exit-plan.direct-deny", {
        env: DIRECT,
        args: PROMPT_TOOL,
        mcp: true,
        user: DENY,
      }),
      betaCase("tool.exit-plan.direct-no-prompt-tool", { env: DIRECT }),
      betaCase("tool.exit-plan.teams-env-deny", {
        env: { ...DIRECT, ...TEAMS },
        args: PROMPT_TOOL,
        mcp: true,
        user: DENY,
      }),
      betaCase("tool.exit-plan.teammate", {
        env: { ...DIRECT, ...TEAMS },
        args: [...PROMPT_TOOL, ...TEAMMATE],
        mcp: true,
      }),
      betaCase("tool.exit-plan.teammate-deny", {
        env: { ...DIRECT, ...TEAMS },
        args: [...PROMPT_TOOL, ...TEAMMATE],
        mcp: true,
        user: DENY,
      }),
      betaCase("tool.exit-plan.teammate-no-prompt-tool", {
        env: { ...DIRECT, ...TEAMS },
        args: TEAMMATE,
      }),
      betaCase("tool.propose-skills.cowork", {
        env: { ...SKILLS, CLAUDE_CODE_ENTRYPOINT: "remote_cowork" },
      }),
      betaCase("tool.propose-skills.trigger", {
        env: { ...SKILLS, CLAUDE_CODE_ENTRYPOINT: "remote_cowork_trigger" },
      }),
      betaCase("tool.propose-skills.trigger-chat", {
        env: {
          ...SKILLS,
          CLAUDE_CODE_ENTRYPOINT: "remote_cowork_trigger",
          CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat",
        },
      }),
      betaCase("tool.propose-skills.chat-only", {
        env: { ...SKILLS, CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat" },
      }),
      betaCase("tool.enable-stubs.direct", { env: DIRECT }),
      betaCase("tool.enable-stubs.profile", { env: PROFILE }),
      betaCase("tool.enable-stubs.profile-bad-id", {
        env: { ...PROFILE, CLAUDE_CODE_REMOTE_SESSION_ID: "session_probe" },
      }),
      betaCase("tool.enable-stubs.profile-http-ingress", {
        env: {
          ...PROFILE,
          SESSION_INGRESS_URL: "http://ingress.probe.invalid",
        },
      }),
      betaCase("tool.enable-stubs.chat-flag", {
        env: { ...DIRECT, CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat" },
        gb: { tengu_merry_tide: true },
      }),
      gatewayCase(
        "request-tags-billing-group",
        { tag: true, since: "2.1.317" },
        async (g) => {
          const out = {
            ...prefixed("listed", await viaGateway(g, { team: "g1" }, ["g1"])),
            ...prefixed(
              "unlisted",
              await viaGateway(g, { team: "g1" }, ["other"]),
            ),
            ...prefixed(
              "otherName",
              await viaGateway(g, { other: "g1" }, ["g1"]),
            ),
            ...prefixed("noTags", await viaGateway(g, undefined, ["g1"])),
          };
          await Bun.sleep(300);
          return {
            ...out,
            auditBillingGroup: /"billing_group":"g1"/.test(g.log()),
            auditBillingGroupIgnored: /"billing_group_ignored":true/.test(
              g.log(),
            ),
          };
        },
      ),
      gatewayCase("request-tags-plain", {}, async (g) =>
        prefixed("listed", await viaGateway(g, { team: "g1" }, ["g1"])),
      ),
      costCase("no-key", false),
      costCase("admin", true),
      retentionCase("identity-retention-default", undefined),
      retentionCase("identity-retention-30", 30),
      retentionCase("identity-retention-90", 90),
      gatewayCase(
        "identity-retention-zero",
        { retention: 0, boot: /identity_retention_days/ },
        async () => ({}),
      ),
      gatewayCase(
        "identity-retention-text",
        { retention: "ninety", boot: /identity_retention_days/ },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-sts",
        {
          sts: "ok",
          upstreams: (u) =>
            bedrock(
              u,
              assumeRole([
                `role_arn: ${ROLE}`,
                "external_id: probe-external-id",
              ]),
            ),
        },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-session-sub",
        {
          sts: "ok",
          upstreams: (u) =>
            bedrock(u, assumeRole([`role_arn: ${ROLE}`, "session_name: sub"])),
        },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-session-email",
        {
          sts: "ok",
          upstreams: (u) =>
            bedrock(
              u,
              assumeRole([`role_arn: ${ROLE}`, "session_name: email"]),
            ),
        },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-sts-denied",
        {
          sts: "denied",
          upstreams: (u) => bedrock(u, assumeRole([`role_arn: ${ROLE}`])),
        },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-sts-down",
        {
          sts: "down",
          upstreams: (u) => bedrock(u, assumeRole([`role_arn: ${ROLE}`])),
        },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-none",
        { sts: "ok", upstreams: (u) => bedrock(u) },
        bedrockCall,
      ),
      gatewayCase(
        "assume-role-bad-arn",
        {
          boot: /role_arn|IAM role ARN/,
          upstreams: (u) => bedrock(u, assumeRole(["role_arn: not-an-arn"])),
        },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-bad-external-id",
        {
          boot: /external_id|1224/,
          upstreams: (u) =>
            bedrock(u, assumeRole([`role_arn: ${ROLE}`, "external_id: x"])),
        },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-bad-session-name",
        {
          boot: /session_name|Invalid enum/,
          upstreams: (u) =>
            bedrock(u, assumeRole([`role_arn: ${ROLE}`, "session_name: name"])),
        },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-bearer-token",
        {
          boot: /assume_role needs SigV4/,
          upstreams: (u) =>
            bedrock(
              u,
              assumeRole([`role_arn: ${ROLE}`]),
              "      aws_bearer_token: probe-bearer\n",
            ),
        },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-anthropic",
        {
          boot: /assume_role|Unrecognized/,
          upstreams: (u) =>
            `  - provider: anthropic\n    base_url: ${u}\n    auth:\n      api_key: sk-ant-fake-probe\n${assumeRole([`role_arn: ${ROLE}`])}`,
        },
        async () => ({}),
      ),
      gatewayCase(
        "assume-role-mixed-session",
        {
          boot: /sets assume_role\.session_name/,
          upstreams: (u) =>
            `${bedrock(u, assumeRole([`role_arn: ${ROLE}`, "session_name: sub"]))}  - provider: mantle\n    name: m\n    region: us-east-1\n    base_url: ${u}\n    models: [claude-opus-4-7]\n    auth:\n      aws_access_key_id: ${BEDROCK_SOURCE_KEY}\n      aws_secret_access_key: probe-source-secret\n`,
        },
        async () => ({}),
      ),
      bootCase(
        "pooled-order-duplicate",
        /lists a group more than once/,
        adminLines(
          "pooled_conflict_rule: priority_list",
          "pooled_priority_order: [a, a]",
        ),
      ),
      bootCase(
        "pooled-priority-list-empty",
        /needs at least one group/,
        adminLines("pooled_conflict_rule: priority_list"),
      ),
      bootCase(
        "pooled-rule-unknown",
        /pooled_conflict_rule/,
        adminLines("pooled_conflict_rule: other"),
      ),
      bootCase(
        "pooled-order-ignored",
        /pooled_priority_order is ignored/,
        adminLines("pooled_priority_order: [a, b]"),
      ),
      bootCase(
        "pooled-order-with-rule",
        /pooled_priority_order|pooled_conflict_rule/,
        adminLines(
          "pooled_conflict_rule: priority_list",
          "pooled_priority_order: [a, b]",
        ),
      ),
      bootCase(
        "login-notice-no-oidc",
        /login_notice \(no one can sign in/,
        undefined,
        'login_notice: "Call IT"\n',
      ),
      bootCase(
        "login-notice-too-long",
        /login_notice/,
        undefined,
        `login_notice: ${"x".repeat(501)}\n`,
      ),
      loginNoticeCase("login-notice-served", NOTICE),
      loginNoticeCase("login-notice-unset"),
      loginNoticeCase(
        "example-all-four",
        NOTICE,
        adminLines(
          `blocked_message: ${JSON.stringify(BLOCKED)}`,
          "pooled_conflict_rule: priority_list",
          "pooled_priority_order: [a, b]",
        ),
      ),
      blockedCase("blocked-message-set", BLOCKED),
      blockedCase("blocked-message-unset"),
      gatewayCase("no-postgres", { pg: false }, async () => ({})),
      betaCase("tool.widget.off", {}),
      betaCase("tool.widget.remote-flag", {
        env: { CLAUDE_CODE_REMOTE: "1" },
        gb: TRELLIS,
      }),
    ]),
};
