// Release-note items of 2.1.317 and 2.1.318 that a user can see: the sign-in end date (`loginExpiresAt`, `credential_expires_at`)
// and the `anthropic.*` OpenTelemetry attributes. The login is a fake file in the sandbox config folder; no request leaves the machine.
import type { Data } from "../../lib/results.ts";
import { FIRST_PARTY, login, REFRESH_END } from "./notes319login.ts";
import { otelCases } from "./notes319otel.ts";
import { events, obj, type Run } from "./run.ts";
import {
	type CaseDef,
	json,
	runCases,
	scalar,
	show,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const DAY = 86_400_000;

const END_ISO = new Date(REFRESH_END).toISOString();
const NO_LOGIN_ARGS = ["auth", "status"];

interface LoginOpt {
	creds?: string;
	argv?: string[];
	env?: Record<string, string>;
}

const statusData = (r: Run, text: boolean): Record<string, Data> => {
	if (text) {
		const l = r.stdout.split("\n").find((x) => x.includes("Sign-in")) ?? "";
		return {
			signInLine: l.replaceAll(/\d{4}-\d\d-\d\d(T[\d:.]+Z)?/gu, "<date>"),
			rangeIsExpected: l.endsWith(
				`between 2030-01-12 and 2030-01-15 (${END_ISO})`,
			),
		};
	}
	const s = obj(JSON.parse(r.stdout));
	return {
		loginExpiresAt: scalar(s["loginExpiresAt"]),
		isRefreshEnd: s["loginExpiresAt"] === END_ISO,
		loggedIn: scalar(s["loggedIn"]),
		authMethod: scalar(s["authMethod"]),
		keys: Object.keys(s).join(","),
	};
};

const eventData = (r: Run): Record<string, Data> => {
	const ev = events(r);
	return {
		byEvent: json(
			ev
				.filter((e) => "credential_expires_at" in e)
				.map((e) => [
					e["type"],
					e["subtype"],
					e["credential_expires_at"] === END_ISO,
				]),
		),
		eventsWithout: json(
			ev
				.filter((e) => !("credential_expires_at" in e))
				.map((e) => `${show(e["type"])}/${show(e["subtype"] ?? "")}`),
		),
	};
};

const loginData = (r: Run, o: LoginOpt): Record<string, Data> => {
	const data: Record<string, Data> = {
		precondition: r.code !== null && !r.timedOut,
		exit: r.code,
	};
	if (o.argv?.[0] === "auth") {
		Object.assign(data, statusData(r, o.argv.includes("--text")));
	} else if (o.argv === ARGS_TEXT) {
		data["stdout"] = r.stdout.trim();
	} else {
		Object.assign(data, eventData(r));
	}
	data["warning"] = r.stderr
		.split("\n")
		.filter((l) => /sign-in/iu.test(l))
		.join("\n");
	return data;
};

/** One run with a stored login (or none). Reports the end date wherever the program wrote it. */
const loginCase = (name: string, o: LoginOpt): CaseDef => ({
	name: `login-expiry.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				auth: "none",
				env: { ...FIRST_PARTY, ...o.env },
				...(o.creds === undefined
					? {}
					: { cfgFiles: { ".credentials.json": o.creds } }),
				...(o.argv === undefined ? {} : { argv: o.argv, noPrompt: true }),
				timeoutMs: 60_000,
			},
			(r) => ({ from: r, data: loginData(r, o) }),
		),
});

const ARGS_TEXT = ["-p", "Reply with 'OK'.", "--model", "claude-opus-5-5"];
const ARGS_JSON = [...ARGS_TEXT, "--output-format", "json"];

const statusCases = (): CaseDef[] => [
	loginCase("status-json", { creds: login(), argv: NO_LOGIN_ARGS }),
	loginCase("status-text", {
		creds: login(),
		argv: [...NO_LOGIN_ARGS, "--text"],
	}),
	loginCase("result-stream-json", { creds: login() }),
	loginCase("result-json", { creds: login(), argv: ARGS_JSON }),
	loginCase("no-login-status", { argv: NO_LOGIN_ARGS }),
	loginCase("no-refresh-date", {
		creds: login({ refreshTokenExpiresAt: undefined }),
		argv: NO_LOGIN_ARGS,
	}),
	loginCase("access-outlives-refresh", {
		creds: login({ expiresAt: REFRESH_END + 4 * DAY }),
		argv: NO_LOGIN_ARGS,
	}),
	loginCase("result-json-no-date", {
		creds: login({ expiresAt: REFRESH_END + 4 * DAY }),
		argv: ARGS_JSON,
	}),
	loginCase("third-party-provider", {
		creds: login(),
		argv: NO_LOGIN_ARGS,
		env: { CLAUDE_CODE_USE_BEDROCK: "1" },
	}),
];

const dateCases = (): CaseDef[] => [
	loginCase("soon-print", {
		argv: ARGS_TEXT,
		creds: login({
			expiresAt: Date.now() + 4 * DAY,
			refreshTokenExpiresAt: Date.now() + 5 * DAY,
		}),
	}),
	loginCase("before-2025", {
		creds: login({
			expiresAt: Date.UTC(2024, 5, 1),
			refreshTokenExpiresAt: Date.UTC(2024, 5, 1),
		}),
		argv: NO_LOGIN_ARGS,
	}),
	loginCase("over-ten-years", {
		creds: login({
			expiresAt: Date.UTC(2050, 0, 1),
			refreshTokenExpiresAt: Date.UTC(2050, 0, 1),
		}),
		argv: NO_LOGIN_ARGS,
	}),
	loginCase("past", {
		creds: login({
			expiresAt: Date.UTC(2025, 5, 1),
			refreshTokenExpiresAt: Date.UTC(2025, 5, 1),
		}),
		argv: [...NO_LOGIN_ARGS, "--text"],
	}),
];

export const notes319: PrintGroup = {
	id: "notes319",
	title: "Release-note items of 2.1.317 and 2.1.318",
	run: (ctx) =>
		runCases(ctx, "notes319", [
			...statusCases(),
			...dateCases(),
			...otelCases(),
		]),
};
