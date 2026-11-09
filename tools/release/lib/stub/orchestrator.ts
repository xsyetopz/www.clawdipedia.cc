// The self-hosted runner API of the stub: sessions, runner registration, spawn-hint polls and token refresh.
import { FAKE_KEY } from "../env.ts";
import type { StubOrchestrator } from "./types.ts";

const RUNNER_TOKEN = "probe-runner-token";
const SESSION_TOKEN = "probe-session-token";
const issuedJwts = new Set<string>();
const SESSION_PATH = /^\/v1\/code\/sessions\/([^/]+)\/(.*)$/u;
const RUNNER_BASE = "/v1/code/runners/self-hosted/";

const b64u = (o: unknown): string =>
	Buffer.from(JSON.stringify(o)).toString("base64url");

const mintRunnerJwt = (ttlS: number): string => {
	const jwt = `${b64u({ alg: "none" })}.${b64u({ exp: Math.floor(Date.now() / 1000) + ttlS, jti: crypto.randomUUID() })}.sig`;
	issuedJwts.add(jwt);
	return jwt;
};

/** True for the bearer values the runner API hands out or accepts. */
export const isOrchestratorAuth = (v: string, o: StubOrchestrator): boolean =>
	v === `Bearer ${o.secret}` ||
	v === `Bearer ${RUNNER_TOKEN}` ||
	v === `Bearer ${SESSION_TOKEN}` ||
	issuedJwts.has(v.replace("Bearer ", ""));

/** Counts calls per key, so a route can answer differently on the Nth call. */
type Calls = Map<string, number>;

const bump = (calls: Calls, key: string): number => {
	const nth = (calls.get(key) ?? 0) + 1;
	calls.set(key, nth);
	return nth;
};

const sessionRoute = (
	req: Request,
	url: URL,
	id: string,
	o: StubOrchestrator,
	calls: Calls,
): Response | undefined => {
	const ses = SESSION_PATH.exec(url.pathname);
	const sub = ses?.[2];
	if (sub === undefined) {
		return undefined;
	}
	if (req.method === "GET" && sub === "remote") {
		if (bump(calls, `${id}:remote`) > 2 && o.refuseRemote === true) {
			return Response.json(
				{
					error: {
						type: "invalid_request_error",
						message: "renewal refused",
					},
				},
				{ status: 400 },
			);
		}
		return Response.json({
			api_base_url: `${url.origin}/${id}`,
			inference_auth: { access_token: FAKE_KEY, expires_in_seconds: 10 },
		});
	}
	if (sub === "worker/register") {
		return Response.json({ worker_epoch: 1 });
	}
	return sub.startsWith("worker") ? Response.json({}) : undefined;
};

const sessionTokenRoute = (pathname: string): Response | undefined => {
	if (/\/sessions\/[^/]+\/token$/u.test(pathname)) {
		return Response.json({ session_token: SESSION_TOKEN });
	}
	if (/\/sessions\/[^/]+\/(release|report-failure)$/u.test(pathname)) {
		return Response.json({
			released: true,
			excluded_count: 0,
			stuck: false,
		});
	}
	return undefined;
};

const runnerRoute = (
	pathname: string,
	id: string,
	o: StubOrchestrator,
	calls: Calls,
): Response | undefined => {
	if (pathname === `${RUNNER_BASE}spawn-hints/poll`) {
		return Response.json({
			hints: bump(calls, `${id}:poll`) === 1 ? o.hints : [],
			warm_hints: [],
			pending_count: 0,
			backing_off_count: 0,
			circuit_broken_count: 0,
		});
	}
	if (pathname === `${RUNNER_BASE}spawn-hints/nack`) {
		return Response.json({});
	}
	const ttl = o.runnerTokenTtlS;
	if (ttl !== undefined && pathname === "/v1/code/auth/refresh") {
		return Response.json({ token: mintRunnerJwt(ttl) });
	}
	if (pathname === `${RUNNER_BASE}runners/register`) {
		return Response.json({
			runner_id: "runner-probe",
			runner_token: ttl === undefined ? RUNNER_TOKEN : mintRunnerJwt(ttl),
		});
	}
	if (pathname === `${RUNNER_BASE}runners/runner-probe/poll`) {
		return Response.json({
			assignment_ids:
				o.assignment === undefined || o.assignment === "" ? [] : [o.assignment],
		});
	}
	if (pathname === `${RUNNER_BASE}deregister`) {
		return Response.json({});
	}
	return sessionTokenRoute(pathname);
};

/** The answer for a runner API request, or undefined when the path is not part of it. */
export const orchestratorRoute = (
	req: Request,
	url: URL,
	id: string,
	o: StubOrchestrator,
	calls: Calls,
): Response | undefined =>
	sessionRoute(req, url, id, o, calls) ??
	(req.method === "POST" ? runnerRoute(url.pathname, id, o, calls) : undefined);
