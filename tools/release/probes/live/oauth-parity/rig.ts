import { join } from "node:path";

import { assertSafeEnv, childEnv } from "../../../lib/env.ts";
import { type Mitm, startMitm } from "../../../lib/mitm.ts";
import { allocPort } from "../../../lib/ports.ts";
import { runChild } from "../../../lib/proc.ts";
import type { Sandbox } from "../../../lib/sandbox.ts";
import { assertShimReady } from "../../../lib/shim.ts";
import { startStub, type Stub } from "../../../lib/stub.ts";
import { type LiveCtx, PROMPT } from "../harness.ts";
import { type Shape, shapeOf } from "./shape.ts";

const toStub =
	(stubBase: string) =>
	(req: Request, url: URL): Promise<Response> =>
		fetch(`${stubBase}${url.pathname}`, {
			method: req.method,
			headers: { "content-type": "application/json" },
			body: ["GET", "HEAD"].includes(req.method) ? null : req.body,
		});

export interface Rig {
	stub: Stub;
	mitm: Mitm;
	mitmKey: Mitm;
}

// Both sides go through a mitm with no ANTHROPIC_BASE_URL, so both see the same default-host behaviour.
// OAuth side: real API (dry: local stub). Key side: always the local stub with the fake key.
export const startRig = async (
	x: LiveCtx,
	sb: Sandbox,
	live: Shape[],
	keyed: Shape[],
): Promise<Rig> => {
	const stub = await startStub(await allocPort());
	const keyBase = await stub.register("parity-key", {
		log: join(sb.root, "parity-key.jsonl"),
	});
	const liveBase = x.dry
		? await stub.register("parity-live", {
				log: join(sb.root, "parity-live.jsonl"),
			})
		: "";
	const mitm = await startMitm({
		onMessages: (r) => {
			live.push(shapeOf(r.body, r.betas));
		},
		...(x.dry ? { tunnelOthers: false, upstream: toStub(liveBase) } : {}),
	});
	const mitmKey = await startMitm({
		onMessages: (r) => {
			keyed.push(shapeOf(r.body, r.betas));
		},
		tunnelOthers: false,
		upstream: toStub(keyBase),
	});
	return { stub, mitm, mitmKey };
};

export const keyRun = async (x: LiveCtx, sb: Sandbox, mitmKey: Mitm) => {
	const env = childEnv({ home: sb.home, configDir: sb.cfg, baseUrl: "" });
	delete env["ANTHROPIC_BASE_URL"];
	env["HTTPS_PROXY"] = mitmKey.proxyUrl;
	env["NODE_EXTRA_CA_CERTS"] = mitmKey.caFile;
	assertSafeEnv(env);
	await assertShimReady(env);
	return runChild(
		[x.bin, "-p", PROMPT, "--output-format", "stream-json", "--verbose"],
		{ cwd: sb.proj, env, timeoutMs: 120_000 },
	);
};
