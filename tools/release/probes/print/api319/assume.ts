import { ASSUMED_KEY_ID, mintJwt } from "../../../lib/gateway.ts";
import type { Data } from "../../../lib/results.ts";
import type { CaseDef } from "../run/helpers.ts";
import { gatewayCase, type Live, MESSAGE, none } from "./gw.ts";

const BEDROCK_SOURCE_KEY = "AKIAPROBESOURCE";
const ROLE = "arn:aws:iam::123456789012:role/probe-role";
const DEFAULT_AUTH = `      aws_access_key_id: ${BEDROCK_SOURCE_KEY}\n      aws_secret_access_key: probe-source-secret\n`;

/** A bedrock upstream on the stub, with source access keys and the given `assume_role` YAML lines. */
const bedrock = (url: string, assume = "", auth = ""): string =>
	`  - provider: bedrock
    region: us-east-1
    base_url: ${url}
    models: [claude-sonnet-5-5]
    auth:
${auth === "" ? DEFAULT_AUTH : auth}${assume}`;

const assumeRole = (lines: string[]): string =>
	`    assume_role:\n${lines.map((l) => `      ${l}`).join("\n")}\n`;

const failClosed = (log: string): string | null =>
	log
		.split("\n")
		.find((l) => l.includes("sts:AssumeRole on"))
		?.replace(/^\S+\s+/u, "")
		.replaceAll(/http:\/\/127\.0\.0\.1:\d+/gu, "<sts>")
		.replace(/\s+at\s.*/u, "")
		.slice(0, 600) ?? null;

/** One request to the bedrock upstream; reports the status and what the stub STS and the stub upstream saw. */
const bedrockCall = async (g: Live): Promise<Record<string, Data>> => {
	const r = await fetch(`${g.url}/v1/messages`, {
		method: "POST",
		headers: {
			"content-type": "application/json",
			authorization: `Bearer ${mintJwt({ sub: "u1", email: "u@example.com" })}`,
		},
		body: MESSAGE,
	});
	const body = await r.text();
	const c = g.sts?.calls[0];
	const seen = g.up.seen[0];
	return {
		status: r.status,
		stsCalls: g.sts?.calls.length ?? null,
		stsRoleArn: c?.["RoleArn"] ?? null,
		stsExternalId: c?.["ExternalId"] ?? null,
		stsSessionName: c?.["RoleSessionName"] ?? null,
		stsSignedWithSource:
			c === undefined ? null : c.signedWith === BEDROCK_SOURCE_KEY,
		upstreamCalls: g.up.seen.length,
		upstreamSignedWithAssumed: seen?.signedWith === ASSUMED_KEY_ID,
		upstreamSignedWithSource: seen?.signedWith === BEDROCK_SOURCE_KEY,
		failClosedLog: failClosed(g.log()),
		bodyMentionsAssumeRole: body.includes("sts:AssumeRole"),
	};
};

const stsCase = (
	name: string,
	sts: "ok" | "denied" | "down",
	lines?: string[],
): CaseDef =>
	gatewayCase(
		name,
		{
			sts,
			upstreams: (u) =>
				bedrock(u, lines === undefined ? "" : assumeRole(lines)),
		},
		bedrockCall,
	);

const bootRefusal = (
	name: string,
	boot: RegExp,
	upstreams: (u: string) => string,
): CaseDef => gatewayCase(name, { boot, upstreams }, none);

const ANTHROPIC_KEY = "    auth:\n      api_key: sk-ant-fake-probe\n";
const MANTLE = (u: string): string =>
	`  - provider: mantle\n    name: m\n    region: us-east-1\n    base_url: ${u}\n    models: [claude-opus-4-7]\n    auth:\n${DEFAULT_AUTH}`;

export const assumeCases: CaseDef[] = [
	stsCase("assume-role-sts", "ok", [
		`role_arn: ${ROLE}`,
		"external_id: probe-external-id",
	]),
	stsCase("assume-role-session-sub", "ok", [
		`role_arn: ${ROLE}`,
		"session_name: sub",
	]),
	stsCase("assume-role-session-email", "ok", [
		`role_arn: ${ROLE}`,
		"session_name: email",
	]),
	stsCase("assume-role-sts-denied", "denied", [`role_arn: ${ROLE}`]),
	stsCase("assume-role-sts-down", "down", [`role_arn: ${ROLE}`]),
	stsCase("assume-role-none", "ok"),
	bootRefusal("assume-role-bad-arn", /role_arn|IAM role ARN/u, (u) =>
		bedrock(u, assumeRole(["role_arn: not-an-arn"])),
	),
	bootRefusal("assume-role-bad-external-id", /external_id|1224/u, (u) =>
		bedrock(u, assumeRole([`role_arn: ${ROLE}`, "external_id: x"])),
	),
	bootRefusal(
		"assume-role-bad-session-name",
		/session_name|Invalid enum/u,
		(u) => bedrock(u, assumeRole([`role_arn: ${ROLE}`, "session_name: name"])),
	),
	bootRefusal("assume-role-bearer-token", /assume_role needs SigV4/u, (u) =>
		bedrock(
			u,
			assumeRole([`role_arn: ${ROLE}`]),
			"      aws_bearer_token: probe-bearer\n",
		),
	),
	bootRefusal(
		"assume-role-anthropic",
		/assume_role|Unrecognized/u,
		(u) =>
			`  - provider: anthropic\n    base_url: ${u}\n${ANTHROPIC_KEY}${assumeRole([`role_arn: ${ROLE}`])}`,
	),
	bootRefusal(
		"assume-role-mixed-session",
		/sets assume_role\.session_name/u,
		(u) =>
			`${bedrock(u, assumeRole([`role_arn: ${ROLE}`, "session_name: sub"]))}${MANTLE(u)}`,
	),
];
