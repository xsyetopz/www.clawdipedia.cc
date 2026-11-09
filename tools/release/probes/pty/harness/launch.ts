// Starts one pty run: registers the case on the shared stub, builds the child env and args, and runs the program.
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

import { childEnv } from "../../../lib/env.ts";
import {
	type PtyResult,
	type PtyStep,
	runPty,
} from "../../../lib/pty/driver.ts";
import type { Sandbox } from "../../../lib/sandbox.ts";
import type { Stub } from "../../../lib/stub.ts";
import { eachInOrder } from "../../print/run/seq.ts";
import { deepSubst, getStub, subst } from "./base.ts";
import type { PtyCase, PtyCtx } from "./types.ts";

let counter = 0;

export const writeCtl = async (
	sb: Sandbox,
	ctl: PtyCase["ctl"],
): Promise<void> => {
	const d = join(sb.home, "hooklog", "ctl");
	await eachInOrder(Object.entries(ctl ?? {}), async ([ev, v]) => {
		if (v.out !== undefined) {
			await Bun.write(join(d, ev), v.out);
		}
		if (v.exit !== undefined) {
			await Bun.write(join(d, `${ev}.exit`), String(v.exit));
		}
	});
};

const subStep = (st: PtyStep, sb: Sandbox): PtyStep => {
	const text = {
		...(st.send === undefined ? {} : { send: subst(st.send, sb) }),
		...(st.label === undefined ? {} : { label: subst(st.label, sb) }),
	};
	return st.wait_for === undefined
		? { ...st, ...text }
		: { ...st, ...text, wait_for: subst(st.wait_for, sb) };
};

export interface Launched {
	pty: PtyResult;
	args: string[];
	extra: Record<string, string>;
	log: string;
}

const register = (
	stub: Stub,
	caseKey: string,
	c: PtyCase,
	sb: Sandbox,
	log: string,
): Promise<string> =>
	stub.register(caseKey, {
		log,
		...c.stub,
		...(c.stub?.toolInput === undefined
			? {}
			: { toolInput: deepSubst(c.stub.toolInput, sb) }),
		...(c.stub?.seq === undefined
			? {}
			: {
					seq: c.stub.seq.map((e) => ({
						...e,
						input: deepSubst(e.input, sb),
					})),
				}),
	});

const argsOf = (c: PtyCase, sb: Sandbox): string[] => [
	"--permission-mode",
	c.mode ?? "default",
	"--model",
	c.model ?? "claude-opus-5-5",
	...(c.args ?? []).map((a) => subst(a, sb)),
];

export const launch = async (
	ctx: PtyCtx,
	c: PtyCase,
	sb: Sandbox,
): Promise<Launched> => {
	const stub = await getStub();
	const log = join(sb.root, "requests.jsonl");
	const caseKey = `p${++counter}`;
	const base = await register(stub, caseKey, c, sb, log);
	const extra = Object.fromEntries(
		Object.entries(c.env ?? {}).map(([k, v]) => [k, subst(v, sb)]),
	);
	const env = childEnv({
		home: sb.home,
		configDir: sb.cfg,
		baseUrl: base,
		extra,
		tty: true,
		...(c.allowOverride === undefined
			? {}
			: { allowOverride: c.allowOverride }),
		...(c.auth === undefined ? {} : { auth: c.auth }),
	});
	const args = argsOf(c, sb);
	await mkdir(join(sb.root, "pty"), { recursive: true });
	const pty = await runPty({
		cwd: sb.proj,
		env,
		bin: ctx.bin,
		args,
		// end with /exit so the program writes its exit-time files; Ctrl-C twice if it is still up
		schedule: [
			...c.schedule,
			{ t: c.secs, send: "/exit\r", label: "exit" },
			{ t: c.secs + 2.5, send: "\u0003", label: "ctrl-c-1" },
			{ t: c.secs + 2.8, send: "\u0003", label: "ctrl-c-2" },
		].map((st) => subStep(st, sb)),
		secs: c.secs + 5,
		...(c.rows === undefined ? {} : { rows: c.rows }),
		...(c.cols === undefined ? {} : { cols: c.cols }),
		out: join(sb.root, "pty", "RAW"),
	});
	stub.unregister(caseKey);
	return { pty, args, extra, log };
};
