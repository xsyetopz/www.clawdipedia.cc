// Offline checks of the gateway config and token helpers and of the OTLP receiver.
import { gatewayYaml, mintJwt } from "../../lib/gateway.ts";
import { startOtlp, valuesOf } from "../../lib/otlp.ts";
import { asRecord } from "../../lib/stub/replies.ts";
import { post, type Step } from "./util.ts";

const part = (x: string): Record<string, unknown> =>
	asRecord(JSON.parse(Buffer.from(x, "base64url").toString()));

const jwtCheck = (step: Step): void => {
	const jwt = mintJwt({ sub: "u" }, "k".repeat(32), 1000).split(".");
	const jh = part(jwt[0] ?? "");
	const jp = part(jwt[1] ?? "");
	step(
		"gateway: mintJwt gives an HS256 token with the key id, the audience and the claims",
		jwt.length === 3 &&
			jh["alg"] === "HS256" &&
			/^[0-9a-f]{16}$/u.test(String(jh["kid"])) &&
			jp["aud"] === "claude-gateway" &&
			jp["sub"] === "u" &&
			jp["exp"] === 4600,
	);
};

const yamlChecks = (step: Step): void => {
	const base = { port: 1, upstream: "http://x", pgPort: 2 };
	step(
		"gateway: the config sets billing_group_tag only when asked",
		gatewayYaml({ ...base, billingGroupTag: true }).includes(
			"billing_group_tag: team",
		) &&
			!gatewayYaml({ ...base, billingGroupTag: false }).includes(
				"billing_group_tag",
			),
	);
	const opts = gatewayYaml({
		...base,
		billingGroupTag: false,
		identityRetentionDays: 30,
		upstreams: "  - provider: mantle\n",
	});
	step(
		"gateway: the config sets identity_retention_days and the upstreams only when asked",
		opts.includes("identity_retention_days: 30") &&
			opts.includes("provider: mantle") &&
			!opts.includes("provider: anthropic") &&
			!gatewayYaml({ ...base, billingGroupTag: false }).includes(
				"identity_retention_days",
			),
	);
};

const OTLP_BODY = {
	resourceMetrics: [
		{
			resource: {
				attributes: [
					{ key: "anthropic.plan", value: { stringValue: "max" } },
					{ key: "other", value: { stringValue: "x" } },
				],
			},
			scopeMetrics: [
				{
					metrics: [
						{
							sum: {
								dataPoints: [
									{
										attributes: [
											{
												key: "anthropic.custom_base_url",
												value: { boolValue: true },
											},
										],
									},
								],
							},
						},
					],
				},
			],
		},
	],
};

const otlpCheck = async (step: Step): Promise<void> => {
	const otlp = await startOtlp();
	await post(`${otlp.url}/v1/metrics`, OTLP_BODY);
	await post(`${otlp.url}/v1/metrics`, "not json");
	step(
		"otlp: the receiver keeps JSON exports by signal and valuesOf lists the attributes with a prefix",
		JSON.stringify(valuesOf(otlp.bodies.metrics, "anthropic.")) ===
			JSON.stringify({
				"anthropic.custom_base_url": ["true"],
				"anthropic.plan": ["max"],
			}) &&
			otlp.bodies.metrics.length === 1 &&
			otlp.bodies.logs.length === 0,
	);
	await otlp.stop();
};

export const gatewayChecks = async (step: Step): Promise<void> => {
	jwtCheck(step);
	yamlChecks(step);
	await otlpCheck(step);
};
