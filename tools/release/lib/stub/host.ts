// A fake Remote Control backend for the program's worker transport (CCR v2), and a fake tool host on top of it.
//
// The program accepts `--sdk-url` only for an Anthropic host name over TLS. The mock therefore runs a local HTTPS
// server with a throwaway certificate for api.anthropic.com, and a CONNECT proxy that sends every tunnel to it. The
// child trusts the certificate through NODE_EXTRA_CA_CERTS and reaches the proxy through HTTPS_PROXY.
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	announce,
	answerTo,
	type HostPayload,
	sse,
	toolCalls,
} from "./host-wire.ts";

export { HOST_NAME } from "./host-wire.ts";

/** The id the program's worker URL carries. */
export const HOST_SESSION_ID = "session_00000000-0000-4000-8000-000000000000";

/** A disposition the program reads from a served tool's result envelope. */
export type HostDisposition =
	| "ran"
	| "denied_by_rule"
	| "denied_by_user"
	| "ask_refused_no_surface"
	| "hook_blocked"
	| "denied_by_session"
	| "validation_failed";

/** What the fake host does. */
export interface HostMockOptions {
	/** The disposition of the answer to the first tool call. Default `denied_by_rule`. */
	disposition?: HostDisposition;
	/** The user message the fake service delivers once the host has announced. */
	userText?: string;
}

/** One request the mock received. */
export interface HostRequest {
	method: string;
	path: string;
	body: string;
}

/** A running mock. */
export interface HostMock {
	/** Every request received, in order. */
	requests: HostRequest[];
	/** The `remote_tool_call` requests the fake host answered. */
	calls: unknown[];
	/** Env for the child: proxy, trusted certificate, forwarding switch, worker epoch. */
	env: () => Record<string, string>;
	/** Stops both servers and removes the certificate. */
	stop: () => Promise<void>;
}

const enc = new TextEncoder();

const makeCert = async (
	dir: string,
): Promise<{ key: string; cert: string }> => {
	const key = join(dir, "key.pem");
	const cert = join(dir, "cert.pem");
	await Bun.$`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${key} -out ${cert} -days 2 -subj /CN=api.anthropic.com -addext subjectAltName=DNS:api.anthropic.com`.quiet();
	return { key, cert };
};

// Sends each CONNECT tunnel to the local TLS server, whatever host the child asked for.
const startProxy = async (target: number): Promise<net.Server> => {
	const proxy = net.createServer((c) => {
		c.once("data", () => {
			const up = net.connect(target, "127.0.0.1", () => {
				c.write("HTTP/1.1 200 Connection Established\r\n\r\n");
				c.pipe(up);
				up.pipe(c);
			});
			up.on("error", () => {
				c.destroy();
			});
			c.on("error", () => {
				up.destroy();
			});
		});
	});
	await new Promise<void>((resolve) => {
		proxy.listen(0, "127.0.0.1", () => {
			resolve();
		});
	});
	return proxy;
};

const proxyPortOf = (proxy: net.Server): number => {
	const addr = proxy.address();
	if (addr === null || typeof addr === "string") {
		throw new Error("proxy has no TCP address");
	}
	return addr.port;
};

// The SSE stream: the host announces after 1.5 s and the user message follows 3 s later, so the program has
// registered the host before the model turn starts.
const eventStream = (
	opts: HostMockOptions,
	push: (p: HostPayload, status: string) => void,
	attach: (c: ReadableStreamDefaultController) => void,
): Response => {
	const user: HostPayload = {
		type: "user",
		uuid: "11111111-1111-4111-8111-111111111111",
		session_id: HOST_SESSION_ID,
		parent_tool_use_id: null,
		message: {
			role: "user",
			content: opts.userText ?? "run the command echo hi on my machine",
		},
	};
	const body = new ReadableStream({
		async start(c) {
			attach(c);
			await Bun.sleep(1500);
			push(announce, "SERVICE_VOUCHED");
			await Bun.sleep(3000);
			push(user, "SERVICE_VOUCHED");
		},
	});
	return new Response(body, {
		headers: {
			"content-type": "text/event-stream",
			// Without this statement the program drops a host announce.
			"x-ccr-session-writers": "v=1;owner_account_only=true",
			"x-ccr-shared-tool-request": "1",
		},
	});
};

// An answer below VERIFIED_BY_GATE is dropped by the program, so the answer carries that status.
const answerCalls = (
	text: string,
	opts: HostMockOptions,
	calls: unknown[],
	push: (p: HostPayload, status: string) => void,
): void => {
	for (const call of toolCalls(text)) {
		calls.push(call);
		push(
			answerTo(call, opts.disposition ?? "denied_by_rule"),
			"VERIFIED_BY_GATE",
		);
	}
};

const mockEnv = (proxyPort: number, cert: string): Record<string, string> => ({
	HTTPS_PROXY: `http://127.0.0.1:${proxyPort}`,
	NO_PROXY: "127.0.0.1",
	NODE_EXTRA_CA_CERTS: cert,
	CLAUDE_CODE_REMOTE_TOOLS_FORWARD: "1",
	CLAUDE_CODE_WORKER_EPOCH: "1",
});

/** Starts the mock. The caller passes `env()` to the child and `--sdk-url` from `hostSdkUrl()`. */
export const startHostMock = async (
	opts: HostMockOptions = {},
): Promise<HostMock> => {
	const dir = await mkdtemp(join(tmpdir(), "hostmock-"));
	const { key, cert } = await makeCert(dir);
	const requests: HostRequest[] = [];
	const calls: unknown[] = [];
	let seq = 0;
	let stream: ReadableStreamDefaultController | undefined;
	const push = (p: HostPayload, status: string): void => {
		seq += 1;
		stream?.enqueue(enc.encode(sse(seq, p, status)));
	};
	const tls = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		idleTimeout: 0,
		tls: { key: Bun.file(key), cert: Bun.file(cert) },
		fetch: async (req) => {
			const path = new URL(req.url).pathname;
			const text = await req.text();
			requests.push({ method: req.method, path, body: text });
			if (path.endsWith("/worker/register")) {
				return Response.json({ worker_epoch: 1 });
			}
			if (path.endsWith("/worker/events/stream")) {
				return eventStream(opts, push, (c) => {
					stream = c;
				});
			}
			if (req.method === "POST" && path.endsWith("/worker/events")) {
				answerCalls(text, opts, calls, push);
			}
			return Response.json({});
		},
	});
	const proxy = await startProxy(tls.port ?? 0);
	const proxyPort = proxyPortOf(proxy);
	return {
		requests,
		calls,
		env: () => mockEnv(proxyPort, cert),
		stop: async () => {
			proxy.close();
			await tls.stop(true);
			await rm(dir, { recursive: true, force: true });
		},
	};
};

/** The `--sdk-url` value the mock answers. */
export const hostSdkUrl = (): string =>
	`https://api.anthropic.com/v1/code/sessions/${HOST_SESSION_ID}`;
