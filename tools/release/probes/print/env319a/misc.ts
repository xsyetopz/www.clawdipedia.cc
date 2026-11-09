import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";

import { type CaseDef, msgs, withRun } from "../run/helpers.ts";

export const UUID = "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f40";
export const CHILD = {
	CLAUDE_CODE_CHILD_SESSION: "1",
	CLAUDE_CODE_REMOTE_SESSION_ID: UUID,
};

const label = (v?: string): string => (v === undefined ? "unset" : `v${v}`);

// A holder keeps the config lock fresh for 25 s, then releases it. Without a wait the program gives up after its six retries (10 to 20 s).
const HOLD_S = 25;
export const lockWait = (v?: string): CaseDef => ({
	name: `config-lock-wait.${label(v)}`,
	run: (ctx) => {
		let holder: ReturnType<typeof Bun.spawn> | undefined;
		const t0 = Date.now();
		return withRun(
			ctx,
			{
				argv: ["mcp", "add", "probe-srv", "--", "echo", "hi"],
				noPrompt: true,
				timeoutMs: 90_000,
				env: v === undefined ? {} : { CLAUDE_CODE_CONFIG_LOCK_WAIT_MS: v },
				setup: async ({ cfg }) => {
					const lock = `${cfg}/.claude.json.lock`;
					await mkdir(lock);
					holder = Bun.spawn([
						"sh",
						"-c",
						`i=0; while [ $i -lt ${HOLD_S} ]; do touch "${lock}"; sleep 1; i=$((i+1)); done; rmdir "${lock}"`,
					]);
				},
				afterExit: () => {
					holder?.kill();
					return {};
				},
			},
			(r) => ({
				from: r,
				data: {
					precondition: r.code !== null && !r.timedOut,
					exit: r.code,
					seconds: Math.round((Date.now() - t0) / 5000) * 5,
					namesVariable: (r.stdout + r.stderr).includes(
						"CLAUDE_CODE_CONFIG_LOCK_WAIT_MS",
					),
				},
				samples: { out: (r.stdout + r.stderr).slice(0, 300) },
			}),
		);
	},
});

// CLAUDE_CODE_REMOTE=1 makes the program treat the session as a cloud session (chunk-qzv5gd5j.js@813).
export const replyHold = (v?: string): CaseDef => ({
	name: `main-reply-hold.${label(v)}`,
	run: (ctx) => {
		const t0 = Date.now();
		return withRun(
			ctx,
			{
				env: {
					CLAUDE_CODE_REMOTE: "1",
					...(v === undefined ? {} : { CLAUDE_CODE_MAIN_REPLY_HOLD_MS: v }),
				},
			},
			(r) => ({
				from: r,
				data: {
					precondition: r.code === 0,
					seconds: Math.round((Date.now() - t0) / 1000),
					requests: msgs(r).length,
				},
			}),
		);
	},
});

// The program derives the child session id as a UUID v5 of the remote id (namespace 3ab19d7e-9f35-45c2-926e-75e271cc60b3).
export const derived = (id: string): string => {
	const h = createHash("sha1")
		.update(
			Buffer.from(
				"3ab19d7e-9f35-45c2-926e-75e271cc60b3".replaceAll("-", ""),
				"hex",
			),
		)
		.update(id)
		.digest();
	h.writeUInt8((h.readUInt8(6) & 15) | 80, 6);
	h.writeUInt8((h.readUInt8(8) & 63) | 128, 8);
	const x = h.subarray(0, 16).toString("hex");
	return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
};
