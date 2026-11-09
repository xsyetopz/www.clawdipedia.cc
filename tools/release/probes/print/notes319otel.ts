// OpenTelemetry `anthropic.*` attribute cases of 2.1.317 and 2.1.318.
import { startOtlp, valuesOf } from "../../lib/otlp.ts";
import type { Data } from "../../lib/results.ts";
import { FIRST_PARTY, login } from "./notes319login.ts";
import { type CaseDef, json, withRun } from "./run/helpers.ts";

const otelEnv = (url: string): Record<string, string> => ({
	CLAUDE_CODE_ENABLE_TELEMETRY: "1",
	OTEL_LOGS_EXPORTER: "otlp",
	OTEL_METRICS_EXPORTER: "otlp",
	OTEL_TRACES_EXPORTER: "otlp",
	CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
	OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
	OTEL_EXPORTER_OTLP_ENDPOINT: url,
	OTEL_METRIC_EXPORT_INTERVAL: "500",
	OTEL_LOGS_EXPORT_INTERVAL: "500",
	OTEL_TRACES_EXPORT_INTERVAL: "500",
});

interface OtelOpt {
	env?: Record<string, string>;
	creds?: string;
	account?: Record<string, unknown>;
	auth?: "none";
	allow?: string[];
}

/** One run that exports all three signals to a local receiver. Reports the `anthropic.*` values per signal. */
const otelCase = (name: string, o: OtelOpt): CaseDef => ({
	name: `otel-attrs.${name}`,
	run: async (ctx) => {
		const rx = await startOtlp();
		try {
			return await withRun(
				ctx,
				{
					...(o.auth ? { auth: o.auth } : {}),
					allowOverride: [
						...(o.allow ?? []),
						"DISABLE_TELEMETRY",
						"CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC",
					],
					env: {
						DISABLE_TELEMETRY: "",
						CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
						...otelEnv(rx.url),
						...o.env,
					},
					cfgFiles: {
						...(o.creds === undefined ? {} : { ".credentials.json": o.creds }),
						".claude.json": json({
							hasCompletedOnboarding: true,
							...(o.account ? { oauthAccount: o.account } : {}),
						}),
					},
					timeoutMs: 60_000,
				},
				(r) => {
					const data: Record<string, Data> = {
						precondition: SIGNALS.every((x) => rx.bodies[x].length > 0),
					};
					for (const s of SIGNALS) {
						data[s] = json({
							exports: rx.bodies[s].length,
							...valuesOf(rx.bodies[s], "anthropic."),
						});
					}
					return { from: r, data };
				},
			);
		} finally {
			void rx.stop();
		}
	},
});

const SIGNALS = ["metrics", "logs", "traces"] as const;
const ACCOUNT = {
	accountUuid: "00000000-0000-4000-8000-000000000001",
	emailAddress: "probe@example.com",
	organizationUuid: "00000000-0000-4000-8000-000000000002",
};

export const otelCases = (): CaseDef[] => [
	otelCase("api-key", {}),
	otelCase("max-plan", { auth: "none", creds: login(), env: FIRST_PARTY }),
	otelCase("team-premium", {
		auth: "none",
		creds: login({}, "team"),
		env: FIRST_PARTY,
		account: { ...ACCOUNT, seatTier: "team_tier_1" },
	}),
	otelCase("enterprise-usage-based", {
		auth: "none",
		creds: login({}, "enterprise"),
		env: FIRST_PARTY,
		account: { ...ACCOUNT, seatTier: "enterprise_usage_based" },
	}),
	otelCase("free-plan", {
		auth: "none",
		creds: login({}, "free"),
		env: FIRST_PARTY,
	}),
	otelCase("default-api-url", {
		env: { ANTHROPIC_BASE_URL: "https://api.anthropic.com" },
		allow: ["ANTHROPIC_BASE_URL"],
	}),
	otelCase("bedrock-custom-url", {
		env: {
			CLAUDE_CODE_USE_BEDROCK: "1",
			CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
			ANTHROPIC_BEDROCK_BASE_URL: "http://127.0.0.1:9",
		},
	}),
	otelCase("bedrock", {
		env: {
			CLAUDE_CODE_USE_BEDROCK: "1",
			CLAUDE_CODE_SKIP_BEDROCK_AUTH: "1",
		},
	}),
];
