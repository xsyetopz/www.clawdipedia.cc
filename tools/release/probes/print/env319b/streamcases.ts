import type { CaseDef } from "../run/helpers.ts";
import { authWarm, memStore, otlpProtocol } from "./export.ts";
import { hold, trinket } from "./stream.ts";

const HOLD1 = { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "1" };
const NOSUB = {
	...HOLD1,
	CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "2000",
};
const SPACED = { CLAUDE_CODE_STREAM_EVENT_HOLD_MS: "100" };
const SPACED_NOSUB = {
	...SPACED,
	CLAUDE_CODE_STREAM_EVENT_NO_SUBSCRIBER_HOLD_MS: "3000",
};
const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };
const COWORK = {
	CLAUDE_CODE_REMOTE: "1",
	CLAUDE_CODE_ENTRYPOINT: "remote_cowork",
};

export const streamCases: CaseDef[] = [
	hold("hold-only", HOLD1),
	hold("hold-false", HOLD1, false),
	hold("nosub-false", NOSUB, false),
	hold("nosub-true", NOSUB, true),
	hold("nosub-null", NOSUB, null),
	hold("nosub-untold", NOSUB),
	hold("spaced-off", SPACED, undefined, true),
	hold("spaced-false-0", SPACED, false, true),
	hold("spaced-false-3000", SPACED_NOSUB, false, true),
	hold("spaced-true-3000", SPACED_NOSUB, true, true),
	hold("spaced-untold-3000", SPACED_NOSUB, undefined, true),
	hold("spaced-null-3000", SPACED_NOSUB, null, true),
	memStore("probe", {}),
	authWarm("on", { ...FIRST_PARTY, ...COWORK }),
	otlpProtocol("logs", "LOGS", { OTEL_EXPORTER_OTLP_LOGS_PROTOCOL: "bogus" }),
	otlpProtocol("metrics", "METRICS", {
		OTEL_EXPORTER_OTLP_METRICS_PROTOCOL: "bogus",
	}),
	otlpProtocol("traces", "TRACES", {
		OTEL_EXPORTER_OTLP_TRACES_PROTOCOL: "bogus",
	}),
	otlpProtocol("logs-general", "LOGS", {
		OTEL_EXPORTER_OTLP_PROTOCOL: "bogus",
	}),
	authWarm("no-first-party", COWORK),
	authWarm("no-remote", FIRST_PARTY),
	trinket("unset"),
	trinket(
		"set",
		"<summary>TRINKET_MARK</summary> Write the summary of this chat.",
	),
	trinket("no-summary-tag", "TRINKET_MARK plain text"),
];
