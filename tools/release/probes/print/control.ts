// Control protocol over stream-json stdin (ported from p305-print/ctl.ts). No user prompt: only control requests.
import type { Data } from "../../lib/results.ts";
import { baseResult, dispose, events, obj, oneCase, runCase } from "./run.ts";
import type { PrintGroup } from "./types.ts";

interface Req {
	subtype: string;
	[k: string]: unknown;
}
type Ev = Record<string, unknown>;

const REQUESTS: Req[] = [
	{ subtype: "set_model", model: "sonnet" },
	{ subtype: "get_binary_version" },
	{ subtype: "set_permission_mode", mode: "nonsense" },
	{ subtype: "set_model", model: "totally-unknown-model" },
	{ subtype: "mcp_status" },
	{ subtype: "interrupt" },
	{ subtype: "bogus_sub" },
	{ subtype: "set_permission_mode", mode: "plan" },
];

const stdinOf = (): string =>
	`${REQUESTS.map((r, i) =>
		JSON.stringify({
			type: "control_request",
			request_id: `req-${i + 1}`,
			request: r,
		}),
	).join("\n")}\n`;

const ARGV = [
	"-p",
	"--input-format",
	"stream-json",
	"--output-format",
	"stream-json",
	"--verbose",
	"--model",
	"claude-opus-5-5",
];

const kindOf = (e: Ev): string => {
	const sub = e["subtype"];
	return `${String(e["type"])}${typeof sub === "string" && sub !== "" ? `/${sub}` : ""}`;
};

const keyOf = (q: Req, i: number): string => {
	const arg = q["mode"] ?? q["model"];
	const shown = typeof arg === "string" && arg !== "" ? `(${arg})` : "";
	return `req${i + 1}.${q.subtype}${shown}`;
};

const outcome = (hit: Ev | undefined): string => {
	if (!hit) {
		return "no response";
	}
	const body = obj(hit["response"]);
	return body["subtype"] === "success"
		? `success {${Object.keys(obj(body["response"])).join(",")}}`
		: `${String(body["subtype"])}: ${String(body["error"]).slice(0, 160)}`;
};

const dataOf = (
	code: number | null,
	ev: Ev[],
	responses: Ev[],
): Record<string, Data> => {
	const data: Record<string, Data> = {
		precondition: code === 0 && responses.length > 0,
		responses: responses.length,
		"event.types": [...new Set(ev.map((e) => kindOf(e)))],
	};
	for (const [i, q] of REQUESTS.entries()) {
		const hit = responses.find(
			(e) => obj(e["response"])["request_id"] === `req-${i + 1}`,
		);
		data[keyOf(q, i)] = outcome(hit);
	}
	return data;
};

export const controlGroup: PrintGroup = {
	id: "control",
	title: "Control protocol requests",
	run: (ctx) =>
		oneCase(ctx, "print.control.requests", async () => {
			const r = await runCase(ctx.bin, {
				noPrompt: true,
				argv: ARGV,
				stdin: stdinOf(),
			});
			try {
				const ev = events(r);
				const responses = ev.filter((e) => e["type"] === "control_response");
				return baseResult(ctx, "print.control.requests", r, {
					data: dataOf(r.code, ev, responses),
					samples: {
						responses: responses.map((e) => JSON.stringify(e)).join("\n"),
					},
					notes: "No user prompt: eight control_request lines on stdin.",
				});
			} finally {
				await dispose(r);
			}
		}),
};
