// Runs the print-mode cases against the local stub and the local collector, one case at a time.
import { binaryPath, childEnv, PROMPT } from "../../../release/lib/env.ts";
import { allocPort } from "../../../release/lib/ports.ts";
import { runChild } from "../../../release/lib/proc.ts";
import { makeSandbox, subst } from "../../../release/lib/sandbox.ts";
import { startStub } from "../../../release/lib/stub.ts";
import type { Case } from "./cases.ts";
import { collectRun } from "./collect.ts";
import { startCollector } from "./collector.ts";
import { counts } from "./ingest.ts";

type Sandbox = Awaited<ReturnType<typeof makeSandbox>>;

const otelEnv = (collectorPort: number): Record<string, string> => ({
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

const sandboxFor = (c: Case): Promise<Sandbox> =>
	makeSandbox({
		...(c.cfgFiles ? { cfgFiles: c.cfgFiles } : {}),
		...(c.projFiles ? { projFiles: c.projFiles } : {}),
		...(c.git === true ? { git: true } : {}),
		trusted: true,
		seedOnboarding: true,
	});

const argsFor = (c: Case, sb: Sandbox): string[] => [
	"-p",
	c.prompt ?? PROMPT,
	"--output-format",
	"text",
	"--model",
	"claude-opus-5-5",
	...(c.args ?? []).map((a) => subst(a, sb)),
];

const seqOf = (c: Case, sb: Sandbox): NonNullable<Case["seq"]> => {
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

/** Starts the stub and the collector; `run` does one case, `stop` closes both. */
export const createRunner = async (version: string) => {
	const collectorPort = await allocPort();
	const collector = startCollector(collectorPort);
	const stub = await startStub(await allocPort());
	const bin = binaryPath(version);

	const run = async (c: Case): Promise<void> => {
		const sb = await sandboxFor(c);
		const log = `${sb.root}/requests.jsonl`;
		const base = await stub.register(c.id, {
			log,
			...(c.seq ? { seq: seqOf(c, sb) } : {}),
		});
		const env = childEnv({
			home: sb.home,
			configDir: sb.cfg,
			baseUrl:
				c.deadBase === true ? `http://127.0.0.1:${await allocPort()}` : base,
			allowOverride: [
				"DISABLE_TELEMETRY",
				"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
			],
			extra: { ...otelEnv(collectorPort), ...c.env },
		});
		const r = await runChild([bin, ...argsFor(c, sb)], {
			cwd: sb.proj,
			env,
			timeoutMs: 90_000,
		});
		stub.unregister(c.id);
		counts.runs++;
		console.info(c.id, "exit", r.code, r.timedOut ? "TIMEOUT" : "");
		await collectRun(sb.cfg);
		await sb.cleanup();
	};

	const stop = async (): Promise<void> => {
		await stub.stop();
		await collector.stop(true);
	};

	return { run, stop };
};
