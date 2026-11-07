// The `NODE_EXTRA_CA_CERTS` fix of 2.1.318: a file that is empty, not PEM, or starts with a damaged certificate no longer breaks every connection.
// The file is made in the sandbox from a throw-away CA; the run goes to the local stub.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePki } from "../../../../inspect/mcp/src/pki.ts";
import { startMitm } from "../../lib/mitm.ts";
import {
  type CaseDef,
  olderThan,
  readCfg,
  runCases,
  withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

let pem: string | undefined;
/** One valid CA certificate (PEM), made once with openssl. */
const goodPem = (): string => {
  if (pem) return pem;
  const dir = mkdtempSync(join(tmpdir(), "ccrel-ca-"));
  try {
    pem = readFileSync(makePki(dir).ca, "utf8");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return pem;
};
const DAMAGED =
  "-----BEGIN CERTIFICATE-----\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\n-----END CERTIFICATE-----\n";

/** `content` is the file text; `null` leaves the path without a file. */
const caCase = (name: string, content: () => string | null): CaseDef => ({
  name: `extra-ca.${name}`,
  run: (ctx) => {
    const text = content();
    return withRun(
      ctx,
      {
        env: { NODE_EXTRA_CA_CERTS: "{HOME}/extra-ca.pem" },
        ...(text === null ? {} : { homeFiles: { "extra-ca.pem": text } }),
        args: ["--debug-file", "{CFG}/d.log"],
        timeoutMs: 60_000,
      },
      (r) => {
        const d = readCfg(r, "d.log")
          .split("\n")
          .filter((l) => /CA certs/.test(l))
          .map((l) => l.replace(/^\S+\s/, "").replaceAll(r.sb.root, "<SB>"));
        return {
          from: r,
          data: {
            precondition: r.code !== null && !r.timedOut,
            exit: r.code,
            requests: r.reqs.length,
            stderrWarns: /certificate|CA/i.test(r.stderr),
          },
          samples: {
            stderr: r.stderr.replaceAll(r.sb.root, "<SB>").slice(0, 600),
            debug: d.map((l) => l.slice(0, 260)).join("\n"),
          },
        };
      },
    );
  },
});

/** The run reaches api.anthropic.com through a TLS stub whose certificate chains to the CA at the end of the file: the run works only when the program uses that CA.
 * `hangsBefore` is the first version with the fix: an older program may hang on the file, and that hang is the result, as long as the run reached the proxy. */
const tlsCase = (
  name: string,
  before: string,
  hangsBefore?: string,
): CaseDef => ({
  name: `extra-ca-tls.${name}`,
  run: async (ctx) => {
    const mitm = await startMitm({
      tunnelOthers: false,
      upstream: async () =>
        Response.json({
          id: "m",
          type: "message",
          role: "assistant",
          model: "x",
          content: [{ type: "text", text: "OK" }],
          stop_reason: "end_turn",
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
    });
    try {
      return await withRun(
        ctx,
        {
          env: {
            NODE_EXTRA_CA_CERTS: "{HOME}/extra-ca.pem",
            HTTPS_PROXY: mitm.proxyUrl,
            ANTHROPIC_BASE_URL: "https://api.anthropic.com",
          },
          allowOverride: ["HTTPS_PROXY", "ANTHROPIC_BASE_URL"],
          homeFiles: {
            "extra-ca.pem": before + readFileSync(mitm.caFile, "utf8"),
          },
          timeoutMs: 60_000,
        },
        (r) => ({
          from: r,
          data: {
            precondition:
              hangsBefore !== undefined && olderThan(ctx, hangsBefore)
                ? mitm.connects().length > 0
                : r.code !== null && !r.timedOut,
            exit: r.code,
            reachedTlsStub: mitm.log().length > 0,
            tlsRequests: mitm.log().length,
            connects: mitm.connects().length,
          },
          samples: {
            stderr: r.stderr.replaceAll(r.sb.root, "<SB>").slice(0, 400),
          },
        }),
      );
    } finally {
      mitm.stop();
    }
  },
});

export const cacerts319: PrintGroup = {
  id: "cacerts319",
  title: "NODE_EXTRA_CA_CERTS file faults (2.1.318)",
  run: (ctx) =>
    runCases(ctx, "cacerts319", [
      caCase("valid", goodPem),
      caCase("empty", () => ""),
      caCase("not-pem", () => "this is not a certificate\n"),
      caCase("damaged-only", () => DAMAGED),
      caCase("damaged-first", () => DAMAGED + goodPem()),
      caCase("damaged-last", () => goodPem() + DAMAGED),
      caCase("missing", () => null),
      tlsCase("valid", ""),
      tlsCase("damaged-first", DAMAGED, "2.1.318"),
      tlsCase("not-pem-first", "this is not a certificate\n"),
    ]),
};
