import { join } from "node:path";

import type { Sandbox } from "../../../lib/sandbox.ts";
import { ESC, type PtyCase, READY, shows, WAIT } from "../harness.ts";
import { lines, tail, writeExec } from "./common.ts";

/**
 * The gateway sign-in of /login, against a stand-in gateway on localhost (plain HTTP is allowed there). It answers
 * discovery, then `device_authorization` with a `login_notice`, then keeps the token poll pending. BROWSER is a shim
 * that records the page the program opens. The real gateway's own answer is the print case `api319.gateway.login-notice-served`.
 */
export const NOTICE = "Call IT now and ask for a code";
let gatewayStub: ReturnType<typeof Bun.serve> | undefined;

const answer = (u: URL, notice?: string): Response => {
	if (u.pathname === "/oauth/device_authorization") {
		return Response.json({
			device_code: "probe-device-code",
			user_code: "PRBE-CODE",
			verification_uri: `${u.origin}/device`,
			expires_in: 600,
			interval: 5,
			...(notice === undefined ? {} : { login_notice: notice }),
		});
	}
	if (u.pathname === "/oauth/token") {
		return Response.json({ error: "authorization_pending" }, { status: 400 });
	}
	return Response.json({});
};

const setupGateway = async (sb: Sandbox, notice?: string): Promise<void> => {
	const hits: string[] = [];
	const server = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		fetch: async (req) => {
			const u = new URL(req.url);
			hits.push(`${req.method} ${u.pathname}`);
			await Bun.write(join(sb.home, "gateway-hits.txt"), hits.join("\n"));
			return answer(u, notice);
		},
	});
	gatewayStub = server;
	await writeExec(
		join(sb.home, ".probe-bin", "browser"),
		`#!/bin/sh\nprintf '%s\\n' "$@" >> "${sb.home}/browser-opened.txt"\n`,
	);
	await Bun.write(
		join(sb.cfg, "settings.json"),
		JSON.stringify({
			forceLoginMethod: "gateway",
			forceLoginGatewayUrl: `http://127.0.0.1:${server.port}`,
		}),
	);
};

const SCHEDULE: PtyCase["schedule"] = [
	READY,
	{ t: 1, send: "/login", label: "type" },
	{ t: 3, send: "\r", label: "run" },
	WAIT("gateway", "gateway sign-in", 10),
	{ t: 1, send: "\r", label: "sign in" },
	{ ...WAIT("Trust", "trust prompt", 10), rebase: true },
	// the prompt starts on "No, cancel login"
	{ t: 1, send: "\u001B[A", label: "up to trust" },
	{ t: 2, send: "\r", label: "trust" },
	{ ...WAIT("PRBE-CODE", "code shown", 10), rebase: true },
	ESC(3),
];

export const gatewayLogin = (notice?: string): PtyCase => ({
	id: `cli319.gateway-login-notice.${notice === undefined ? "unset" : "set"}`,
	auth: "none",
	args: ["--debug-file", "{CFG}/d.log"],
	setup: (sb) => setupGateway(sb, notice),
	env: { BROWSER: "{HOME}/.probe-bin/browser" },
	schedule: SCHEDULE,
	secs: 40,
	notes: `forceLoginMethod gateway and forceLoginGatewayUrl in user settings, no API key; /login, Enter on the gateway sign-in, Up and Enter on the trust prompt. The stand-in gateway's device_authorization ${notice === undefined ? "has no login_notice" : `has login_notice "${notice}"`}.`,
	data: (x) => {
		void gatewayStub?.stop(true);
		return {
			precondition: shows(x, "PRBE-CODE"),
			noticeShown: shows(x, NOTICE),
			gatewayHits: x.file("gateway-hits.txt"),
			browserOpened: x
				.file("browser-opened.txt")
				.replace(/:\d+/u, ":<port>")
				.trim(),
			screenTail: tail(x, 14),
			gatewayLines: lines(x, /\[gateway/u),
		};
	},
	samples: (x) => ({
		screen: x.screen
			.split("\n")
			.filter((l) => l.trim())
			.join("\n")
			.slice(-2900),
	}),
});
