import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { makePki } from "../src/pki.ts";

const sans = (cert: string): string => {
  const r = Bun.spawnSync(
    ["openssl", "x509", "-in", cert, "-noout", "-ext", "subjectAltName"],
    { stdout: "pipe", stderr: "pipe" },
  );
  return r.stdout.toString();
};

test("makePki names api.anthropic.com and each extra host, and deletes the CA key", () => {
  const dir = mkdtempSync(join(tmpdir(), "pki-test-"));
  try {
    const { cert } = makePki(dir, ["sts.us-east-1.amazonaws.com"]);
    const out = sans(cert);
    expect(out).toContain("DNS:api.anthropic.com");
    expect(out).toContain("DNS:sts.us-east-1.amazonaws.com");
    expect(Bun.file(join(dir, "ca.key")).size).toBe(0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("makePki names only api.anthropic.com by default", () => {
  const dir = mkdtempSync(join(tmpdir(), "pki-test-"));
  try {
    expect(sans(makePki(dir).cert)).not.toContain("amazonaws");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
