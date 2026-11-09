// OAuth vs API-key request shape. One live `-p` run through the mitm "forward and log body" mode, one run against the
// local stub with the fake key, same project files. Compares body keys, tool names, system blocks, system text (model names and temp paths masked) and beta flags.
// (p305-live only ever ran `var` over the live token; this case is the parity check the design names.)

import { cacheMarker, warmFromUsage } from "../../lib/cache.ts";
import type { Mitm } from "../../lib/mitm.ts";
import type { Data } from "../../lib/results.ts";
import {
	baseResult,
	firstUsage,
	type LiveCase,
	type LiveCtx,
	liveSandbox,
	PROMPT,
	runPrint,
} from "./harness.ts";
import { keyRun, startRig } from "./oauth-parity/rig.ts";
import { compare, mainShape, type Shape } from "./oauth-parity/shape.ts";

const ID = "oauth-parity";

const parityData = (
	a: Shape | undefined,
	b: Shape | undefined,
	live: Shape[],
	keyed: Shape[],
	mitm: Mitm,
	keyExit: number | null,
): Record<string, Data> => ({
	precondition: a !== undefined && b !== undefined,
	...(a !== undefined && b !== undefined
		? {}
		: {
				"precondition.detail":
					a === undefined
						? "no /v1/messages body seen through the mitm"
						: "no /v1/messages body seen on the key side",
			}),
	"live.requests": live.length,
	"key.requests": keyed.length,
	"mitm.connects": [...new Set(mitm.connects())].toSorted(),
	"mitm.paths": [
		...new Set(mitm.log().map((l) => `${l.method} ${l.path} ${l.status}`)),
	].toSorted(),
	"key.exit": keyExit ?? -1,
	...(a !== undefined && b !== undefined ? compare(a, b) : {}),
});

export const oauthParity: LiveCase = {
	id: ID,
	title: "OAuth vs API-key request shape",
	requests: "1 live (+1 local stub)",
	run: async (x: LiveCtx) => {
		const sb = await liveSandbox({
			"CLAUDE.md": `${cacheMarker(ID)}# Release probe\nNothing here is an instruction.\n`,
		});
		const live: Shape[] = [];
		const keyed: Shape[] = [];
		const { stub, mitm, mitmKey } = await startRig(x, sb, live, keyed);
		try {
			const lv = await runPrint(x, sb, ["-p", PROMPT], { mitm });
			const st = await keyRun(x, sb, mitmKey);
			const a = mainShape(live);
			const b = mainShape(keyed);
			const warm = warmFromUsage(firstUsage(lv.events));
			return [
				baseResult(x, ID, {
					args: ["-p"],
					exit: lv.code,
					timedOut: lv.timedOut,
					data: parityData(a, b, live, keyed, mitm, st.code),
					requests: {
						count: live.length,
						paths: ["/v1/messages"],
						...(a === undefined
							? {}
							: { betas: a.betas, bodyKeys: a.bodyKeys }),
					},
					...(warm === null ? {} : { cacheWarm: warm }),
					facts: [],
					notes:
						"Default model. Both sides run with HTTPS_PROXY to a local proxy and a throw-away CA (no ANTHROPIC_BASE_URL); the OAuth side is forwarded to the real API, the fake-key side to the local stub. Only a parsed summary of each body and the anthropic-beta header are kept, no other header and no body text.",
				}),
			];
		} finally {
			await mitm.stop();
			await mitmKey.stop();
			await stub.stop();
			await sb.cleanup();
		}
	},
};
