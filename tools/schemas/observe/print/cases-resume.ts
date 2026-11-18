// Print-mode cases that plant a crafted session file and resume it.
import type { Case } from "./case.ts";

const SID = "11111111-1111-4111-8111-111111111111";
const PAD = "x".repeat(60_000);
const ts = "2026-01-01T00:00:00.000Z";
const row = (o: object): string => `${JSON.stringify(o)}\n`;

// Non-message rows (queue-operation: type class "ignored") ahead of the boundary supply the 4 MiB of gain.
const padRows = (bytes: number): string => {
	let out = "";
	while (out.length < bytes) {
		out += row({
			type: "queue-operation",
			operation: "enqueue",
			timestamp: ts,
			sessionId: SID,
			content: PAD,
		});
	}
	return out;
};

const seedFile = (): string => {
	const cwd = "{PROJ}";
	const base = {
		isSidechain: false,
		userType: "external",
		cwd,
		sessionId: SID,
		version: "2.1.327",
		timestamp: ts,
	};
	return (
		padRows(4_400_000) +
		row({
			...base,
			type: "system",
			subtype: "compact_boundary",
			content: "Conversation compacted",
			isMeta: false,
			level: "info",
			uuid: "00000000-0000-4000-8000-0000000000b0",
			parentUuid: null,
			compactMetadata: { trigger: "manual", preTokens: 1000 },
		}) +
		row({
			...base,
			type: "user",
			uuid: "00000000-0000-4000-8000-0000000000b1",
			parentUuid: "00000000-0000-4000-8000-0000000000b0",
			message: { role: "user", content: "hello" },
		}) +
		row({
			...base,
			type: "assistant",
			uuid: "00000000-0000-4000-8000-0000000000b2",
			parentUuid: "00000000-0000-4000-8000-0000000000b1",
			message: {
				id: "msg_1",
				type: "message",
				role: "assistant",
				model: "claude-opus-5-5",
				content: [{ type: "text", text: "hi" }],
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: { input_tokens: 1, output_tokens: 1 },
			},
		}) +
		padRows(1_000_000)
	);
};

/** Cases that plant a crafted session file and resume it. */
export const RESUME_CASES: Case[] = [
	{
		id: "resume-head-vouch",
		args: ["--resume", SID],
		env: { CLAUDE_CODE_TRANSCRIPT_TAIL_LOAD: "on" },
		cfgFiles: { [`projects/{PROJKEY}/${SID}.jsonl`]: seedFile() },
	},
];
