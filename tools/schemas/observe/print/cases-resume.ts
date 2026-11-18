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

const message = (role: "user" | "assistant", text: string) =>
	role === "user"
		? { role, content: text }
		: {
				id: "msg_1",
				type: "message",
				role,
				model: "claude-opus-5-5",
				content: [{ type: "text", text }],
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: { input_tokens: 1, output_tokens: 1 },
			};

const carryId = (n: number): string =>
	`00000000-0000-4000-8000-0000000000c${n}`;

// A compacted session whose boundary carries one artifact read. The resume seeds the read versions from the
// boundary (tkt() in chunk-m14bt1pz.js:2281199) once the summary row follows it, and the next compaction writes
// them again (Zpe() in chunk-m14bt1pz.js:2280687).
const carryFile = (): string => {
	const base = {
		isSidechain: false,
		userType: "external",
		cwd: "{PROJ}",
		sessionId: SID,
		version: "2.1.327",
		timestamp: ts,
	};
	return [
		{
			type: "system",
			subtype: "compact_boundary",
			content: "Conversation compacted",
			isMeta: false,
			level: "info",
			compactMetadata: {
				trigger: "manual",
				preTokens: 1000,
				preCompactArtifactReadVersions: [
					{ slug: "aaaaaaaa-1111-4222-8333-444444444444", ver: "v1" },
				],
			},
		},
		{
			type: "user",
			isCompactSummary: true,
			message: message("user", "Summary: the user said hello."),
		},
		{ type: "user", message: message("user", "hello") },
		{ type: "assistant", message: message("assistant", "hi") },
	]
		.map((r, i) =>
			row({
				...base,
				...r,
				uuid: carryId(i),
				parentUuid: i === 0 ? null : carryId(i - 1),
			}),
		)
		.join("");
};

/** Cases that plant a crafted session file and resume it. */
export const RESUME_CASES: Case[] = [
	{
		id: "resume-head-vouch",
		args: ["--resume", SID],
		env: { CLAUDE_CODE_TRANSCRIPT_TAIL_LOAD: "on" },
		cfgFiles: { [`projects/{PROJKEY}/${SID}.jsonl`]: seedFile() },
	},
	{
		// a compaction after a resume that carried an artifact read: compactMetadata.preCompactArtifactReadVersions
		id: "compact-artifact-carry",
		args: ["--resume", SID],
		prompt: "/compact",
		// print mode leaves the artifact surface off unless this is set (V() in chunk-h7hkyak8.js:22676)
		env: { CLAUDE_CODE_ARTIFACT: "1" },
		cfgFiles: { [`projects/{PROJKEY}/${SID}.jsonl`]: carryFile() },
	},
];
