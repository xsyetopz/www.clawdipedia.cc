// Shared pieces for live cases: the sandbox, the live env, print and pty runs, stream-json parsing.
// Every live run uses liveEnv (assertLiveEnv inside) with the token from our own env; nothing else carries it.
// Dry mode (fake token, local stub, dead proxy) uses the same code paths and sends nothing out of the machine.
import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

import { liveEnv } from "../../lib/live/env.ts";
import { runChild } from "../../lib/proc.ts";
import { type PtyResult, type PtyStep, runPty } from "../../lib/pty/driver.ts";
import { type Files, makeSandbox, type Sandbox } from "../../lib/sandbox.ts";
import { assertShimReady } from "../../lib/shim.ts";
import { events } from "./harness/parse.ts";
import type { EnvOpts, LiveCtx } from "./harness/types.ts";

export { PROMPT } from "../../lib/env.ts";
export * from "./harness/parse.ts";
export * from "./harness/types.ts";

/** Safety net for every live sandbox: the Artifact tool can never publish anything. */
const LIVE_SETTINGS = JSON.stringify({ permissions: { deny: ["Artifact"] } });

export const liveSandbox = (projFiles: Files = {}): Promise<Sandbox> =>
	makeSandbox({
		cfgFiles: { "settings.json": LIVE_SETTINGS },
		projFiles,
		trusted: true,
		seedOnboarding: true,
		live: true,
	});

export const envFor = async (
	x: LiveCtx,
	sb: Sandbox,
	o: EnvOpts = {},
): Promise<Record<string, string>> =>
	liveEnv({
		home: sb.home,
		configDir: sb.cfg,
		token: x.token,
		...(o.tty === true ? { tty: true } : {}),
		...(o.allowNonessential === true ? { allowNonessential: true } : {}),
		...(o.featureGates === true ? { featureGates: true } : {}),
		...(o.mitm
			? { mitm: { proxyUrl: o.mitm.proxyUrl, caFile: o.mitm.caFile } }
			: {}),
		...(x.dry ? { deadProxy: true } : {}),
		...(x.dry && o.caseId !== undefined && x.stubBase !== undefined
			? { baseUrl: await x.stubBase(o.caseId) }
			: {}),
	});

/** Print-mode run (-p, stream-json) in the sandbox. One attempt. */
export const runPrint = async (
	x: LiveCtx,
	sb: Sandbox,
	args: string[],
	o: EnvOpts & { model?: string } = {},
) => {
	const env = await envFor(x, sb, o);
	await assertShimReady(env);
	const res = await runChild(
		[
			x.bin,
			...args,
			"--output-format",
			"stream-json",
			"--verbose",
			...(o.model === undefined ? [] : ["--model", o.model]),
		],
		{ cwd: sb.proj, env, timeoutMs: 120_000 },
	);
	return { ...res, events: events(res.stdout) };
};

/** Interactive run through the pty driver. One attempt. */
export const runLivePty = async (
	x: LiveCtx,
	sb: Sandbox,
	o: {
		schedule: PtyStep[];
		secs: number;
		mitm?: NonNullable<EnvOpts["mitm"]>;
		allowNonessential?: boolean;
		featureGates?: boolean;
		args?: string[];
	},
): Promise<PtyResult> => {
	const out = join(sb.root, "pty", "RAW");
	await mkdir(dirname(out), { recursive: true });
	return runPty({
		cwd: sb.proj,
		env: await envFor(x, sb, { tty: true, ...o }),
		bin: x.bin,
		...(o.args === undefined ? {} : { args: o.args }),
		schedule: [
			...o.schedule,
			{ t: o.secs, send: "/exit\r", label: "exit" },
			{ t: o.secs + 2.5, send: "\u0003", label: "ctrl-c-1" },
			{ t: o.secs + 2.8, send: "\u0003", label: "ctrl-c-2" },
		],
		secs: o.secs + 5,
		out,
		liveToken: x.token,
	});
};
