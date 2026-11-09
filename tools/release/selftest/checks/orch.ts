// Offline checks of the stub's runner API: spawn hints, runner registration, JWT tokens, refused renewals.
import { join } from "node:path";

import { readLog } from "../../lib/stub.ts";
import { asRecord } from "../../lib/stub/replies.ts";
import type { StubEnv } from "./stubs.ts";
import { jsonOf, post } from "./util.ts";

const AUTH = { authorization: "Bearer [REDACTED]" };
const RUNNER = "/v1/code/runners/self-hosted";

const hintCheck = async ({ step, stub, root }: StubEnv) => {
	const log = join(root, "orch.jsonl");
	const url = await stub.register("orch", {
		log,
		orchestrator: {
			secret: "[REDACTED]",
			assignment: "sess-1",
			hints: [{ session_uuid: "s1", attempt: 1 }],
		},
	});
	const poll = async (): Promise<unknown[]> => {
		const r = await post(`${url}${RUNNER}/spawn-hints/poll`, "{}", AUTH);
		const body = await jsonOf(r);
		const hints: unknown = body["hints"];
		const list: unknown[] = Array.isArray(hints) ? hints : [];
		return list;
	};
	const op1 = await poll();
	const op2 = await poll();
	const logged = await readLog(log);
	step(
		"stub: orchestrator returns its hints to the first spawn-hints poll and none to later polls",
		op1.length === 1 &&
			asRecord(op1[0])["session_uuid"] === "s1" &&
			op2.length === 0 &&
			logged.every((r) => !r.bad),
	);
	const workOf = async (path: string) =>
		jsonOf(await post(`${url}${RUNNER}/${path}`, "{}", AUTH));
	const reg = await workOf("runners/register");
	const w1 = await workOf("runners/runner-probe/poll");
	const w2 = await workOf("runners/runner-probe/poll");
	const token = await workOf("sessions/sess-1/token");
	step(
		"stub: orchestrator registers a runner, keeps its session assigned, and issues a session token",
		reg["runner_id"] === "runner-probe" &&
			typeof reg["runner_token"] === "string" &&
			JSON.stringify(w1["assignment_ids"]) === '["sess-1"]' &&
			JSON.stringify(w2["assignment_ids"]) === '["sess-1"]' &&
			token["session_token"] === "probe-session-token",
	);
};

const expOf = (jwt: unknown): number => {
	const payload = typeof jwt === "string" ? (jwt.split(".")[1] ?? "") : "";
	return Number(
		asRecord(JSON.parse(Buffer.from(payload, "base64url").toString()))["exp"],
	);
};

const jwtCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("jwt", {
		log: join(root, "jwt.jsonl"),
		orchestrator: { secret: "[REDACTED]", hints: [], runnerTokenTtlS: 8 },
	});
	const jwtPost = async (path: string) =>
		jsonOf(await post(`${url}${path}`, "{}", AUTH));
	const reg = await jwtPost(`${RUNNER}/runners/register`);
	const next = await jwtPost("/v1/code/auth/refresh");
	step(
		"stub: runnerTokenTtlS issues a JWT runner token that expires in that many seconds, and auth/refresh issues the next one",
		expOf(reg["runner_token"]) - Date.now() / 1000 <= 8 &&
			expOf(reg["runner_token"]) > Date.now() / 1000 &&
			typeof next["token"] === "string" &&
			next["token"] !== reg["runner_token"],
	);
};

const remoteCheck = async ({ step, stub, root }: StubEnv) => {
	const url = await stub.register("rr", {
		log: join(root, "rr.jsonl"),
		orchestrator: { secret: "[REDACTED]", hints: [], refuseRemote: true },
	});
	const remote = async (): Promise<number> => {
		const r = await fetch(`${url}/v1/code/sessions/s1/remote`);
		return r.status;
	};
	const first = await remote();
	const second = await remote();
	const third = await remote();
	step(
		"stub: refuseRemote answers the first two session config fetches and refuses later ones with 400",
		first === 200 && second === 200 && third === 400,
	);
};

export const orchChecks = async (env: StubEnv): Promise<void> => {
	await hintCheck(env);
	await jwtCheck(env);
	await remoteCheck(env);
};
