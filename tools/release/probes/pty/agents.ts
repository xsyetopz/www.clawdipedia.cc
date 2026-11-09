import { show } from "../print/run/helpers.ts";
// Subagent type probes in the interactive screen (ported from p305-pty guide/agent runs; PROGRESS.md "agent types").
// The stub sends one Agent tool_use; the data comes from the subagent's own request and the tool result the model gets back.
import {
	arr,
	ASK,
	type Data,
	obj,
	pre,
	PROMPT,
	type PtyCase,
	type PtyGroup,
	type PtyRun,
	READY,
	sha8,
	toolNames,
	toolResultText,
} from "./harness.ts";

interface Input {
	description: string;
	prompt: string;
	subagent_type?: string;
}

export const agentCase = (
	id: string,
	input: Input,
	note: string,
	extra?: Partial<PtyCase>,
): PtyCase => ({
	id,
	stub: { seq: [{ name: "Agent", input }] },
	schedule: [READY, ASK()],
	secs: 16,
	facts: ["agents.types"],
	notes: note,
	data: (x) => agentData(x),
	...extra,
});

/** The requests the subagent made (the billing header carries cc_is_subagent=true). */
export const subRequests = (x: PtyRun) =>
	x.messages.filter((q) =>
		JSON.stringify(q.body).includes("cc_is_subagent=true"),
	);

/** System text of the first subagent request without the billing-header block (it holds a build hash). */
export const subSystem = (x: PtyRun): string => {
	const q = subRequests(x)[0];
	if (!q) {
		return "";
	}
	const sys = obj(q.body)["system"];
	return arr(sys)
		.map((b) => show(obj(b)["text"] ?? ""))
		.filter((t) => !t.startsWith("x-anthropic-billing-header"))
		.join("\n");
};

/** The agent kind a subagent's system text states about itself ("You are ..."), cut at the first full stop. */
const typeFromSystem = (sys: string): string =>
	(/You are ([^.\n]{3,100})/u.exec(sys)?.[1] ?? "").trim();

const agentData = (x: PtyRun): Record<string, Data> => {
	const sub = subRequests(x);
	const sys = subSystem(x);
	const result = toolResultText(x);
	const first = sub[0];
	const msgs = first ? arr(obj(first.body)["messages"]) : [];
	// a fork starts from the parent's conversation, so its first request holds the parent's Agent tool_use turn
	const carriesParent = JSON.stringify(msgs).includes('"name":"Agent"');
	return {
		...pre(x.messages.length > 0, "no model request reached the stub"),
		subagentRequests: sub.length,
		systemChars: sys.length,
		systemSha8: sys ? sha8(sys) : "",
		subagentFirstRequestMessages: msgs.length,
		subagentCarriesParentMessages: carriesParent,
		subagentTypeFromSystem: typeFromSystem(sys),
		subagentTools: sub[0] ? toolNames(sub[0]).length : 0,
		toolResultHead: result.trim().slice(0, 200),
		backgrounded: /Backgrounded agent/iu.test(result),
		asyncLaunched: /Async agent launched/iu.test(result),
		toolResultMentionsType: result.includes("no-such-agent-type"),
	};
};

const agents: PtyCase[] = [
	agentCase(
		"agents.general-purpose",
		{
			description: "Probe task",
			prompt: PROMPT,
			subagent_type: "general-purpose",
		},
		"Built-in general-purpose subagent. The Agent input prompt is the standard prompt.",
	),
	agentCase(
		"agents.unknown-type",
		{
			description: "Probe task",
			prompt: PROMPT,
			subagent_type: "no-such-agent-type",
		},
		"An unknown subagent_type: the tool result should be an error naming the type.",
	),
	agentCase(
		"agents.fork",
		{ description: "Probe task", prompt: PROMPT },
		"No subagent_type: either a fork of the main agent or the default type.",
	),
];

export const agentsGroup: PtyGroup = {
	id: "agents",
	title: "Agent tool: built-in, unknown, and forked subagents",
	cases: () => agents,
};
