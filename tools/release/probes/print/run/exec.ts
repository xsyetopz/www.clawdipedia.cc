// Case runner shared by print probes: one program run against the local stub, in a temp sandbox, from a built env.
// Port of p305-print/lib.ts runCase (placeholders, bad-auth check) on top of lib/*.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { childEnv, PROMPT } from "../../../lib/env.ts";
import { runChild } from "../../../lib/proc.ts";
import { makeSandbox, type Sandbox, subst } from "../../../lib/sandbox.ts";
import { assertShimReady } from "../../../lib/shim.ts";
import { commitFixture, promptsOf, stubCaseOf } from "./prep.ts";
import { getStub, readRequests } from "./stub.ts";
import type { Case, Run } from "./types.ts";

const argsOf = (
	c: Case,
	prompt: string,
	sb: Sandbox,
	baseUrl: string,
	id: string,
): string[] =>
	(
		c.argv ?? [
			...(c.noPrompt === true ? [] : ["-p", prompt]),
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			c.model ?? "claude-opus-5-5",
			...(c.args ?? []),
		]
	).map((a) =>
		subst(a, sb)
			.split("{BASE}")
			.join(baseUrl)
			.split("{MEMORY_MCP}")
			.join(`${new URL(baseUrl).origin}/v2/ccr-sessions/${id}/memory/mcp`),
	);

const envOf = (
	c: Case,
	sb: Sandbox,
	baseUrl: string,
	extra: Record<string, string>,
): Record<string, string> =>
	childEnv({
		home: sb.home,
		configDir: sb.cfg,
		baseUrl,
		extra,
		...(c.auth === undefined ? {} : { auth: c.auth }),
		...(c.allowOverride === undefined
			? {}
			: { allowOverride: c.allowOverride }),
		...(c.fakeCredentials === undefined
			? {}
			: { fakeCredentials: c.fakeCredentials }),
	});

const exitedWith = async (
	bin: string,
	c: Case,
	sb: Sandbox,
	args: string[],
	childEnvVars: Record<string, string>,
): Promise<{
	res: Awaited<ReturnType<typeof runChild>>;
	after: Record<string, unknown>;
}> => {
	let after: Record<string, unknown> = {};
	const cwd =
		c.cwdSub === undefined || c.cwdSub === ""
			? sb.proj
			: join(sb.proj, c.cwdSub);
	const { afterExit } = c;
	const res = await runChild([bin, ...args], {
		cwd,
		env: childEnvVars,
		...(afterExit === undefined
			? {}
			: {
					beforeReap: async () => {
						after = await afterExit(sb);
					},
				}),
		...(c.stdin === undefined ? {} : { stdin: c.stdin }),
		...(c.stdinOpenMs === undefined ? {} : { stdinOpenMs: c.stdinOpenMs }),
		timeoutMs: c.timeoutMs ?? 60_000,
	});
	return { res, after };
};

let counter = 0;
const runIn = async (
	bin: string,
	c: Case,
	sb: Sandbox,
	prompt: string,
): Promise<Run> => {
	const s = await getStub();
	counter += 1;
	const id = `c${counter}`;
	const log = join(sb.root, "requests.jsonl");
	if (c.commit === true) {
		await commitFixture(sb);
	}
	await c.setup?.(sb);
	const baseUrl = await s.register(id, stubCaseOf(c, sb, log));
	const args = argsOf(c, prompt, sb, baseUrl, id);
	const extra = Object.fromEntries(
		Object.entries(c.env ?? {}).map(([k, v]) => [k, subst(v, sb)]),
	);
	const childEnvVars = envOf(c, sb, baseUrl, extra);
	await assertShimReady(childEnvVars);
	if (c.cwdSub !== undefined && c.cwdSub !== "") {
		await mkdir(join(sb.proj, c.cwdSub), { recursive: true });
	}
	const { res, after } = await exitedWith(bin, c, sb, args, childEnvVars);
	const reqs = await readRequests(log);
	s.unregister(id);
	if (reqs.some((r) => r.bad)) {
		throw new Error("bad auth or stray request");
	}
	return {
		stdout: res.stdout,
		stderr: res.stderr,
		code: res.code,
		timedOut: res.timedOut,
		reqs,
		sb,
		prompt,
		...(c.promptReason !== undefined && c.promptReason !== ""
			? { promptReason: c.promptReason }
			: {}),
		args,
		envSet: Object.keys(extra),
		after,
	};
};

export const runCase = async (bin: string, c: Case): Promise<Run> => {
	const prompt = c.noPrompt === true || c.argv ? "" : (c.prompt ?? PROMPT);
	const sent = promptsOf(c.argv ?? ["-p", prompt, ...(c.args ?? [])], c.stdin);
	if (
		sent.some((p) => p !== PROMPT) &&
		(c.promptReason === undefined || c.promptReason === "")
	) {
		throw new Error("a prompt other than PROMPT needs promptReason");
	}
	const sb = await makeSandbox({
		...(c.cfgFiles ? { cfgFiles: c.cfgFiles } : {}),
		...(c.projFiles ? { projFiles: c.projFiles } : {}),
		...(c.homeFiles ? { homeFiles: c.homeFiles } : {}),
		...(c.git === true || c.commit === true ? { git: true } : {}),
	});
	try {
		return await runIn(bin, c, sb, prompt);
	} catch (error) {
		await sb.cleanup();
		throw error;
	}
};
