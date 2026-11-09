// Subagent probes (ported from p305-print sub.ts, sub2.ts, sub3.ts, setup.ts).
// The stub issues one Agent tool_use, so the CLI prompt stays the standard one; the subagent prompt is a marker.
import {
	bodyOf,
	type CaseDef,
	json,
	msgs,
	runCases,
	sysText,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import { fmCase, isoCase, setupCase } from "./subagents/iso.ts";
import {
	agentCall,
	agentFile,
	BASE,
	firstResult,
	subReqs,
} from "./subagents/util.ts";
import type { PrintGroup } from "./types.ts";

const TYPES = [
	"claude",
	"Explore",
	"general-purpose",
	"Plan",
	"statusline-setup",
	"fork",
	"claude-code-guide",
	"comment-thread-analyst",
	"observer",
	"workflow-subagent",
];

const typeCase = (t: string): CaseDef => ({
	name: `type.${t}`,
	run: (ctx) =>
		withRun(ctx, { args: BASE, stub: { seq: agentCall(t) } }, (r) => {
			const res = firstResult(r);
			return {
				from: r,
				data: {
					precondition: msgs(r).length >= 2,
					messages: msgs(r).length,
					handBack: res.includes("[Subagent hand-back]"),
					forkStarted: res.includes("Fork started"),
					notFound: res.includes("not found. Available agents:"),
					available: /Available agents: ([^"\\]*)/u.exec(res)?.[1] ?? "",
				},
			};
		}),
});

const webFetch: CaseDef = {
	name: "web-fetch",
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: BASE,
				env: { CLAUDE_CODE_WEB_FETCH_AGENT: "1" },
				stub: { seq: agentCall("web-fetch") },
			},
			async (r) => {
				const ms = msgs(r);
				const main = ms[0];
				const sub = ms.filter(
					(q) =>
						json(bodyOf(q).messages).includes("PROBEMARK") &&
						toolNames(q).length < 5,
				);
				const base = await withRun(ctx, { args: BASE }, (b) => {
					const m = msgs(b)[0];
					return {
						mainHasWebFetch: m ? toolNames(m).includes("WebFetch") : null,
						rosterMentions: m ? json(bodyOf(m)).includes("web-fetch") : null,
					};
				});
				return {
					from: r,
					data: {
						precondition: Boolean(main),
						mainHasWebFetch: main ? toolNames(main).includes("WebFetch") : null,
						rosterHasWebFetch: main
							? json(bodyOf(main)).includes("web-fetch")
							: null,
						subTools: sub.map((q) => toolNames(q).join(",")),
						baselineMainHasWebFetch: base.mainHasWebFetch,
						baselineRosterMentions: base.rosterMentions,
					},
				};
			},
		),
};

const appendCase = (
	name: string,
	args: string[],
	env: Record<string, string>,
): CaseDef => ({
	name: `append-subagent-prompt.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE, ...args],
				env,
				stub: { seq: agentCall("general-purpose") },
			},
			(r) => {
				const sub = subReqs(r);
				const main = msgs(r)[0];
				return {
					from: r,
					data: {
						precondition: sub.length > 0 && Boolean(main),
						subRequests: sub.length,
						markerInSubSystem: sub.some((q) =>
							sysText(q).includes("ZZAPPENDZZ"),
						),
						markerInMainSystem: main
							? sysText(main).includes("ZZAPPENDZZ")
							: null,
						subTools: sub.map((q) => toolNames(q).join(",")),
					},
				};
			},
		),
});

const observerCase = (on: boolean): CaseDef => ({
	name: `observer.${on ? "on" : "off"}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: BASE,
				env: on ? { CLAUDE_CODE_EXPERIMENTAL_OBSERVER_AGENTS: "1" } : {},
				projFiles: {
					...agentFile("pa", "observer: obs\nobserverMessage: ZZOBSMSGZZ"),
					...agentFile("obs", ""),
				},
				stub: { seq: agentCall("pa") },
			},
			(r) => {
				const ms = msgs(r);
				return {
					from: r,
					data: {
						precondition: ms.length >= 2,
						messages: ms.length,
						observerReportToolIn: ms.filter((q) =>
							toolNames(q).includes("ObserverReport"),
						).length,
						observerMessageIn: ms.filter((q) =>
							json(bodyOf(q).messages).includes("ZZOBSMSGZZ"),
						).length,
					},
				};
			},
		),
});

export const subagents: PrintGroup = {
	id: "subagents",
	title:
		"Subagents (types, web-fetch, append prompt, observer, frontmatter, isolation, Setup hook)",
	run: (ctx) =>
		runCases(ctx, "subagents", [
			...TYPES.map((t) => typeCase(t)),
			webFetch,
			appendCase("flag", ["--append-subagent-system-prompt", "ZZAPPENDZZ"], {}),
			appendCase("env-append-subagent-system-prompt", [], {
				CLAUDE_CODE_APPEND_SUBAGENT_SYSTEM_PROMPT: "ZZAPPENDZZ",
			}),
			appendCase("env-enable-append-subagent-prompt", [], {
				CLAUDE_CODE_ENABLE_APPEND_SUBAGENT_PROMPT: "ZZAPPENDZZ",
			}),
			observerCase(false),
			observerCase(true),
			fmCase(
				"capital-tools-hyphen-disallowed",
				"Tools: Read\ndisallowed-tools: Bash",
			),
			fmCase(
				"camel-disallowedTools",
				"tools: Read, Bash\ndisallowedTools: Bash",
			),
			isoCase("remote"),
			isoCase("worktree"),
			isoCase("none"),
			...["--init", "--init-only", "--maintenance"].map((f) => setupCase(f)),
		]),
};
