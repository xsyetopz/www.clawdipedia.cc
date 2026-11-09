// Live /usage with a fault on /api/oauth/usage. Ports p305-lv s_usage*.json (open /usage, press Enter, watch 6 s)
// and mitm2.ts modes. The program runs with the real token behind the local proxy; everything else is forwarded.
// No prompt is sent, but interactive startup makes a few small API requests of its own (title and similar calls). CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC is left out on purpose:
// with it set the panel never calls the endpoint (docs/reference/probes.md).
import {
	type Fault,
	type Mitm,
	startMitm,
	USAGE_PATH,
} from "../../lib/mitm.ts";
import type { Data } from "../../lib/results.ts";
import { READY } from "../pty/harness.ts";
import {
	baseResult,
	type LiveCase,
	type LiveCtx,
	liveSandbox,
	runLivePty,
} from "./harness.ts";

const FAULTS: { id: string; fault: Fault; what: string }[] = [
	{ id: "usage.429", fault: "429", what: "429 without Retry-After" },
	{
		id: "usage.429-retry-after",
		fault: "429-ra",
		what: "429 with Retry-After: 1800",
	},
	{
		id: "usage.envelope",
		fault: "200-envelope",
		what: "200 with an error envelope body",
	},
];

const find = (screen: string, re: RegExp): string =>
	screen
		.split("\n")
		.find((l) => re.test(l))
		?.trim()
		.slice(0, 200) ?? "";

type Fix = (typeof FAULTS)[number];

const mitmFor = (x: LiveCtx, f: Fix): Promise<Mitm> =>
	startMitm({
		fault: f.fault,
		...(x.dry
			? {
					tunnelOthers: false,
					// dry: nothing leaves the machine; any forwarded call gets a local 404
					upstream: () =>
						new Response("{}", {
							status: 404,
							headers: { "content-type": "application/json" },
						}),
				}
			: {}),
	});

const usageData = (f: Fix, mitm: Mitm, s: string): Record<string, Data> => {
	const log = mitm.log();
	const hits = log.filter((l) => l.path === USAGE_PATH);
	const ready = /shortcuts|auto\s*mode|Claude Code/iu.test(s);
	return {
		precondition: ready,
		...(ready ? {} : { "precondition.detail": "UI never started" }),
		fault: f.fault,
		usageEndpointCalls: hits.length,
		usageStatuses: [...new Set(hits.map((h) => String(h.status)))],
		otherPaths: [
			...new Set(
				log
					.filter((l) => l.path !== USAGE_PATH)
					.map((l) => `${l.method} ${l.path} ${l.status}`),
			),
		].toSorted(),
		showsRateLimitedUntil: /rate limited until/iu.test(s),
		showsTryAgainInAMoment: /try again in a moment/iu.test(s),
		showsFailedToLoad: /Failed to load usage data/iu.test(s),
		showsRefreshing: s.includes("Refreshing"),
		errorLine: find(s, /rate limited|Failed to load|Error:/iu),
	};
};

const usageCase = (f: Fix): LiveCase => ({
	id: f.id,
	title: `/usage with ${f.what}`,
	requests: "no prompt; startup sends a few small requests",
	run: async (x: LiveCtx) => {
		const sb = await liveSandbox();
		const mitm = await mitmFor(x, f);
		try {
			const pty = await runLivePty(x, sb, {
				schedule: [READY, { t: 10, send: "/usage\r", label: "usage" }],
				secs: 18,
				mitm,
				allowNonessential: true,
			});
			const hits = mitm.log().filter((l) => l.path === USAGE_PATH);
			return [
				baseResult(x, f.id, {
					prompt: "",
					exit: pty.exit,
					data: usageData(f, mitm, pty.screen),
					notes: `Fault: ${f.what}. ${hits.length > 0 ? "" : "The usage endpoint was never called (seen on 2.1.305 with a real token), so the texts could not be checked. "}No prompt is sent (prompt is empty): /usage is a local command, but interactive startup makes its own small API requests.`,
				}),
			];
		} finally {
			await mitm.stop();
			await sb.cleanup();
		}
	},
});

export const usageCases: LiveCase[] = FAULTS.map((f) => usageCase(f));
