// Multi-tenant fake of the Messages API. One server, many cases: the base URL path starts with the case id.
// Never forwards anything, never stores credentials, answers with canned SSE or JSON.
import { appendFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { FAKE_KEY } from "./env.ts";
import { isOrchestratorAuth, orchestratorRoute } from "./stub/orchestrator.ts";
import {
	asRecord,
	memoryMcp,
	parseApi,
	reply,
	slowStream,
	stream,
	verdict,
} from "./stub/replies.ts";
import type { LoggedRequest, StubCase } from "./stub/types.ts";

export type { LoggedRequest, StubCase } from "./stub/types.ts";

const HEADER_ALLOW = new Set([
	"anthropic-beta",
	"anthropic-version",
	"content-type",
	"user-agent",
	"x-app",
	"x-stainless-lang",
	"x-stainless-package-version",
	"x-claude-code-session-id",
	"x-client-request-id",
	"accept",
	"x-api-key",
	"authorization",
]);

const CASE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const MEMORY_PATH = /^\/v2\/ccr-sessions\/([A-Za-z0-9_-]+)\/memory\/mcp$/u;
const CASE_PATH = /^\/([A-Za-z0-9][A-Za-z0-9._-]*)(\/.*)$/u;

export interface Stub {
	port: number;
	register: (id: string, c: StubCase) => Promise<string>;
	unregister: (id: string) => void;
	/** Returns the stray requests (and removes the stray log). */
	stop: () => Promise<LoggedRequest[]>;
	/** Requests whose first path segment is not a registered case (bad=true). */
	strayLog: string;
}

const apiError = (message: string): Response =>
	Response.json(
		{ type: "error", error: { type: "invalid_request_error", message } },
		{ status: 400 },
	);

/** The allow-listed headers, and whether each credential header held a key this stub accepts (null when none was sent). */
const inspectHeaders = (
	req: Request,
	o: StubCase,
): { headers: Record<string, string>; auth: boolean | null } => {
	const headers: Record<string, string> = {};
	let auth: boolean | null = null;
	for (const [k, v] of req.headers.entries()) {
		if (k === "x-api-key" || k === "authorization") {
			headers[k] = "<redacted>";
			const ok =
				v === FAKE_KEY ||
				v === `Bearer ${FAKE_KEY}` ||
				(o.orchestrator !== undefined && isOrchestratorAuth(v, o.orchestrator));
			auth = auth === false ? false : ok;
		} else if (HEADER_ALLOW.has(k)) {
			headers[k] = v;
		}
	}
	return { headers, auth };
};

const parseBody = (raw: string): unknown => {
	try {
		const body: unknown = JSON.parse(raw);
		return body;
	} catch {
		return raw;
	}
};

const messagesRoute = (
	req: Request,
	id: string,
	o: StubCase,
	body: unknown,
	calls: Map<string, number>,
): Response => {
	const beta = req.headers.get("anthropic-beta") ?? "";
	const refused = beta
		.split(",")
		.find((b) => b.trim().startsWith("dangerous-tool-use"));
	if (o.refuseServerCheck === true && refused !== undefined) {
		return apiError(
			`Unexpected value(s) \`${refused.trim()}\` for the \`anthropic-beta\` header. Please consult our documentation at docs.claude.com or try again without the header.`,
		);
	}
	const nth = (calls.get(id) ?? 0) + 1;
	calls.set(id, nth);
	if (o.tooLongOn === nth) {
		return apiError("prompt is too long: 250000 tokens > 200000 maximum");
	}
	const api = parseApi(body);
	const msg = verdict(reply(api, o), o);
	const extra = o.respHeaders ?? {};
	if (!api.stream) {
		return Response.json(msg, { headers: extra });
	}
	const text = stream(msg, o.deltas);
	return new Response(
		o.gapMs !== undefined && o.gapMs > 0 ? slowStream(text, o.gapMs) : text,
		{ headers: { "content-type": "text/event-stream", ...extra } },
	);
};

const fallbackRoute = (pathname: string): Response => {
	if (pathname === "/v1/messages/count_tokens") {
		return Response.json({ input_tokens: 10 });
	}
	return new Response("{}", {
		status: 404,
		headers: { "content-type": "application/json" },
	});
};

interface Routed {
	id: string;
	o: StubCase;
	body: unknown;
	isMem: boolean;
}

/** Every route after /v1/messages: the runner API, the memory MCP server, then the fixed fallbacks. */
const routeRest = (
	req: Request,
	url: URL,
	r: Routed,
	calls: Map<string, number>,
): Response => {
	const orch =
		r.o.orchestrator === undefined
			? undefined
			: orchestratorRoute(req, url, r.id, r.o.orchestrator, calls);
	if (orch !== undefined) {
		return orch;
	}
	return r.isMem && r.id !== ""
		? memoryMcp(r.body)
		: fallbackRoute(url.pathname);
};

const logRequest = (
	req: Request,
	url: URL,
	r: Routed,
	seen: ReturnType<typeof inspectHeaders>,
): Promise<void> => {
	const rec: LoggedRequest = {
		id: r.id,
		method: req.method,
		path: url.pathname + url.search,
		authIsFakeKey: seen.auth,
		bad: seen.auth === false || r.id === "",
		headers: seen.headers,
		headerNames: [...req.headers.keys()].toSorted(),
		body: r.body,
	};
	return appendFile(r.o.log, `${JSON.stringify(rec)}\n`);
};

const handle = async (
	req: Request,
	strayLog: string,
	cases: Map<string, StubCase>,
	calls: Map<string, number>,
): Promise<Response> => {
	const url = new URL(req.url);
	// the cloud memory server must sit at the origin root, so its case id is the session id
	const mem = MEMORY_PATH.exec(url.pathname);
	const m = CASE_PATH.exec(url.pathname);
	const key = mem?.[1] ?? m?.[1];
	const id = key !== undefined && cases.has(key) ? key : "";
	if (id !== "" && m?.[2] !== undefined && mem === null) {
		url.pathname = m[2];
	}
	const o = cases.get(id) ?? { log: strayLog };
	const seen = inspectHeaders(req, o);
	const body = parseBody(await req.text());
	const routed = { id, o, body, isMem: mem !== null };
	if (o.log !== "") {
		await logRequest(req, url, routed, seen);
	}
	if (url.pathname === "/v1/messages" && req.method === "POST") {
		return messagesRoute(req, id, o, body, calls);
	}
	return routeRest(req, url, routed, calls);
};

export const startStub = async (
	port: number,
	strayLog = join(
		tmpdir(),
		`cc-release-stub-stray-${process.pid}-${port}.jsonl`,
	),
): Promise<Stub> => {
	await Bun.write(strayLog, "");
	const cases = new Map<string, StubCase>();
	const calls = new Map<string, number>();
	const server = Bun.serve({
		port,
		hostname: "127.0.0.1",
		fetch: (req) => handle(req, strayLog, cases, calls),
	});
	return {
		port: server.port ?? port,
		register: async (id, c) => {
			if (!CASE_ID.test(id) || id.includes("..")) {
				throw new Error(`bad case id: ${id}`);
			}
			await Bun.write(c.log, "");
			cases.set(id, c);
			calls.delete(id);
			return `http://127.0.0.1:${server.port}/${id}`;
		},
		strayLog,
		unregister: (id) => void cases.delete(id),
		stop: async () => {
			void server.stop(true);
			let stray: LoggedRequest[] = [];
			try {
				stray = await readLog(strayLog);
			} catch {
				// already gone
			}
			await rm(strayLog, { force: true });
			return stray;
		},
	};
};

const isLogged = (x: unknown): x is LoggedRequest => {
	const r = asRecord(x);
	return (
		typeof r["id"] === "string" &&
		typeof r["method"] === "string" &&
		typeof r["path"] === "string" &&
		typeof r["bad"] === "boolean"
	);
};

export const readLog = async (log: string): Promise<LoggedRequest[]> => {
	const text = await Bun.file(log).text();
	return text
		.split("\n")
		.filter((l) => l !== "")
		.map((l) => {
			const rec: unknown = JSON.parse(l);
			if (!isLogged(rec)) {
				throw new Error(`not a stub log line: ${l.slice(0, 80)}`);
			}
			return rec;
		});
};
