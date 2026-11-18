// The setup of one print-mode run: its sandbox, arguments, environment, and stdin, and the copy kept after it.
import { dirname } from "node:path";

import { childEnv, PROMPT } from "../../../release/lib/env.ts";
import { allocPort } from "../../../release/lib/ports.ts";
import { makeSandbox, subst } from "../../../release/lib/sandbox.ts";
import { hostSdkUrl } from "../../../release/lib/stub/host.ts";
import type { Case } from "./case.ts";

export type Sandbox = Awaited<ReturnType<typeof makeSandbox>>;

// A made-up, unsigned session token, written to a file in the sandbox. With CLAUDE_CODE_REMOTE_SESSION_ID set, the
// program reads the organization and account of the base OpenTelemetry attributes from its payload
// (organization.id, user.account_uuid, user.account_id; ccr.session.id is the session id). Only the stub sees it.
const FAKE_UUID = "00000000-0000-4000-8000-000000000000";
const tokenPart = (v: object): string =>
	Buffer.from(JSON.stringify(v)).toString("base64url");
/** A made-up, unsigned session token (see above). */
export const fakeSessionToken = (): string =>
	`${tokenPart({ alg: "none" })}.${tokenPart({ organization_uuid: FAKE_UUID, account_uuid: FAKE_UUID })}.x`;

/** The env that sends every log, metric, and attribute the program can export to the local collector. */
export const otelEnv = (collectorPort: number): Record<string, string> => ({
	OTEL_METRICS_INCLUDE_ENTRYPOINT: "true",
	CLAUDE_CODE_REMOTE_SESSION_ID: `session_${FAKE_UUID}`,
	DISABLE_TELEMETRY: "",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
	CLAUDE_CODE_ENABLE_TELEMETRY: "1",
	OTEL_LOGS_EXPORTER: "otlp",
	OTEL_METRICS_EXPORTER: "otlp",
	OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
	OTEL_EXPORTER_OTLP_ENDPOINT: `http://127.0.0.1:${collectorPort}`,
	OTEL_LOGS_EXPORT_INTERVAL: "500",
	OTEL_METRIC_EXPORT_INTERVAL: "1000",
	OTEL_LOG_USER_PROMPTS: "1",
	OTEL_LOG_TOOL_DETAILS: "1",
	OTEL_LOG_TOOL_CONTENT: "1",
	OTEL_LOG_ASSISTANT_RESPONSES: "1",
	OTEL_METRICS_INCLUDE_SESSION_ID: "true",
	OTEL_METRICS_INCLUDE_VERSION: "true",
	OTEL_METRICS_INCLUDE_ACCOUNT_UUID: "true",
});

export const sandboxFor = async (c: Case): Promise<Sandbox> => {
	const sb = await makeSandbox({
		...(c.cfgFiles ? { cfgFiles: c.cfgFiles } : {}),
		...(c.projFiles ? { projFiles: c.projFiles } : {}),
		...(c.git === true ? { git: true } : {}),
		trusted: true,
		seedOnboarding: true,
	});
	if (c.claudeJson !== undefined) {
		const file = Bun.file(`${sb.cfg}/.claude.json`);
		const seeded: unknown = await file.json();
		const base = typeof seeded === "object" && seeded !== null ? seeded : {};
		await Bun.write(
			file,
			`${JSON.stringify({ ...base, ...c.claudeJson }, null, 2)}\n`,
		);
	}
	if (c.git === true && c.commit === true) {
		// the sandbox's own HOME and git config: nothing of the user's git setup applies
		await Bun.$`/usr/bin/git -c user.name=probe -c user.email=probe@example.invalid commit -q --allow-empty -m probe`
			.cwd(sb.proj)
			.env({
				PATH: "/usr/bin:/bin",
				HOME: sb.home,
				GIT_CONFIG_GLOBAL: `${sb.home}/.gitconfig`,
				GIT_CONFIG_NOSYSTEM: "1",
			})
			.quiet();
	}
	return sb;
};

// Writes the lines from index `i` on, in order, and waits where the case puts a number. Each step waits for the one
// before it, so it recurses instead of looping.
const feed = async (
	ctl: ReadableStreamDefaultController<Uint8Array>,
	items: NonNullable<Case["stdin"]>,
	i: number,
): Promise<void> => {
	const item = items[i];
	if (item === undefined) {
		return;
	}
	if (typeof item === "number") {
		await Bun.sleep(item);
	} else {
		ctl.enqueue(new TextEncoder().encode(`${JSON.stringify(item)}\n`));
	}
	await feed(ctl, items, i + 1);
};

// Writes each line in turn and keeps stdin open 5 s after the last line.
export const pacedStdin = (
	items: NonNullable<Case["stdin"]>,
): ReadableStream<Uint8Array> =>
	new ReadableStream({
		async start(ctl) {
			await feed(ctl, items, 0);
			await Bun.sleep(5000);
			ctl.close();
		},
	});

const ioArgs = (c: Case): string[] =>
	c.stdin === undefined
		? ["-p", c.prompt ?? PROMPT, "--output-format", "text"]
		: [
				"-p",
				"--input-format",
				"stream-json",
				"--output-format",
				"stream-json",
				"--verbose",
			];

export const argsFor = (c: Case, sb: Sandbox): string[] => [
	...ioArgs(c),
	"--model",
	"claude-opus-5-5",
	...(c.args ?? []).map((a) =>
		subst(a, sb).split("{SDK_URL}").join(hostSdkUrl()),
	),
];

export const seqOf = (c: Case, sb: Sandbox): NonNullable<Case["seq"]> => {
	const parsed: unknown = JSON.parse(subst(JSON.stringify(c.seq), sb));
	const out: NonNullable<Case["seq"]> = [];
	const steps: unknown[] = Array.isArray(parsed) ? parsed : [];
	for (const step of steps) {
		if (
			typeof step === "object" &&
			step !== null &&
			"name" in step &&
			typeof step.name === "string"
		) {
			out.push({
				name: step.name,
				input: "input" in step ? step.input : undefined,
			});
		}
	}
	return out;
};

// The child environment of one case: the stub as the API, the local collector, a made-up session token file.
export const envFor = async (
	c: Case,
	sb: Sandbox,
	base: string,
	collectorPort: number,
	host: Record<string, string> = {},
): Promise<Record<string, string>> => {
	const tokenFile = `${sb.root}/session-ingress-token`;
	await Bun.write(tokenFile, fakeSessionToken());
	return childEnv({
		home: sb.home,
		configDir: sb.cfg,
		...(c.noKey === true ? { auth: "none" as const } : {}),
		baseUrl:
			c.deadBase === true ? `http://127.0.0.1:${await allocPort()}` : base,
		// a host case sends the session traffic through the mock's proxy, which only reaches the local mock
		allowOverride: [
			"DISABLE_TELEMETRY",
			"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
			...Object.keys(host),
		],
		extra: {
			...otelEnv(collectorPort),
			CLAUDE_SESSION_INGRESS_TOKEN_FILE: tokenFile,
			...host,
			// {COLLECTOR} in a case env value is the collector URL, for a second telemetry endpoint
			...Object.fromEntries(
				Object.entries(c.env ?? {}).map(([k, v]) => [
					k,
					v.replaceAll("{COLLECTOR}", `http://127.0.0.1:${collectorPort}`),
				]),
			),
		},
	});
};

// A copy of the sandbox, with the output of the child, for a look after the run.
export const keepCopy = async (
	sb: Sandbox,
	r: { stdout: string; stderr: string },
	dest: string,
): Promise<void> => {
	await Bun.write(`${sb.root}/stdout.txt`, r.stdout);
	await Bun.write(`${sb.root}/stderr.txt`, r.stderr);
	await Bun.$`mkdir -p ${dirname(dest)} && cp -R ${sb.root} ${dest}`;
};
