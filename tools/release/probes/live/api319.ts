// Live look at the 2.1.319 API surface that a fake key cannot reach: the tool-provenance beta, and the paths that startup
// and the org pin call. Runs `-p` with the real token behind the local proxy. Only paths, beta names and tool names are kept;
// ownership_metadata is reduced to its key names, and the output of the child is dropped (the org-pin error prints an org id).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { liveEnv } from "../../lib/live/env.ts";
import { startMitm } from "../../lib/mitm.ts";
import { runChild } from "../../lib/proc.ts";
import type { Data } from "../../lib/results.ts";
import { assertShimReady } from "../../lib/shim.ts";
import { SRV } from "../print/api319.ts";
import {
  arr,
  baseResult,
  type LiveCase,
  type LiveCtx,
  liveSandbox,
  obj,
  PROMPT,
} from "./harness.ts";

// A UUID no account has, so the pin always fails and the run ends after the org check.
const OTHER_ORG = "00000000-0000-4000-8000-000000000000";

type Seen = {
  betas: string[];
  bodyKeys: string[];
  owned: string[];
  mcp: string[];
};

const apiCase = (
  id: string,
  title: string,
  o: {
    nonessential?: boolean;
    pin?: boolean;
    mcp?: "stdio" | "http";
    remoteCowork?: boolean;
  },
): LiveCase => ({
  id,
  title,
  requests: o.pin ? "none (the pin fails first)" : "1 live",
  run: async (x: LiveCtx) => {
    const sb = liveSandbox();
    const seen: Seen[] = [];
    const mitm = await startMitm({
      onMessages: (r) => {
        const b = obj(r.body);
        seen.push({
          betas: r.betas.split(",").filter(Boolean).sort(),
          bodyKeys: Object.keys(b).sort(),
          mcp: arr(b["tools"])
            .map(obj)
            .filter((t) => String(t["name"]).startsWith("mcp__"))
            .map(
              (t) => `${String(t["name"])}:${Object.keys(t).sort().join("+")}`,
            ),
          owned: arr(b["tools"])
            .map(obj)
            .filter((t) => "ownership_metadata" in t)
            .map(
              (t) =>
                `${String(t["name"])}:${Object.keys(obj(t["ownership_metadata"])).sort().join("+")}`,
            ),
        });
      },
      ...(x.dry
        ? {
            tunnelOthers: false,
            upstream: async () =>
              new Response("{}", {
                status: 404,
                headers: { "content-type": "application/json" },
              }),
          }
        : {}),
    });
    // A local HTTP MCP server: the only kind with a server URL for ownership_metadata to name.
    const http =
      o.mcp === "http"
        ? Bun.serve({
            port: 0,
            hostname: "127.0.0.1",
            fetch: async (req) => {
              const m = obj(await req.json().catch(() => ({})));
              const reply = (result: unknown) =>
                Response.json({ jsonrpc: "2.0", id: m["id"], result });
              if (m["method"] === "initialize")
                return reply({
                  protocolVersion: "2025-06-18",
                  capabilities: { tools: {} },
                  serverInfo: { name: "p", version: "1" },
                });
              if (m["method"] === "tools/list")
                return reply({
                  tools: [
                    {
                      name: "ping",
                      description: "p",
                      inputSchema: { type: "object", properties: {} },
                    },
                  ],
                });
              return m["id"] === undefined
                ? new Response(null, { status: 202 })
                : reply({});
            },
          })
        : undefined;
    try {
      if (o.mcp) {
        mkdirSync(join(sb.home, "m"), { recursive: true });
        writeFileSync(join(sb.home, "m", "srv.js"), SRV);
        writeFileSync(
          join(sb.home, "m", "mcp.json"),
          JSON.stringify({
            mcpServers: {
              psrv: http
                ? { type: "http", url: `http://127.0.0.1:${http.port}/mcp` }
                : { command: "bun", args: [join(sb.home, "m", "srv.js")] },
            },
          }),
        );
      }
      const env = liveEnv({
        home: sb.home,
        configDir: sb.cfg,
        token: x.token,
        mitm,
        extra: {
          ...(o.mcp ? { ENABLE_TOOL_SEARCH: "false" } : {}),
          // The entry point that gives the auth warm its known credential lifetime.
          ...(o.remoteCowork
            ? {
                CLAUDE_CODE_REMOTE: "1",
                CLAUDE_CODE_ENTRYPOINT: "remote_cowork",
              }
            : {}),
        },
        ...(o.nonessential ? { allowNonessential: true } : {}),
      });
      assertShimReady(env);
      const res = await runChild(
        [
          x.bin,
          "-p",
          PROMPT,
          ...(o.mcp ? ["--mcp-config", join(sb.home, "m", "mcp.json")] : []),
          ...(o.pin
            ? [
                "--managed-settings",
                JSON.stringify({ forceLoginOrgUUID: OTHER_ORG }),
              ]
            : []),
        ],
        {
          cwd: sb.proj,
          env,
          timeoutMs: 120_000,
        },
      );
      const a = seen[0];
      const data: Record<string, Data> = {
        precondition: o.pin || !!a,
        "mitm.paths": [
          ...new Set(
            mitm.log().map((l) => `${l.method} ${l.path} ${l.status}`),
          ),
        ].sort(),
        "mitm.connects": [...new Set(mitm.connects())].sort(),
        "live.requests": seen.length,
        ...(a
          ? {
              betas: a.betas,
              "betas.hasToolProvenance": a.betas.includes(
                "tool-provenance-2026-10-26",
              ),
              bodyKeys: a.bodyKeys,
              "tools.withOwnershipMetadata": a.owned,
              "tools.mcp": a.mcp,
            }
          : {}),
      };
      return [
        baseResult(x, id, {
          args: ["-p"],
          exit: res.code,
          timedOut: res.timedOut,
          data,
          notes: `${o.remoteCowork ? "CLAUDE_CODE_REMOTE=1 and CLAUDE_CODE_ENTRYPOINT=remote_cowork. " : ""}${o.pin ? `The hidden --managed-settings flag pins forceLoginOrgUUID to an id no account has. ` : ""}${o.nonessential ? "Nonessential traffic is allowed. " : ""}Real token behind a local proxy with a throw-away CA. Kept: paths, beta names, tool names and the key names of ownership_metadata. No header, body text or child output is kept.`,
        }),
      ];
    } finally {
      http?.stop(true);
      mitm.stop();
      sb.cleanup();
    }
  },
});

export const api319Cases: LiveCase[] = [
  apiCase(
    "api319.provenance",
    "Betas and ownership_metadata with the real login",
    {},
  ),
  apiCase(
    "api319.provenance-mcp",
    "ownership_metadata with a stdio MCP tool, tool search off",
    {
      mcp: "stdio",
    },
  ),
  apiCase(
    "api319.provenance-http",
    "ownership_metadata with a local HTTP MCP tool, tool search off",
    { mcp: "http" },
  ),
  apiCase("api319.startup", "Startup paths with nonessential traffic on", {
    nonessential: true,
  }),
  apiCase(
    "api319.auth-warm",
    "Does the remote cowork entry point send GET /v1/me with the real login",
    // Essential-traffic mode turns the warm off, so nonessential traffic stays on.
    { remoteCowork: true, nonessential: true },
  ),
  apiCase("api319.org-pin", "Paths called when managed settings pin the org", {
    pin: true,
  }),
];
