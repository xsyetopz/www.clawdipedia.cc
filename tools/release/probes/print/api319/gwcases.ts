import { ADMIN_READ_KEY, mintJwt } from "../../../lib/gateway.ts";
import { obj } from "../run.ts";
import { type CaseDef, scalar } from "../run/helpers.ts";
import {
	gatewayCase,
	jsonOf,
	type Live,
	MESSAGE,
	none,
	prefixed,
	viaGateway,
} from "./gw.ts";
import { retentionCase } from "./retention.ts";

const COST =
	"/v1/organizations/analytics/cost?starting_at=2026-11-01T00:00:00Z&ending_at=2026-11-02T00:00:00Z&time_bucket_width=1d";

const costCase = (name: string, key: boolean): CaseDef =>
	gatewayCase(`cost-route-${name}`, {}, async (g) => {
		const r = await fetch(
			`${g.url}${COST}`,
			key ? { headers: { "x-api-key": ADMIN_READ_KEY } } : {},
		);
		const b = await jsonOf(r);
		return {
			status: r.status,
			bodyKeys: Object.keys(b),
			dataIsEmptyArray: Array.isArray(b["data"]) && b["data"].length === 0,
			hasMore: typeof b["has_more"] === "boolean" ? b["has_more"] : null,
		};
	});

const ANTHROPIC = (url: string): string =>
	`  - provider: anthropic\n    base_url: ${url}\n    auth:\n      api_key: sk-ant-fake-probe\n`;
const WRITE_KEY = "gateway-probe-fake-write-key-0123456789abcdef";
const BLOCKED = "request an increase at https://go.probe.invalid/claude-limits";
const NOTICE = "Call IT <i>now</i> & ask for a code";
/** `gatewayYaml` has no `admin` or top-level slot, so these lines ride on `identity_retention_days` and on the end of `upstreams`. */
const adminLines = (...lines: string[]): string =>
	`90\n${lines.map((l) => `  ${l}`).join("\n")}`;
const oidcYaml = (issuer: string): string =>
	`oidc:\n  issuer: ${issuer}\n  client_id: probe-client\n  client_secret: probe-client-secret\n`;

const deviceProbe = async (g: Live) => {
	const auth = await fetch(`${g.url}/oauth/device_authorization`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({ client_id: "probe" }),
	});
	const a = await jsonOf(auth);
	const code = typeof a["user_code"] === "string" ? a["user_code"] : "";
	const page = await fetch(
		`${g.url}/device?user_code=${encodeURIComponent(code)}`,
	);
	const html = await page.text();
	const notice = a["login_notice"];
	return {
		precondition: auth.status === 200 && typeof a["user_code"] === "string",
		authStatus: auth.status,
		authKeys: Object.keys(a).join(","),
		authLoginNotice: typeof notice === "string" ? notice : null,
		pageStatus: page.status,
		pageHasRawText: html.includes(NOTICE),
		pageHasEscapedText: html.includes(
			"Call IT &lt;i&gt;now&lt;/i&gt; &amp; ask for a code",
		),
		pageHasNotice: html.includes("Call IT"),
	};
};

/** The gateway on an OIDC stub that serves only the discovery document. `notice` goes to the top-level `login_notice`, `admin` to the `admin` block. */
const loginNoticeCase = (
	name: string,
	notice?: string,
	admin?: string,
): CaseDef => {
	let issuer = "";
	const inner = gatewayCase(
		name,
		{
			...(admin === undefined ? {} : { retention: admin }),
			since: "2.1.319",
			upstreams: (u) =>
				`${ANTHROPIC(u)}${oidcYaml(issuer)}${notice === undefined ? "" : `login_notice: ${JSON.stringify(notice)}\n`}`,
		},
		deviceProbe,
	);
	return {
		...inner,
		run: async (ctx) => {
			const idp = Bun.serve({
				port: 0,
				hostname: "127.0.0.1",
				fetch: () =>
					Response.json({
						issuer,
						authorization_endpoint: `${issuer}/authorize`,
						token_endpoint: `${issuer}/token`,
						jwks_uri: `${issuer}/jwks`,
						response_types_supported: ["code"],
						subject_types_supported: ["public"],
						id_token_signing_alg_values_supported: ["RS256"],
					}),
			});
			issuer = `http://127.0.0.1:${idp.port}`;
			try {
				return await inner.run(ctx);
			} finally {
				await idp.stop(true);
			}
		},
	};
};

const blockOrg = async (g: Live) => {
	const set = await fetch(`${g.url}/v1/organizations/spend_limits`, {
		method: "POST",
		headers: { "content-type": "application/json", "x-api-key": WRITE_KEY },
		body: JSON.stringify({
			scope: { type: "organization" },
			amount: "0",
			period: "monthly",
		}),
	});
	g.up.seen.length = 0;
	const r = await fetch(`${g.url}/v1/messages`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com", groups: ["g1"] })}`,
		},
		body: MESSAGE,
	});
	const reply = await jsonOf(r);
	const err = obj(reply["error"]);
	return {
		precondition: set.status === 200 || set.status === 201,
		limitStatus: set.status,
		status: r.status,
		errorType: scalar(err["type"]),
		message: scalar(err["message"]),
		upstreamCalls: g.up.seen.length,
	};
};

/** An organization cap of 0 blocks every developer; reports the 429 the next request gets. */
const blockedCase = (name: string, message?: string): CaseDef =>
	gatewayCase(
		name,
		{
			retention: adminLines(
				`write_keys:\n    - id: probe-w\n      key: ${WRITE_KEY}`,
				...(message === undefined
					? []
					: [`blocked_message: ${JSON.stringify(message)}`]),
			),
		},
		blockOrg,
	);

const bootCase = (
	name: string,
	boot: RegExp,
	retention?: string,
	top = "",
): CaseDef =>
	gatewayCase(
		name,
		{
			boot,
			...(retention === undefined ? {} : { retention }),
			...(top === "" ? {} : { upstreams: (u) => `${ANTHROPIC(u)}${top}` }),
		},
		none,
	);

const billingGroup = async (g: Live) => {
	const out = {
		...prefixed("listed", await viaGateway(g, { team: "g1" }, ["g1"])),
		...prefixed("unlisted", await viaGateway(g, { team: "g1" }, ["other"])),
		...prefixed("otherName", await viaGateway(g, { other: "g1" }, ["g1"])),
		...prefixed("noTags", await viaGateway(g, undefined, ["g1"])),
	};
	await Bun.sleep(300);
	return {
		...out,
		auditBillingGroup: g.log().includes('"billing_group":"g1"'),
		auditBillingGroupIgnored: g.log().includes('"billing_group_ignored":true'),
	};
};

const retention: CaseDef[] = [
	retentionCase("identity-retention-default"),
	retentionCase("identity-retention-30", 30),
	retentionCase("identity-retention-90", 90),
	gatewayCase(
		"identity-retention-zero",
		{ retention: 0, boot: /identity_retention_days/u },
		none,
	),
	gatewayCase(
		"identity-retention-text",
		{ retention: "ninety", boot: /identity_retention_days/u },
		none,
	),
];

const pooled: CaseDef[] = [
	bootCase(
		"pooled-order-duplicate",
		/lists a group more than once/u,
		adminLines(
			"pooled_conflict_rule: priority_list",
			"pooled_priority_order: [a, a]",
		),
	),
	bootCase(
		"pooled-priority-list-empty",
		/needs at least one group/u,
		adminLines("pooled_conflict_rule: priority_list"),
	),
	bootCase(
		"pooled-rule-unknown",
		/pooled_conflict_rule/u,
		adminLines("pooled_conflict_rule: other"),
	),
	bootCase(
		"pooled-order-ignored",
		/pooled_priority_order is ignored/u,
		adminLines("pooled_priority_order: [a, b]"),
	),
	bootCase(
		"pooled-order-with-rule",
		/pooled_priority_order|pooled_conflict_rule/u,
		adminLines(
			"pooled_conflict_rule: priority_list",
			"pooled_priority_order: [a, b]",
		),
	),
];

const notices: CaseDef[] = [
	bootCase(
		"login-notice-no-oidc",
		/login_notice \(no one can sign in/u,
		undefined,
		'login_notice: "Call IT"\n',
	),
	bootCase(
		"login-notice-too-long",
		/login_notice/u,
		undefined,
		`login_notice: ${"x".repeat(501)}\n`,
	),
	loginNoticeCase("login-notice-served", NOTICE),
	loginNoticeCase("login-notice-unset"),
	loginNoticeCase(
		"example-all-four",
		NOTICE,
		adminLines(
			`blocked_message: ${JSON.stringify(BLOCKED)}`,
			"pooled_conflict_rule: priority_list",
			"pooled_priority_order: [a, b]",
		),
	),
	blockedCase("blocked-message-set", BLOCKED),
	blockedCase("blocked-message-unset"),
];

export const gatewayFirst: CaseDef[] = [
	gatewayCase(
		"request-tags-billing-group",
		{ tag: true, since: "2.1.317" },
		billingGroup,
	),
	gatewayCase("request-tags-plain", {}, async (g) =>
		prefixed("listed", await viaGateway(g, { team: "g1" }, ["g1"])),
	),
	costCase("no-key", false),
	costCase("admin", true),
	...retention,
];

export const gatewayLast: CaseDef[] = [
	...pooled,
	...notices,
	gatewayCase("no-postgres", { pg: false }, none),
];
