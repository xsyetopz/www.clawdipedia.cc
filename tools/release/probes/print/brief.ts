// --brief and --resume (ported from p305-print br.ts).
import { cp, readdir } from "node:fs/promises";
import { join } from "node:path";

import {
	bodyOf,
	type CaseDef,
	evKinds,
	initEvent,
	json,
	msgs,
	type Run,
	runCases,
	sysText,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const view = (r: Run) => {
	const q = msgs(r)[0];
	return q
		? {
				tools: toolNames(q).join(","),
				talking:
					sysText(q).includes("Talking to the user") ||
					json(bodyOf(q).system).includes("Talking to the user"),
				beta: q.headers["anthropic-beta"] ?? "",
				messages: bodyOf(q).messages?.length ?? 0,
			}
		: null;
};

const brief: CaseDef = {
	name: "brief.compare",
	run: async (ctx) => {
		const a = await withRun(ctx, {}, (r) => ({ v: view(r), ev: evKinds(r) }));
		return withRun(ctx, { args: ["--brief"] }, (r) => {
			const b = view(r);
			return {
				from: r,
				data: {
					precondition: a.v !== null && b !== null,
					exit: r.code,
					baseTools: a.v?.tools ?? null,
					briefTools: b?.tools ?? null,
					sameTools: a.v?.tools === b?.tools,
					baseTalkingToUser: a.v?.talking ?? null,
					briefTalkingToUser: b?.talking ?? null,
					sameBeta: a.v?.beta === b?.beta,
					baseEvents: a.ev,
					briefEvents: evKinds(r),
				},
				notes:
					"Two runs: baseline and --brief; args/exit shown are the --brief run.",
			};
		});
	},
};

const encode = (p: string) => p.replaceAll(/[^A-Za-z0-9]/gu, "-");

const resume: CaseDef = {
	name: "resume.same-session",
	run: (ctx) =>
		withRun(ctx, {}, (first) => {
			const id = initEvent(first)?.["session_id"];
			const sid = typeof id === "string" ? id : "";
			return withRun(
				ctx,
				{
					args: ["--resume", sid],
					setup: async ({ cfg, proj }) => {
						const src = join(first.sb.cfg, "projects");
						const entries = await readdir(src);
						const old = entries[0];
						if (old !== undefined) {
							await cp(join(src, old), join(cfg, "projects", encode(proj)), {
								recursive: true,
							});
						}
					},
				},
				(r) => {
					const q = msgs(r)[0];
					const m = (q ? bodyOf(q).messages : []) ?? [];
					return {
						from: r,
						data: {
							precondition: sid.length > 0 && q !== undefined,
							exit: r.code,
							resumedMessages: m.length,
							earlierPromptCopies:
								json(m).match(/Reply with 'OK'\./gu)?.length ?? 0,
							sameSessionId: initEvent(r)?.["session_id"] === sid,
							resultText: /"result":"([^"]*)"/u.exec(r.stdout)?.[1] ?? "",
						},
						args: ["--resume", "<session-id>"],
						notes:
							"Two runs: the first writes the transcript, the second resumes it from a copy under the new project dir.",
					};
				},
			);
		}),
};

export const briefResume: PrintGroup = {
	id: "briefresume",
	title: "--brief and --resume",
	run: (ctx) => runCases(ctx, "briefresume", [brief, resume]),
};
