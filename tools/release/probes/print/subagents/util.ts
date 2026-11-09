// Helpers of the subagent probes: the Agent tool call, agent files, and readers of the subagent's own requests.
import {
	bodyOf,
	json,
	msgs,
	type Run,
	toolNames,
	toolResultTexts,
} from "../run/helpers.ts";

export const MARK = "PROBEMARK Reply with 'OK'.";
export const agentCall = (type: string) => [
	{
		name: "Agent",
		input: {
			description: "d",
			prompt: MARK,
			subagent_type: type,
			run_in_background: false,
		},
	},
];
export const BASE = ["--permission-mode", "bypassPermissions"];
export const agentFile = (name: string, fm: string) => ({
	[`.claude/agents/${name}.md`]: `---\nname: ${name}\ndescription: probe agent\n${fm}\n---\nHello.\n`,
});

/** Requests made by the subagent itself: carry the marker, and the tool list has no Agent tool. */
export const subReqs = (r: Run) =>
	msgs(r).filter(
		(q) =>
			json(bodyOf(q).messages).includes("PROBEMARK") &&
			!toolNames(q).includes("Agent"),
	);
export const firstResult = (r: Run) => toolResultTexts(r)[0] ?? "";
export const cwdInSub = (r: Run) => {
	const first = subReqs(r)[0];
	const t = json(first ? bodyOf(first).messages : "");
	return (/Primary working directory: ([^\\ ]+)/u.exec(t)?.[1] ?? "").replace(
		r.sb.proj,
		"<PROJ>",
	);
};
