import { readdir, realpath, utimes } from "node:fs/promises";

import { pathExists } from "../run.ts";
import {
	type CaseDef,
	json,
	msgs,
	readCfg,
	type Run,
	withRun,
} from "../run/helpers.ts";
import { trim } from "./plugins.ts";

/** A reply gate policy the program accepts (fields from the schema in the program). */
const POLICY = json({
	terminal_tools: ["reply"],
	ask_text: "Reply please.",
	max_asks_after_person: 1,
	max_asks_after_server_event: 1,
});
/** The machine-wide managed file. Only this path (or the root-owned plist) is a vouched tier on macOS in this build. */
const ROOT_FILE =
	"/Library/Application Support/ClaudeCode/managed-settings.json";

const replyOut = async (r: Run, where: "user" | "managed-root") => {
	const d = await readCfg(r, "d.log");
	const lines = d.split("\n").filter((l) => /reply|Reply/u.test(l));
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0 && d.length > 0,
			rootFileHolds: where === "managed-root" && (await pathExists(ROOT_FILE)),
			accepted: d.includes("CLAUDE_CODE_REPLY_GATE_POLICY accepted"),
			ignoredWarning: d.includes("disableReplyCheck is ignored in"),
			gateSkipped: d.includes("Reply gate: verdict=skip why=disableReplyCheck"),
		},
		samples: {
			replyLines: lines
				.slice(0, 6)
				.map((l) => trim(l, 300))
				.join("\n"),
		},
	};
};

export const replyCheck = (where: "user" | "managed-root"): CaseDef => ({
	name: `reply-check.${where}`,
	...(where === "managed-root"
		? {
				requires: {
					path: ROOT_FILE,
					reason: "needs the root-owned managed file (create it with sudo)",
				},
			}
		: {}),
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: { CLAUDE_CODE_REPLY_GATE_POLICY: POLICY },
				cfgFiles:
					where === "user"
						? { "settings.json": json({ disableReplyCheck: true }) }
						: {},
				args: ["--debug-file", "{CFG}/d.log"],
			},
			(r) => replyOut(r, where),
		),
});

/** A run with settings in the user file; records the debug lines that match `re` and the request count. */
export const st = (
	name: string,
	settings: unknown,
	re: RegExp,
	more: {
		env?: Record<string, string>;
		cfgFiles?: Record<string, string>;
	} = {},
): CaseDef => ({
	name,
	run: (ctx) =>
		withRun(
			ctx,
			{
				cfgFiles: { "settings.json": json(settings), ...more.cfgFiles },
				...(more.env === undefined ? {} : { env: more.env }),
				args: ["--debug-file", "{CFG}/d.log"],
			},
			async (r) => {
				const d = await readCfg(r, "d.log");
				return {
					from: r,
					data: { precondition: msgs(r).length > 0 && d.length > 0 },
					samples: {
						lines: d
							.split("\n")
							.filter((l) => re.test(l))
							.slice(0, 8)
							.map((l) => trim(l, 400))
							.join("\n"),
					},
				};
			},
		),
});

const OLD = "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f41";
const NEW = "0b8f3c52-6a1e-4f7e-9d3a-5c2e8a7b1f42";
const TRANSCRIPTS = [
	[OLD, 40],
	[NEW, 0],
] as const;

const transcriptDir = async (sb: {
	cfg: string;
	proj: string;
}): Promise<string> => {
	const real = await realpath(sb.proj);
	return `${sb.cfg}/projects/${real.replaceAll(/[^A-Za-z0-9]/gu, "-")}`;
};

const seedTranscripts = async (sb: {
	cfg: string;
	proj: string;
}): Promise<void> => {
	const dir = await transcriptDir(sb);
	await Promise.all(
		TRANSCRIPTS.map(async ([id, age]) => {
			const f = `${dir}/${id}.jsonl`;
			await Bun.write(
				f,
				'{"type":"user","message":{"role":"user","content":"hi"},"uuid":"u1","sessionId":"x"}\n',
			);
			const t = new Date(Date.now() - age * 86_400_000);
			await utimes(f, t, t);
		}),
	);
};

const sweepOut = async (r: Run) => {
	const files = await readdir(await transcriptDir(r.sb));
	const left = files.filter((f) => /41\.jsonl$|42\.jsonl$/u.test(f));
	const d = await readCfg(r, "d.log");
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0,
			oldKept: left.some((f) => f.endsWith("41.jsonl")),
			newKept: left.some((f) => f.endsWith("42.jsonl")),
		},
		samples: {
			lines: d
				.split("\n")
				.filter((l) => /cleanup|retention|sweep/iu.test(l))
				.slice(0, 8)
				.map((l) => trim(l, 300))
				.join("\n"),
		},
	};
};

/** Two transcripts, one 40 days old and one new; cleanupPeriodDays 7 removes the old one. */
export const sweep = (days?: number): CaseDef => ({
	name: `cleanup.sweep-${days ?? "default"}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				cfgFiles:
					days === undefined
						? {}
						: { "settings.json": json({ cleanupPeriodDays: days }) },
				// The sweep starts 5 s after launch, so a tool call that sleeps keeps the run alive.
				args: ["--debug-file", "{CFG}/d.log", "--allowedTools", "Bash"],
				stub: { seq: [{ name: "Bash", input: { command: "sleep 9" } }] },
				setup: seedTranscripts,
			},
			sweepOut,
		),
});
