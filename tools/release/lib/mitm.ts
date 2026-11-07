// Local stand-in for api.anthropic.com behind a CONNECT proxy, for live runs that need a fault on one endpoint
// (/api/oauth/usage) or a look at message bodies. Ports p305-lv/mitm2.ts and p305-live/proxy.ts.
// The throw-away CA lives in a mkdtemp dir, reaches the child only through NODE_EXTRA_CA_CERTS, and is deleted on stop.
// Never touches the system keychain or trust store. Logs method, path and status only: no headers, no bodies.
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePki } from "../../../inspect/mcp/src/pki.ts";
import { onCleanup } from "./cleanup.ts";

export const USAGE_PATH = "/api/oauth/usage";
export type Fault = "pass" | "429" | "429-ra" | "200-envelope";
const ENVELOPE = {
  type: "error",
  error: { type: "rate_limit_error", message: "Rate limited" },
};

export type MitmLog = {
  method: string;
  path: string;
  status: number;
  fault?: Fault;
};
export type MitmOpts = {
  fault?: Fault; // for USAGE_PATH; default "pass"
  /** Where non-faulted requests go. Default: the real https://api.anthropic.com. Dry runs pass a local answer. */
  upstream?: (req: Request, url: URL) => Promise<Response>;
  /** Hosts besides api.anthropic.com that the proxy sends to the TLS stub, with the same `upstream` answer. */
  hosts?: string[];
  /** Tunnel CONNECT to hosts other than api.anthropic.com. Default true; dry runs say false (502). */
  tunnelOthers?: boolean;
  /** "Forward and log body": called with each parsed POST /v1/messages body (non-auth). Nothing else is read. */
  onMessages?: (rec: { path: string; body: unknown; betas: string }) => void;
};
export type Mitm = {
  proxyUrl: string;
  caFile: string;
  setFault(f: Fault): void;
  log(): MitmLog[];
  connects(): string[];
  stop(): void;
};

const live = new Set<() => void>();
onCleanup(() => {
  for (const s of [...live]) s();
});

const realUpstream = (req: Request, url: URL): Promise<Response> => {
  const h = new Headers(req.headers);
  h.delete("host");
  h.delete("accept-encoding");
  return fetch(`https://api.anthropic.com${url.pathname}${url.search}`, {
    method: req.method,
    headers: h,
    body: ["GET", "HEAD"].includes(req.method) ? null : req.body,
    redirect: "manual",
  });
};

export const startMitm = async (opts: MitmOpts = {}): Promise<Mitm> => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "ccrel-pki-")));
  let fault: Fault = opts.fault ?? "pass";
  const log: MitmLog[] = [];
  const connects: string[] = [];
  let stopped = false;
  let tls: ReturnType<typeof Bun.serve> | undefined;
  let proxy: http.Server | undefined;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    live.delete(stop);
    tls?.stop(true);
    proxy?.close();
    proxy?.closeAllConnections();
    rmSync(dir, { recursive: true, force: true });
  };
  live.add(stop);
  try {
    const pki = makePki(dir, opts.hosts);
    const upstream = opts.upstream ?? realUpstream;
    tls = Bun.serve({
      port: 0,
      hostname: "127.0.0.1",
      idleTimeout: 0, // long SSE streams must not be cut
      tls: { key: Bun.file(pki.key), cert: Bun.file(pki.cert) },
      async fetch(req) {
        const url = new URL(req.url);
        const note = (status: number, f?: Fault): void => {
          log.push({
            method: req.method,
            path: url.pathname,
            status,
            ...(f ? { fault: f } : {}),
          });
        };
        if (url.pathname === USAGE_PATH && fault !== "pass") {
          const f = fault;
          const json = { "content-type": "application/json" };
          if (f === "200-envelope") {
            note(200, f);
            return new Response(JSON.stringify(ENVELOPE), {
              status: 200,
              headers: json,
            });
          }
          note(429, f);
          return new Response(JSON.stringify(ENVELOPE), {
            status: 429,
            headers: f === "429-ra" ? { ...json, "retry-after": "1800" } : json,
          });
        }
        let r: Response;
        try {
          if (
            opts.onMessages &&
            req.method === "POST" &&
            url.pathname === "/v1/messages"
          ) {
            const text = await req.text();
            try {
              opts.onMessages({
                path: url.pathname,
                body: JSON.parse(text),
                betas: req.headers.get("anthropic-beta") ?? "",
              });
            } catch {
              // not JSON: nothing to record
            }
            r = await upstream(
              new Request(req.url, {
                method: "POST",
                headers: new Headers(req.headers),
                body: text,
              }),
              url,
            );
          } else r = await upstream(req, url);
        } catch {
          note(502);
          return new Response("upstream error", { status: 502 });
        }
        note(r.status);
        const rh = new Headers(r.headers);
        rh.delete("content-encoding");
        rh.delete("content-length");
        return new Response(r.body, { status: r.status, headers: rh });
      },
    });
    const tlsPort = tls.port ?? 0;
    proxy = http.createServer((_q, r) => {
      r.statusCode = 405;
      r.end();
    });
    proxy.on("connect", (req, sock, head) => {
      // "host:443", "[::1]:443"
      const target = req.url ?? "";
      const v6 = target.match(/^\[([^\]]+)\](?::(\d+))?$/);
      const [h0 = "", p0 = "443"] = target.split(":");
      const host = v6 ? (v6[1] ?? "") : h0;
      const p = v6 ? (v6[2] ?? "443") : p0;
      connects.push(host);
      sock.on("error", () => sock.destroy());
      const toTls =
        host === "api.anthropic.com" || (opts.hosts ?? []).includes(host);
      if (!toTls && opts.tunnelOthers === false) {
        sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
        return;
      }
      const up = toTls
        ? net.connect(tlsPort, "127.0.0.1")
        : net.connect(Number(p), host);
      up.on("connect", () => {
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
    return {
      proxyUrl: `http://127.0.0.1:${port}`,
      caFile: pki.ca,
      setFault: (f) => {
        fault = f;
      },
      log: () => [...log],
      connects: () => [...connects],
      stop,
    };
  } catch (e) {
    stop();
    throw e;
  }
};
