import { BASE, MARK } from "../misc/shared.ts";
import type { Run } from "../run.ts";
import {
	type CaseDef,
	msgs,
	readCfg,
	type Spec,
	toolResultTexts,
} from "../run/helpers.ts";
import { DBG, jsonl, STREAM_ARGV, sweep } from "./sweep.ts";

const agent = (
	background: boolean,
	type = "general-purpose",
): NonNullable<Spec["stub"]> => ({
	seq: [
		{
			name: "Agent",
			input: {
				description: "d",
				prompt: MARK,
				subagent_type: type,
				run_in_background: background,
			},
		},
	],
});

const USER_OK = {
	type: "user",
	message: { role: "user", content: "Reply with 'OK'." },
};

const summaryData = async (r: Run) => {
	const log = await readCfg(r, "d.log");
	return {
		requests: msgs(r).length,
		timerLines: (log.match(/\[AgentSummary\] Timer fired/gu) ?? []).length,
		offLine: log.includes("No progress summaries"),
		anyLine: log.includes("AgentSummary"),
		trace: log
			.split("\n")
			.filter((l) => /AgentSummary|Bash|sleep|subagent|Agent tool/iu.test(l))
			.slice(0, 40)
			.map((l) => l.slice(0, 150))
			.join("\n"),
	};
};

const handbackData = (r: Run) => {
	const all = msgs(r)
		.map((q) => JSON.stringify(q.body))
		.join("\n");
	return {
		requests: msgs(r).length,
		denied: r.stdout.includes("permission_denied"),
		handbackTool: all.includes("SubagentHandback"),
		handBack: toolResultTexts(r).some((t) =>
			t.includes("[Subagent hand-back]"),
		),
		deliveredLine: all.includes("final report is delivered through"),
		result: (toolResultTexts(r)[0] ?? "").slice(0, 200),
	};
};

const crypticData = (r: Run) => {
	const all = msgs(r).map((q) => JSON.stringify(q.body));
	const withCtx = all.filter((b) => b.includes("classifier_context"));
	const last = withCtx.at(-1) ?? "";
	return {
		requests: msgs(r).length,
		pollReply:
			/"subtype":"(success|error)"[^\n]{0,200}/u.exec(r.stdout)?.[0] ?? "",
		pollInHistory: all.filter((b) => b.includes("build finished")).length,
		withContext: withCtx.length,
		withEvents: withCtx.filter((b) =>
			/classifier_context[\s\S]*"events"/u.test(b),
		).length,
		hist: all
			.map((b) => /.{0,300}build finished.{0,100}/u.exec(b)?.[0] ?? "")
			.filter(Boolean)
			.slice(0, 1)
			.join(""),
		events: /"events":.{0,260}/u.exec(last)?.[0] ?? "",
		sample: /"classifier_context":.{0,400}/u.exec(last)?.[0] ?? "",
	};
};

const POLL = {
	type: "control_request",
	request_id: "p1",
	request: {
		subtype: "poll_event",
		kind: "note",
		event:
			'<event kind="note" at="2026-11-06T12:00:00.000Z">build finished</event>',
		wake: false,
		authority: "peer-agent",
		sender_id: "peer-1",
		sender_text: "build finished",
	},
};

export const summaryCases: CaseDef[] = sweep(
	"agent-summaries",
	"CLAUDE_CODE_DISABLE_AGENT_PROGRESS_SUMMARIES",
	[undefined, "1"],
	{
		noPrompt: true,
		argv: [...STREAM_ARGV, "--model", "claude-opus-5-5", ...BASE, ...DBG],
		stdin: jsonl([
			{
				type: "control_request",
				request_id: "i1",
				request: { subtype: "initialize", agentProgressSummaries: true },
			},
			USER_OK,
		]),
		env: { CLAUDE_CODE_FORK_SUBAGENT: "1" },
		timeoutMs: 240_000,
		stub: {
			seq: [
				{ name: "Agent", input: { description: "d", prompt: MARK } },
				{
					name: "Bash",
					input: { command: 'python3 -c "import time; time.sleep(70)"' },
				},
			],
		},
	},
	summaryData,
	/AgentSummary/u,
);

export const handbackCases: CaseDef[] = sweep(
	"subagent-handback",
	"CLAUDE_CODE_DISABLE_SUBAGENT_HANDBACK",
	[undefined, "1"],
	{
		args: ["--permission-mode", "auto", ...DBG],
		safeguard: "not_flagged",
		timeoutMs: 60_000,
		stub: agent(false),
	},
	handbackData,
);

export const crypticCases: CaseDef[] = sweep(
	"cryptic-horizon-poll",
	"CLAUDE_CODE_CRYPTIC_HORIZON",
	[undefined, "1"],
	{
		noPrompt: true,
		argv: [...STREAM_ARGV, ...BASE, "--permission-mode", "auto", ...DBG],
		stdin: jsonl([POLL, USER_OK]),
		env: { CLAUDE_CODE_POLL_EVENTS: "1", CLAUDE_CODE_REMOTE: "1" },
		safeguard: "not_flagged",
		timeoutMs: 60_000,
		stub: {
			seq: [
				{ name: "Poll", input: {} },
				{ name: "Bash", input: { command: "echo hi" } },
			],
		},
	},
	crypticData,
	/auto_mode_poll_event_listing|poll/iu,
);
