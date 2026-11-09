import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makePki } from "../src/pki.ts";

let dir = "";
beforeEach(async () => {
	dir = await mkdtemp(join(tmpdir(), "pki-test-"));
});
afterEach(async () => {
	await rm(dir, { recursive: true, force: true });
});

const sans = (cert: string): Promise<string> => {
	const proc = Bun.spawn(
		["openssl", "x509", "-in", cert, "-noout", "-ext", "subjectAltName"],
		{ stdout: "pipe", stderr: "pipe" },
	);
	return new Response(proc.stdout).text();
};

test("makePki names api.anthropic.com and each extra host, and deletes the CA key", async () => {
	const { cert } = await makePki(dir, ["sts.us-east-1.amazonaws.com"]);
	const out = await sans(cert);
	expect(out).toContain("DNS:api.anthropic.com");
	expect(out).toContain("DNS:sts.us-east-1.amazonaws.com");
	expect(Bun.file(join(dir, "ca.key")).size).toBe(0);
});

test("makePki names only api.anthropic.com by default", async () => {
	const pki = await makePki(dir);
	expect(await sans(pki.cert)).not.toContain("amazonaws");
});
