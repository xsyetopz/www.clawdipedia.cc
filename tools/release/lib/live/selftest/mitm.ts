// Offline checks of the mitm stand-in: its own CA, the fault replies and the hosts option.
import { pathExists } from "../../fs.ts";
import { type Mitm, startMitm, USAGE_PATH } from "../../mitm.ts";
import { mapSeq } from "../../seq.ts";

type Step = (name: string, ok: boolean, detail?: string) => void;

const message = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

const viaProxy = async (m: Mitm, url: string): Promise<Response> =>
	fetch(url, {
		proxy: m.proxyUrl,
		tls: { ca: await Bun.file(m.caFile).text() },
	});

const faultSummary = async (m: Mitm, f: Parameters<Mitm["setFault"]>[0]) => {
	m.setFault(f);
	try {
		const res = await viaProxy(m, `https://api.anthropic.com${USAGE_PATH}`);
		const body = await res.text();
		return `${res.status}${res.headers.get("retry-after") === null ? "" : "+ra"}${body.includes("rate_limit_error") ? "+env" : ""}`;
	} catch (error) {
		return `error:${message(error).slice(0, 60)}`;
	}
};

/** An own CA, fault replies through the proxy, everything else upstream, the CA deleted on stop. */
const faultChecks = async (step: Step): Promise<void> => {
	const m = await startMitm({
		tunnelOthers: false,
		upstream: () => Promise.resolve(new Response("up", { status: 200 })),
	});
	const seen = await mapSeq(
		["429", "429-ra", "200-envelope", "pass"] as const,
		(f) => faultSummary(m, f),
	);
	const logged = JSON.stringify(m.log());
	await m.stop();
	step(
		"mitm: 429 / 429+retry-after / 200 envelope / pass-through, path and status only",
		seen.join(",") === "429+env,429+ra+env,200+env,200" &&
			!/authorization|x-api-key|body/iu.test(logged),
		seen.join(" "),
	);
	step("mitm: throw-away CA deleted on stop", !(await pathExists(m.caFile)));
};

/** A second host goes to the TLS stub under the same CA. */
const hostChecks = async (step: Step): Promise<void> => {
	const mh = await startMitm({
		tunnelOthers: false,
		hosts: ["sts.us-east-1.amazonaws.com"],
		upstream: () => Promise.resolve(new Response("sts", { status: 200 })),
	});
	let viaHost: string;
	try {
		const res = await viaProxy(mh, "https://sts.us-east-1.amazonaws.com/");
		viaHost = await res.text();
	} catch (error) {
		viaHost = `error:${message(error).slice(0, 60)}`;
	}
	await mh.stop();
	step(
		"mitm: hosts option sends a second host to the TLS stub",
		viaHost === "sts",
		viaHost,
	);
};

export const runMitmSelftest = async (step: Step): Promise<void> => {
	await faultChecks(step);
	await hostChecks(step);
};
