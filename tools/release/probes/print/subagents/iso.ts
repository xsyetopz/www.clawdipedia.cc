// Subagent frontmatter, isolation and Setup hook probes.

import { pathExists } from "../run.ts";
import {
	bodyOf,
	type CaseDef,
	json,
	msgs,
	readCfg,
	toolNames,
	withRun,
} from "../run/helpers.ts";
import {
	agentCall,
	agentFile,
	BASE,
	cwdInSub,
	firstResult,
	subReqs,
} from "./util.ts";

export const fmCase = (name: string, fm: string): CaseDef => ({
	name: `frontmatter.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: BASE,
				projFiles: agentFile("pa", fm),
				stub: { seq: agentCall("pa") },
			},
			(r) => {
				const sub = subReqs(r);
				return {
					from: r,
					data: {
						precondition: sub.length > 0,
						subRequests: sub.length,
						subTools: sub.map((q) => toolNames(q).join(",")),
						// stable text fragment only, not the whole hand-back
						handBack: firstResult(r).includes("[Subagent hand-back]"),
					},
				};
			},
		),
});

export const isoCase = (iso: "remote" | "worktree" | "none"): CaseDef => ({
	name: `isolation.${iso}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: BASE,
				commit: true,
				projFiles: {
					...agentFile("pa", iso === "none" ? "" : `isolation: ${iso}`),
					"README.md": "x\n",
				},
				stub: { seq: agentCall("pa") },
			},
			(r) => {
				const sub = subReqs(r);
				const cwd = cwdInSub(r);
				return {
					from: r,
					data: {
						precondition: sub.length > 0,
						subRequests: sub.length,
						cwdInSub: cwd.replace(/agent-[0-9a-f]+/u, "agent-<id>"),
						inWorktree: cwd.includes("/.claude/worktrees/"),
						stderrHead: r.stderr.slice(0, 100),
					},
				};
			},
		),
});

export const HOOK = {
	hooks: {
		Setup: [
			{
				hooks: [
					{
						type: "command",
						command: `echo ran >> {CFG}/setup.ran; echo '{"hookSpecificOutput":{"hookEventName":"Setup","additionalContext":"ZZSETUPCTXZZ"}}'`,
					},
				],
			},
		],
	},
};
export const setupCase = (flag: string): CaseDef => ({
	name: `setup-hook.${flag.slice(2)}`,
	run: (ctx) =>
		withRun(
			ctx,
			{ args: [...BASE, flag], cfgFiles: { "settings.json": json(HOOK) } },
			async (r) => ({
				from: r,
				data: {
					precondition: r.code !== null && !r.timedOut,
					hookRan:
						(await pathExists(`${r.sb.cfg}/setup.ran`)) ||
						(await readCfg(r, "setup.ran")) !== "",
					contextInRequest: msgs(r).some((q) =>
						json(bodyOf(q)).includes("ZZSETUPCTXZZ"),
					),
					contextInStdout: r.stdout.includes("ZZSETUPCTXZZ"),
					requests: msgs(r).length,
				},
			}),
		),
});
