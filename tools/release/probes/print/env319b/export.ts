import { createServer, type Socket } from "node:net";

import { BASE } from "../misc/shared.ts";
import {
	type CaseDef,
	msgs,
	readCfg,
	type Run,
	withRun,
} from "../run/helpers.ts";
import { DBG, GB_ON, lines, uniquePaths } from "./util.ts";

/** A listener that takes a connection and never answers, so a proxy tunnel can never open. */
const hung = async (): Promise<{ port: number; close: () => void }> => {
	const socks = new Set<Socket>();
	const srv = createServer((s) => {
		socks.add(s);
		s.on("error", () => {
			s.destroy();
		});
	});
	await new Promise<void>((resolve) => {
		srv.listen(0, "127.0.0.1", resolve);
	});
	const addr = srv.address();
	return {
		port: typeof addr === "object" && addr !== null ? addr.port : 0,
		close: () => {
			for (const s of socks) {
				s.destroy();
			}
			srv.close();
		},
	};
};

const OTEL_ENV = {
	CLAUDE_CODE_ENABLE_TELEMETRY: "1",
	OTEL_LOGS_EXPORTER: "otlp",
	OTEL_METRICS_EXPORTER: "otlp",
	OTEL_TRACES_EXPORTER: "otlp",
	CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
	OTEL_EXPORTER_OTLP_PROTOCOL: "http/json",
	OTEL_EXPORTER_OTLP_ENDPOINT: "https://otel.example.invalid:4318",
};

const otelOut = async (r: Run, t0: number) => {
	const log = await readCfg(r, "d.log");
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0,
			wallMs: Date.now() - t0,
			timedOutLine: log.includes("in time, so this export was not sent"),
			logsFailed: log.includes("First logs export: FAILED (Could not connect"),
			metricsFailed: log.includes(
				"First metrics export: FAILED (Could not connect",
			),
			tracesFailed: /trace[^\n]*in time, so this export was not sent/iu.test(
				log,
			),
			exit: r.code,
		},
		samples: {
			debug: lines(log, /FAILED|trace.*(fail|time)|flush timed/iu, 8),
		},
	};
};

export const otel = (name: string, env: Record<string, string>): CaseDef => ({
	name: `otel-timeout.${name}`,
	run: async (ctx) => {
		const h = await hung();
		const t0 = Date.now();
		try {
			return await withRun(
				ctx,
				{
					args: [...BASE, ...DBG],
					timeoutMs: 90_000,
					// The sandbox fixes HTTPS_PROXY, so the hung proxy comes in by settings env.
					cfgFiles: {
						"settings.json": JSON.stringify({
							env: { HTTPS_PROXY: `http://127.0.0.1:${h.port}` },
						}),
					},
					env: { ...OTEL_ENV, ...env },
				},
				(r) => otelOut(r, t0),
			);
		} finally {
			h.close();
		}
	},
});

/** CLAUDE_MEMORY_STORES with a session token file, so the team memory sync can start against the stub. */
export const memStore = (
	name: string,
	env: Record<string, string>,
): CaseDef => ({
	name: `memory-push.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, ...DBG],
				homeFiles: { tok: "probe-fake-credential" },
				allowOverride: Object.keys(GB_ON),
				env: {
					...GB_ON,
					_CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1",
					CLAUDE_SESSION_INGRESS_TOKEN_FILE: "{HOME}/tok",
					CLAUDE_MEMORY_STORES: JSON.stringify([
						{ path: "{HOME}/st", mode: "rw" },
					]),
					...env,
				},
			},
			async (r) => ({
				from: r,
				data: {
					precondition: msgs(r).length > 0,
					paths: uniquePaths(r, true),
				},
				samples: {
					debug: lines(await readCfg(r, "d.log"), /memory|policy/iu, 30),
				},
			}),
		),
});

/** The API auth warm (`GET /v1/me`): first-party host plus a remote cowork entrypoint gives it a 120 s lifetime. */
export const authWarm = (
	name: string,
	env: Record<string, string>,
): CaseDef => ({
	name: `auth-warm.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, ...DBG],
				allowOverride: Object.keys(GB_ON),
				env: { ...GB_ON, ...env },
			},
			async (r) => ({
				from: r,
				data: {
					precondition: msgs(r).length > 0,
					paths: uniquePaths(r, true),
				},
				samples: {
					debug: lines(await readCfg(r, "d.log"), /apiAuthWarm/u, 8),
				},
			}),
		),
});

/** An OTLP exporter with a protocol the program does not know: the message names the variables it read. */
export const otlpProtocol = (
	name: string,
	signal: "LOGS" | "METRICS" | "TRACES",
	env: Record<string, string>,
): CaseDef => ({
	name: `otlp-protocol.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, ...DBG],
				env: {
					CLAUDE_CODE_ENABLE_TELEMETRY: "1",
					CLAUDE_CODE_ENHANCED_TELEMETRY_BETA: "1",
					OTEL_LOGS_EXPORTER: "none",
					OTEL_METRICS_EXPORTER: "none",
					OTEL_TRACES_EXPORTER: "none",
					[`OTEL_${signal}_EXPORTER`]: "otlp",
					...env,
				},
			},
			async (r) => ({
				from: r,
				data: { precondition: r.code !== null, exit: r.code },
				samples: {
					debug: lines(await readCfg(r, "d.log"), /Unknown protocol/u, 4),
					stderr: lines(r.stderr, /Unknown protocol/u, 4),
				},
			}),
		),
});
