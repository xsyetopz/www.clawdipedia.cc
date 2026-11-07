// Helpers for the `claude gateway` probes: a Postgres container, a stub upstream, an HS256 session token and the gateway process.
// The secrets below are fixed fakes. The gateway needs Postgres (it has no dev store), so Docker is required.
import { createHash, createHmac } from "node:crypto";
import { onCleanup } from "./cleanup.ts";
import { childEnv } from "./env.ts";
import { startMitm } from "./mitm.ts";
import { allocPort } from "./ports.ts";
import { registerPid } from "./proc.ts";
import type { Sandbox } from "./sandbox.ts";

export const GATEWAY_SECRET = "gateway-probe-fake-secret-0123456789abcdef";
export const ADMIN_READ_KEY = "gateway-probe-fake-read-key-0123456789abcdef";
const IMAGE = "postgres:17-alpine";

const b64 = (x: string) => Buffer.from(x).toString("base64url");

/** The bearer token the gateway verifies: HS256, `kid` = first 8 bytes of sha256(secret) in hex, `aud` "claude-gateway". */
export const mintJwt = (
  claims: Record<string, unknown>,
  secret = GATEWAY_SECRET,
  now = Math.floor(Date.now() / 1000),
): string => {
  const kid = createHash("sha256")
    .update(secret)
    .digest()
    .subarray(0, 8)
    .toString("hex");
  const h = b64(JSON.stringify({ alg: "HS256", typ: "JWT", kid }));
  const p = b64(
    JSON.stringify({
      aud: "claude-gateway",
      iat: now,
      exp: now + 3600,
      ...claims,
    }),
  );
  const sig = createHmac("sha256", secret)
    .update(`${h}.${p}`)
    .digest("base64url");
  return `${h}.${p}.${sig}`;
};

export const gatewayYaml = (o: {
  port: number;
  upstream: string;
  pgPort: number;
  billingGroupTag: boolean;
  /** `admin.identity_retention_days`, left out when unset. */
  identityRetentionDays?: number | string;
  /** The YAML under `upstreams:`, in place of the one Anthropic upstream. */
  upstreams?: string;
}): string => `listen:
  host: 127.0.0.1
  port: ${o.port}
upstreams:
${
  o.upstreams ??
  `  - provider: anthropic
    base_url: ${o.upstream}
    auth:
      api_key: sk-ant-fake-probe
`
}session:
  jwt_secret: ${GATEWAY_SECRET}
store:
  postgres_url: postgres://postgres@127.0.0.1:${o.pgPort}/probe
cri:
  enabled: true
  audience: [probe]
  org_allowlist: ["00000000-0000-4000-8000-000000000000"]
admin:
${o.billingGroupTag ? "  billing_group_tag: team\n" : ""}${o.identityRetentionDays === undefined ? "" : `  identity_retention_days: ${o.identityRetentionDays}\n`}  read_keys:
    - id: probe
      key: ${ADMIN_READ_KEY}
`;

const sh = (argv: string[]) =>
  Bun.spawnSync(argv, { stdout: "pipe", stderr: "pipe" });

/** Fails with the install step when Docker is missing or its daemon is down. */
export const requireDocker = (): void => {
  if (!Bun.which("docker"))
    throw new Error(
      "docker is required for the gateway cases: install Docker (https://docs.docker.com/get-docker/) and start it",
    );
  if (sh(["docker", "info"]).exitCode !== 0)
    throw new Error(
      "docker is installed but its daemon is not running: start Docker",
    );
};

/** Runs `fn` with a throwaway Postgres on a loopback port. `query` runs SQL in it and returns the rows as `|` separated text. The container is removed when `fn` ends. */
export const withPostgres = async <T>(
  fn: (port: number, query: (sql: string) => string) => Promise<T>,
): Promise<T> => {
  requireDocker();
  const port = await allocPort();
  const name = `ccrel-pg-${process.pid}-${port}`;
  const rm = () => void sh(["docker", "rm", "-f", name]);
  onCleanup(rm);
  const run = sh([
    "docker",
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-e",
    "POSTGRES_HOST_AUTH_METHOD=trust",
    "-e",
    "POSTGRES_DB=probe",
    "-p",
    `127.0.0.1:${port}:5432`,
    IMAGE,
  ]);
  if (run.exitCode !== 0)
    throw new Error(
      `docker run ${IMAGE} failed: ${run.stderr.toString().trim().slice(0, 200)}`,
    );
  try {
    // The first server of the image listens on its socket only; a TCP query works once the final one is up.
    for (let i = 0; ; i++) {
      const q = sh([
        "docker",
        "exec",
        name,
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "probe",
        "-c",
        "select 1",
      ]);
      if (q.exitCode === 0) break;
      if (i >= 60)
        throw new Error("postgres did not accept connections in 60 s");
      await Bun.sleep(1000);
    }
    const query = (sql: string): string => {
      const q = sh([
        "docker",
        "exec",
        name,
        "psql",
        "-h",
        "127.0.0.1",
        "-U",
        "postgres",
        "-d",
        "probe",
        "-At",
        "-c",
        sql,
      ]);
      if (q.exitCode !== 0)
        throw new Error(`psql failed: ${q.stderr.toString().trim()}`);
      return q.stdout.toString().trim();
    };
    return await fn(port, query);
  } finally {
    rm();
  }
};

export type Seen = {
  path: string;
  betas: string[];
  tags: boolean;
  /** The access key id in a SigV4 `Authorization` header, or null. */
  signedWith: string | null;
};
/** A stub Anthropic upstream that records the path, the betas and whether `tags` was in the body. */
export const startUpstream = () => {
  const seen: Seen[] = [];
  const srv = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    async fetch(req) {
      let b: Record<string, unknown> = {};
      try {
        b = JSON.parse(await req.text());
      } catch {
        // no JSON body
      }
      seen.push({
        path: new URL(req.url).pathname,
        betas: (req.headers.get("anthropic-beta") ?? "")
          .split(",")
          .filter(Boolean),
        tags: "tags" in b,
        signedWith:
          /Credential=([^/,\s]+)\//.exec(
            req.headers.get("authorization") ?? "",
          )?.[1] ?? null,
      });
      return Response.json({
        id: "m",
        type: "message",
        role: "assistant",
        model: "x",
        content: [{ type: "text", text: "OK" }],
        stop_reason: "end_turn",
        usage: { input_tokens: 1, output_tokens: 1 },
      });
    },
  });
  return {
    url: `http://127.0.0.1:${srv.port}`,
    seen,
    stop: () => srv.stop(true),
  };
};

/** The access key id in the assumed-role answer of the stub STS. */
export const ASSUMED_KEY_ID = "ASIAPROBEASSUMED";
/**
 * A stub for https://sts.us-east-1.amazonaws.com: the program has no setting for the STS address (it builds it from the region), so the gateway reaches the stub through a CONNECT proxy and a throw-away CA.
 * `calls` holds the form fields and the SigV4 key id of each AssumeRole request. "denied" answers AccessDenied.
 */
export const startSts = async (answer: "ok" | "denied" = "ok") => {
  const calls: (Record<string, string> & { signedWith: string })[] = [];
  const mitm = await startMitm({
    tunnelOthers: false,
    hosts: ["sts.us-east-1.amazonaws.com"],
    upstream: async (req) => {
      const form = Object.fromEntries(new URLSearchParams(await req.text()));
      calls.push({
        ...form,
        signedWith:
          /Credential=([^/,\s]+)\//.exec(
            req.headers.get("authorization") ?? "",
          )?.[1] ?? "",
      });
      const xml = { headers: { "content-type": "text/xml" } };
      if (answer === "denied")
        return new Response(
          '<ErrorResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><Error><Type>Sender</Type><Code>AccessDenied</Code><Message>probe: not allowed to assume the role</Message></Error><RequestId>probe</RequestId></ErrorResponse>',
          { status: 403, ...xml },
        );
      return new Response(
        `<AssumeRoleResponse xmlns="https://sts.amazonaws.com/doc/2011-06-15/"><AssumeRoleResult><Credentials><AccessKeyId>${ASSUMED_KEY_ID}</AccessKeyId><SecretAccessKey>probe-assumed-secret</SecretAccessKey><SessionToken>probe-assumed-session</SessionToken><Expiration>2099-01-01T00:00:00Z</Expiration></Credentials><AssumedRoleUser><AssumedRoleId>AROAPROBE:s</AssumedRoleId><Arn>${form["RoleArn"] ?? ""}</Arn></AssumedRoleUser></AssumeRoleResult></AssumeRoleResponse>`,
        xml,
      );
    },
  });
  return {
    /** Environment that sends the gateway's STS calls to the stub. */
    env: { HTTPS_PROXY: mitm.proxyUrl, NODE_EXTRA_CA_CERTS: mitm.caFile },
    calls,
    stop: mitm.stop,
  };
};

/** `claude gateway --config` in the sandbox. `ready` is true once the port answers, false if the process exits first. */
export const startGateway = async (
  bin: string,
  sb: Sandbox,
  o: Omit<Parameters<typeof gatewayYaml>[0], "port"> & {
    env?: Record<string, string>;
  },
) => {
  const port = await allocPort();
  const cfg = `${sb.root}/gateway.yaml`;
  const { env, ...yaml } = o;
  await Bun.write(cfg, gatewayYaml({ port, ...yaml }));
  const p = Bun.spawn([bin, "gateway", "--config", cfg], {
    cwd: sb.proj,
    env: childEnv({
      home: sb.home,
      configDir: sb.cfg,
      baseUrl: o.upstream,
      auth: "none",
      extra: { CLAUDE_GATEWAY_ALLOW_LOOPBACK: "1", ...env },
      allowOverride: Object.keys(env ?? {}),
    }),
    stdout: "pipe",
    stderr: "pipe",
    detached: true,
  });
  registerPid(p.pid);
  let log = "";
  for (const s of [p.stdout, p.stderr])
    void (async () => {
      const d = new TextDecoder();
      for await (const c of s) log += d.decode(c);
    })();
  let exited = false;
  void p.exited.then(() => (exited = true));
  const url = `http://127.0.0.1:${port}`;
  const ready = async (timeoutMs = 60_000): Promise<boolean> => {
    for (const end = Date.now() + timeoutMs; Date.now() < end && !exited; ) {
      if (
        await fetch(`${url}/`).then(
          () => true,
          () => false,
        )
      )
        return true;
      await Bun.sleep(250);
    }
    return false;
  };
  return {
    url,
    ready,
    exit: () => p.exited,
    log: () => log,
    stop: async () => {
      if (!exited) p.kill("SIGTERM");
      await Promise.race([p.exited, Bun.sleep(5000)]);
      if (!exited) p.kill("SIGKILL");
    },
  };
};
