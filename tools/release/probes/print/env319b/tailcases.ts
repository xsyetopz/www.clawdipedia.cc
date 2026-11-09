import type { CaseDef } from "../run/helpers.ts";
import { otel } from "./export.ts";
import { delta, POLICY, replyGate } from "./stream.ts";

const FAST = { CLAUDE_CODE_PLAIN_DELTA_FAST_PATH: "1" };
const T500 = { OTEL_EXPORTER_OTLP_TIMEOUT: "500" };

export const tailCases: CaseDef[] = [
	delta("off", {}),
	delta("fast", FAST),
	delta("fast-direct", { ...FAST, CLAUDE_CODE_PLAIN_DELTA_DIRECT_WRITE: "1" }),
	delta("direct-only", { CLAUDE_CODE_PLAIN_DELTA_DIRECT_WRITE: "1" }),
	delta("fast-source", {
		...FAST,
		CLAUDE_CODE_PLAIN_DELTA_TAKE_AT_SOURCE: "1",
	}),
	delta("source-only", { CLAUDE_CODE_PLAIN_DELTA_TAKE_AT_SOURCE: "1" }),
	replyGate("unset"),
	replyGate("valid", POLICY),
	replyGate("invalid", "{not json"),
	otel("default", {}),
	otel("generic-500", T500),
	otel("all-three-500", {
		OTEL_EXPORTER_OTLP_TIMEOUT: "20000",
		OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "500",
		OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "500",
		OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "500",
	}),
	otel("generic-500-logs-5000", {
		...T500,
		OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "5000",
	}),
	otel("generic-500-metrics-5000", {
		...T500,
		OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "5000",
	}),
	otel("generic-500-traces-5000", {
		...T500,
		OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "5000",
	}),
	otel("generic-500-all-signals-5000", {
		...T500,
		OTEL_EXPORTER_OTLP_LOGS_TIMEOUT: "5000",
		OTEL_EXPORTER_OTLP_METRICS_TIMEOUT: "5000",
		OTEL_EXPORTER_OTLP_TRACES_TIMEOUT: "5000",
	}),
];
