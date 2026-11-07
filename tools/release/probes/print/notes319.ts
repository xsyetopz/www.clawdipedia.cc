// Release-note items of 2.1.317 and 2.1.318 that a user can see: the sign-in end date (`loginExpiresAt`, `credential_expires_at`)
// and the `anthropic.*` OpenTelemetry attributes. The login is a fake file in the sandbox config folder; no request leaves the machine.
import { FAKE_KEY } from "../../lib/env.ts";
import { startOtlp, valuesOf } from "../../lib/otlp.ts";
import type { Data } from "../../lib/results.ts";
import { type CaseDef, json, runCases, withRun } from "./run/helpers.ts";
import { events, obj } from "./run.ts";
import type { PrintGroup } from "./types.ts";

const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };
const DAY = 86_400_000;
const REFRESH_END = Date.UTC(2030, 0, 15, 12);
const ACCESS_END = Date.UTC(2030, 0, 1);

const login = (o: Record<string, unknown> = {}, tier = "max") =>
  json({
    claudeAiOauth: {
      accessToken: FAKE_KEY,
      refreshToken: "sk-ant-ort01-fake",
      expiresAt: ACCESS_END,
      refreshTokenExpiresAt: REFRESH_END,
      scopes: ["user:inference", "user:profile"],
      subscriptionType: tier,
      ...o,
    },
  });

const END_ISO = new Date(REFRESH_END).toISOString();
const NO_LOGIN_ARGS = ["auth", "status"];

type LoginOpt = {
  creds?: string;
  argv?: string[];
  env?: Record<string, string>;
};

/** One run with a stored login (or none). Reports the end date wherever the program wrote it. */
const loginCase = (name: string, o: LoginOpt): CaseDef => ({
  name: `login-expiry.${name}`,
  run: (ctx) =>
    withRun(
      ctx,
      {
        auth: "none",
        env: { ...FIRST_PARTY, ...o.env },
        ...(o.creds ? { cfgFiles: { ".credentials.json": o.creds } } : {}),
        ...(o.argv ? { argv: o.argv, noPrompt: true } : {}),
        timeoutMs: 60_000,
      },
      (r) => {
        const data: Record<string, Data> = {
          precondition: r.code !== null && !r.timedOut,
          exit: r.code,
        };
        const argv0 = o.argv?.[0];
        if (argv0 === "auth") {
          const text = o.argv?.includes("--text");
          if (text) {
            const l = r.stdout.split("\n").find((x) => /Sign-in/.test(x)) ?? "";
            data["signInLine"] = l.replace(
              /\d{4}-\d\d-\d\d(T[\d:.]+Z)?/g,
              "<date>",
            );
            data["rangeIsExpected"] = l.endsWith(
              `between 2030-01-12 and 2030-01-15 (${END_ISO})`,
            );
          } else {
            const s = obj(JSON.parse(r.stdout));
            data["loginExpiresAt"] = (s["loginExpiresAt"] ?? null) as Data;
            data["isRefreshEnd"] = s["loginExpiresAt"] === END_ISO;
            data["loggedIn"] = s["loggedIn"] as Data;
            data["authMethod"] = s["authMethod"] as Data;
            data["keys"] = Object.keys(s).join(",");
          }
        } else if (o.argv === ARGS_TEXT) {
          data["stdout"] = r.stdout.trim();
        } else {
          const ev = events(r);
          data["byEvent"] = json(
            ev
              .filter((e) => "credential_expires_at" in e)
              .map((e) => [
                e["type"],
                e["subtype"],
                e["credential_expires_at"] === END_ISO,
              ]),
          );
          data["eventsWithout"] = json(
            ev
              .filter((e) => !("credential_expires_at" in e))
              .map((e) => `${String(e["type"])}/${String(e["subtype"] ?? "")}`),
          );
        }
        data["warning"] = r.stderr
          .split("\n")
          .filter((l) => /sign-in/i.test(l))
          .join("\n");
        return { from: r, data };
      },
    ),
});

const ARGS_TEXT = ["-p", "Reply with 'OK'.", "--model", "claude-opus-5-5"];
const ARGS_JSON = [...ARGS_TEXT, "--output-format", "json"];

const otelEnv = (url: string): Record<string, string> => ({
  CLAUDE_CODE_ENABLE_TELEMETRY: "1",
  OTEL_LOGS_EXPORTER: "otlp",
  OTEL_METRICS_EXPORTER: "otlp",
  OTEL_TRACES_EXPORTER: "otlp",
  CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
  OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
  OTEL_EXPORTER_OTLP_ENDPOINT: url,
  OTEL_METRIC_EXPORT_INTERVAL: "500",
  OTEL_LOGS_EXPORT_INTERVAL: "500",
  OTEL_TRACES_EXPORT_INTERVAL: "500",
});

type OtelOpt = {
  env?: Record<string, string>;
  creds?: string;
  account?: Record<string, unknown>;
  auth?: "none";
  allow?: string[];
};

/** One run that exports all three signals to a local receiver. Reports the `anthropic.*` values per signal. */
const otelCase = (name: string, o: OtelOpt): CaseDef => ({
  name: `otel-attrs.${name}`,
  run: async (ctx) => {
    const rx = await startOtlp();
    try {
      return await withRun(
        ctx,
        {
          ...(o.auth ? { auth: o.auth } : {}),
          allowOverride: [
            ...(o.allow ?? []),
            "DISABLE_TELEMETRY",
            "CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
          ],
          env: {
            DISABLE_TELEMETRY: "",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
            ...otelEnv(rx.url),
            ...o.env,
          },
          cfgFiles: {
            ...(o.creds ? { ".credentials.json": o.creds } : {}),
            ".claude.json": json({
              hasCompletedOnboarding: true,
              ...(o.account ? { oauthAccount: o.account } : {}),
            }),
          },
          timeoutMs: 60_000,
        },
        (r) => {
          const data: Record<string, Data> = {
            precondition: SIGNALS.every((x) => rx.bodies[x].length > 0),
          };
          for (const s of SIGNALS)
            data[s] = json({
              exports: rx.bodies[s].length,
              ...valuesOf(rx.bodies[s], "anthropic."),
            });
          return { from: r, data };
        },
      );
    } finally {
      rx.stop();
    }
  },
});

const SIGNALS = ["metrics", "logs", "traces"] as const;
const ACCOUNT = {
  accountUuid: "00000000-0000-4000-8000-000000000001",
  emailAddress: "probe@example.com",
  organizationUuid: "00000000-0000-4000-8000-000000000002",
};

export const notes319: PrintGroup = {
  id: "notes319",
  title: "Release-note items of 2.1.317 and 2.1.318",
  run: (ctx) =>
    runCases(ctx, "notes319", [
      loginCase("status-json", { creds: login(), argv: NO_LOGIN_ARGS }),
      loginCase("status-text", {
        creds: login(),
        argv: [...NO_LOGIN_ARGS, "--text"],
      }),
      loginCase("result-stream-json", { creds: login() }),
      loginCase("result-json", { creds: login(), argv: ARGS_JSON }),
      loginCase("no-login-status", { argv: NO_LOGIN_ARGS }),
      loginCase("no-refresh-date", {
        creds: login({ refreshTokenExpiresAt: undefined }),
        argv: NO_LOGIN_ARGS,
      }),
      loginCase("access-outlives-refresh", {
        creds: login({ expiresAt: REFRESH_END + 4 * DAY }),
        argv: NO_LOGIN_ARGS,
      }),
      loginCase("result-json-no-date", {
        creds: login({ expiresAt: REFRESH_END + 4 * DAY }),
        argv: ARGS_JSON,
      }),
      loginCase("third-party-provider", {
        creds: login(),
        argv: NO_LOGIN_ARGS,
        env: { CLAUDE_CODE_USE_BEDROCK: "1" },
      }),
      loginCase("soon-print", {
        argv: ARGS_TEXT,
        creds: login({
          expiresAt: Date.now() + 4 * DAY,
          refreshTokenExpiresAt: Date.now() + 5 * DAY,
        }),
      }),
      loginCase("before-2025", {
        creds: login({
          expiresAt: Date.UTC(2024, 5, 1),
          refreshTokenExpiresAt: Date.UTC(2024, 5, 1),
        }),
        argv: NO_LOGIN_ARGS,
      }),
      loginCase("over-ten-years", {
        creds: login({
          expiresAt: Date.UTC(2050, 0, 1),
          refreshTokenExpiresAt: Date.UTC(2050, 0, 1),
        }),
        argv: NO_LOGIN_ARGS,
      }),
      loginCase("past", {
        creds: login({
          expiresAt: Date.UTC(2025, 5, 1),
          refreshTokenExpiresAt: Date.UTC(2025, 5, 1),
        }),
        argv: [...NO_LOGIN_ARGS, "--text"],
      }),
      otelCase("api-key", {}),
      otelCase("max-plan", { auth: "none", creds: login(), env: FIRST_PARTY }),
      otelCase("team-premium", {
        auth: "none",
        creds: login({}, "team"),
        env: FIRST_PARTY,
        account: { ...ACCOUNT, seatTier: "team_tier_1" },
      }),
      otelCase("enterprise-usage-based", {
        auth: "none",
        creds: login({}, "enterprise"),
        env: FIRST_PARTY,
        account: { ...ACCOUNT, seatTier: "enterprise_usage_based" },
      }),
      otelCase("free-plan", {
        auth: "none",
        creds: login({}, "free"),
        env: FIRST_PARTY,
      }),
      otelCase("default-api-url", {
        env: { ANTHROPIC_BASE_URL: "https://api.anthropic.com" },
        allow: ["ANTHROPIC_BASE_URL"],
      }),
      otelCase("bedrock-custom-url", {
        env: {
          CLAUDE_CODE_USE_BEDROCK: "1",
          CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
          ANTHROPIC_BEDROCK_BASE_URL: "http://127.0.0.1:9",
        },
      }),
      otelCase("bedrock", {
        env: {
          CLAUDE_CODE_USE_BEDROCK: "1",
          CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
        },
      }),
    ]),
};
