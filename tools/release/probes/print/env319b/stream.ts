import { BASE } from "../misc/shared.ts";
import {
	type CaseDef,
	initEvent,
	msgs,
	readCfg,
	type Run,
	withRun,
} from "../run/helpers.ts";
import { DBG, lines, USER } from "./util.ts";

export const POLICY = JSON.stringify({
	terminal_tools: ["mcp__probe__reply"],
	ask_text: "Call the reply tool.",
	max_asks_after_person: 1,
	max_asks_after_server_event: 1,
});

export const replyGate = (name: string, value?: string): CaseDef => ({
	name: `reply-gate.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, ...DBG],
				env:
					value === undefined ? {} : { CLAUDE_CODE_REPLY_GATE_POLICY: value },
			},
			async (r) => {
				const log = await readCfg(r, "d.log");
				const caps = initEvent(r)?.["capabilities"];
				return {
					from: r,
					data: {
						precondition: msgs(r).length > 0,
						capabilities: JSON.stringify(caps ?? null),
						accepted: log.includes("CLAUDE_CODE_REPLY_GATE_POLICY accepted"),
						ignored: log.includes("ignoring CLAUDE_CODE_REPLY_GATE_POLICY"),
					},
					samples: { debug: lines(log, /REPLY_GATE_POLICY/u) },
				};
			},
		),
});

export const delta = (name: string, env: Record<string, string>): CaseDef => ({
	name: `plain-delta.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, "--include-partial-messages"],
				text: "OK ".repeat(40),
				env,
			},
			(r) => ({
				from: r,
				data: {
					precondition: msgs(r).length > 0,
					streamEvents: r.stdout
						.split("\n")
						.filter((l) => l.includes('"stream_event"')).length,
					streamBytes: r.stdout.length,
				},
			}),
		),
});

const subs = (v: boolean | null) =>
	JSON.stringify({
		type: "control_request",
		request_id: "r1",
		request: { subtype: "set_has_subscribers", has_subscribers: v },
	});

const holdOut = async (
	r: Run,
	t0: number,
	watched: boolean | null | undefined,
) => {
	const log = await readCfg(r, "d.log");
	const answered = r.stdout
		.split("\n")
		.some(
			(l) =>
				l.includes('"control_response"') &&
				l.includes('"r1"') &&
				l.includes('"success"'),
		);
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0,
			controlAnswered: watched === undefined ? null : answered,
			holdLog: log.includes("STREAM_EVENT_HOLD_MS"),
			noSubscriberCounter: log.includes(
				"print_stream_event_no_subscriber_hold",
			),
			holdCounter: log.includes("print_stream_event_hold"),
			deltaLines: r.stdout
				.split("\n")
				.filter((l) => l.includes('"content_block_delta"')).length,
			wallMs: Date.now() - t0,
		},
		samples: { debug: lines(log, /stream_event|STREAM_EVENT/iu) },
	};
};

/** Stream-json input; the watcher answer goes first. The hold needs MAX_LINE_BYTES, or the program ignores it. */
export const hold = (
	name: string,
	env: Record<string, string>,
	watched?: boolean | null,
	spaced = false,
): CaseDef => ({
	name: `stream-hold.${name}`,
	run: (ctx) => {
		const t0 = Date.now();
		return withRun(
			ctx,
			{
				// A spaced reply: 8 text deltas, 400 ms apart, so a hold has something to join.
				...(spaced ? { gapMs: 400, deltas: 8, text: "abcdefghijklmnop" } : {}),
				noPrompt: true,
				args: [
					...BASE,
					...DBG,
					"--input-format",
					"stream-json",
					"--include-partial-messages",
				],
				stdin: `${watched === undefined ? "" : `${subs(watched)}\n`}${USER}\n`,
				env: { CLAUDE_CODE_STREAM_EVENT_MAX_LINE_BYTES: "100000", ...env },
			},
			(r) => holdOut(r, t0, watched),
		);
	},
});

const trinketOut = async (r: Run) => {
	const log = await readCfg(r, "d.log");
	const bodies = msgs(r).map((q) => JSON.stringify(q.body));
	return {
		from: r,
		data: {
			precondition: msgs(r).length >= 2,
			modelRequests: msgs(r).length,
			reactiveCompactLogged: /Reactive compact/iu.test(log),
			requestsWithMark: bodies.filter((b) => b.includes("TRINKET_MARK")).length,
			markInRequest: bodies.map((b) => b.includes("TRINKET_MARK")).join(","),
			compactRequests: bodies.filter((b) => b.includes("<summary>")).length,
		},
		samples: { debug: lines(log, /compact/iu, 8) },
	};
};

/** Two user turns; the stub answers the second model request with "prompt is too long", so the program runs a reactive compact. */
export const trinket = (name: string, value?: string): CaseDef => ({
	name: `curried-trinket.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				noPrompt: true,
				tooLongOn: 2,
				text: "<summary>S</summary>OK",
				args: [...BASE, ...DBG, "--input-format", "stream-json"],
				stdin: `${USER}\n${USER}\n`,
				env: value === undefined ? {} : { CLAUDE_CODE_CURRIED_TRINKET: value },
			},
			trinketOut,
		),
});
