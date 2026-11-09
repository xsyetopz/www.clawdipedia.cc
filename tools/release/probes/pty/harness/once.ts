// One launch of one pty case: checks the prompt rules, runs it in a sandbox, turns the run into a CaseResult.
import { PROMPT } from "../../../lib/env.ts";
import { type CaseResult, type Data, normalise } from "../../../lib/results.ts";
import { type Files, makeSandbox, type Sandbox } from "../../../lib/sandbox.ts";
import { baseResult } from "./base.ts";
import { archive, buildRun } from "./collect.ts";
import { launch, type Launched, writeCtl } from "./launch.ts";
import { selected, sentAt } from "./read.ts";
import { HOOK_SH, SL_SH } from "./steps.ts";
import type { PtyCase, PtyCtx, PtyRun } from "./types.ts";

const noReason = (c: PtyCase): boolean =>
	c.promptReason === undefined || c.promptReason === "";

const isStray = (send: string | undefined): boolean =>
	send !== undefined &&
	send.endsWith("\r") &&
	send !== "\r" &&
	!send.startsWith("/") &&
	!send.startsWith("\u001B") &&
	send !== `${PROMPT}\r`;

/** The message of a prompt rule the case breaks, or null. Every typed line that is not a /command or a key must be the standard prompt. */
const promptError = (c: PtyCase, prompt: string): string | null => {
	if (prompt !== PROMPT && noReason(c)) {
		return "prompt needs promptReason";
	}
	const stray = c.schedule.find((st) => isStray(st.send));
	if (stray !== undefined && noReason(c)) {
		return `schedule sends a non-standard prompt (${JSON.stringify(stray.send)}) without promptReason`;
	}
	return null;
};

const dataOf = (c: PtyCase, run: PtyRun): Record<string, Data> => {
	const stepTimeouts = run.pty.sent
		.filter((s) => s.label.endsWith(":timeout"))
		.map((s) => s.label.slice(0, -":timeout".length));
	// Informational only: the step clock starts at READY, so a slow start no longer shifts the steps.
	const readyAt = sentAt(run, "ready");
	const firstRead = run.pty.idx[0]?.t;
	const startLagS =
		readyAt !== null && firstRead !== undefined
			? Math.round((readyAt - firstRead) * 10) / 10
			: null;
	return {
		...c.data(run),
		...(startLagS === null ? {} : { startLagS }),
		stepTimeouts,
		...(stepTimeouts.length > 0
			? {
					precondition: false,
					"precondition.detail": `wait_for timed out: ${stepTimeouts.join(", ")}`,
				}
			: {}),
	};
};

const resultOf = (
	ctx: PtyCtx,
	c: PtyCase,
	prompt: string,
	l: Launched,
	run: PtyRun,
): CaseResult => {
	const samples = c.samples?.(run);
	const data = dataOf(c, run);
	const beta = run.messages[0]?.headers["anthropic-beta"];
	return baseResult(ctx, c, {
		prompt,
		args: normalise(l.args),
		envSet: Object.keys(l.extra),
		// the exit code goes to samples.exitCode (it varies with timing)
		exit: null,
		timedOut: false,
		data: normalise(
			run.reqs.some((r) => r.bad) ? { ...data, badAuth: true } : data,
		),
		samples: normalise({
			...samples,
			exitCode: String(run.pty.exit),
			screenTail: run.pty.screen.split("\n").slice(-40).join("\n"),
		}),
		requests: {
			count: run.reqs.length,
			paths: [...new Set(run.reqs.map((r) => r.path))].toSorted(),
			...(beta === undefined || beta === "" ? {} : { betas: beta.split(",") }),
		},
	});
};

const measure = async (
	ctx: PtyCtx,
	c: PtyCase,
	prompt: string,
	sb: Sandbox,
): Promise<CaseResult> => {
	await writeCtl(sb, c.ctl);
	await c.setup?.(sb);
	const l = await launch(ctx, c, sb);
	const run = await buildRun(sb, l.pty, l.log);
	await archive(ctx, c, run);
	return resultOf(ctx, c, prompt, l, run);
};

const inSandbox = async (
	ctx: PtyCtx,
	c: PtyCase,
	prompt: string,
): Promise<CaseResult> => {
	const files: Files = { ...c.cfgFiles };
	if (c.settings !== undefined) {
		files["settings.json"] = JSON.stringify(c.settings);
	}
	const sb = await makeSandbox({
		cfgFiles: files,
		...(c.projFiles === undefined ? {} : { projFiles: c.projFiles }),
		homeFiles: { "hook.sh": HOOK_SH, "sl.sh": SL_SH, ...c.homeFiles },
		...(c.git === true ? { git: true } : {}),
		trusted: true,
		seedOnboarding: true,
	});
	try {
		return await measure(ctx, c, prompt, sb);
	} finally {
		await sb.cleanup();
	}
};

export const runOnce = async (
	ctx: PtyCtx,
	c: PtyCase,
): Promise<CaseResult[]> => {
	if (!selected(ctx.only, `pty.${c.id}`)) {
		return [];
	}
	if (ctx.dry) {
		return [baseResult(ctx, c, { data: {} })];
	}
	const prompt = c.prompt ?? PROMPT;
	const error = promptError(c, prompt);
	if (error !== null) {
		return [baseResult(ctx, c, { data: { precondition: false, error } })];
	}
	try {
		return [await inSandbox(ctx, c, prompt)];
	} catch (error_) {
		return [
			baseResult(ctx, c, {
				data: {
					precondition: false,
					error: error_ instanceof Error ? error_.message : String(error_),
				},
				notes: "probe invalid: threw before producing data",
			}),
		];
	}
};
