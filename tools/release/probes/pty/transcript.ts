import { Tally } from "../../../schemas/observe.ts";
// Transcript fields that only the interactive session writes. Each case reports the JSON types the program wrote
// at its target paths, and keeps the key paths and types of every transcript line as `<case>.fields.json`
// (value-free, the format of the schema audit's --raw files).
import { startConnectorMock } from "../../lib/stub/connector.ts";
import type { StubReply } from "../../lib/stub/types.ts";
import {
	ASK,
	type Data,
	pre,
	type PtyCase,
	type PtyGroup,
	type PtyRun,
	READY,
	WAIT,
} from "./harness.ts";

/** Key paths and JSON types of every transcript line under the sandbox config dir, as `<type>.<key>`, `[]` for items. */
const fieldsOf = (x: PtyRun): Record<string, Record<string, number>> => {
	const t = new Tally();
	const files = x.tree.filter(
		(f) => f.startsWith("cfg/projects/") && f.endsWith(".jsonl"),
	);
	for (const f of files) {
		for (const l of x.cfgFile(f.slice("cfg/".length)).split("\n")) {
			if (l === "") {
				continue;
			}
			const row: unknown = JSON.parse(l);
			const type =
				typeof row === "object" && row !== null && "type" in row
					? String(row.type)
					: "?";
			t.add(type, row);
		}
	}
	return Object.fromEntries(
		Object.entries(t.toJSON()).map(([k, s]) => [k, s.types]),
	);
};

/** The JSON types at each target path ("absent" when the program wrote none). */
const typesAt = (x: PtyRun, paths: string[]): Record<string, Data> => {
	const fields = fieldsOf(x);
	return Object.fromEntries(
		paths.map((p) => [
			p,
			Object.keys(fields[p] ?? {})
				.toSorted()
				.join("|") || "absent",
		]),
	);
};

const transcriptCase = (
	c: Omit<PtyCase, "data" | "artifacts"> & { paths: string[] },
): PtyCase => ({
	...c,
	data: (x) => ({
		...pre(x.messages.length > 0, "the program never reached the stub"),
		...typesAt(x, c.paths),
	}),
	artifacts: (x) => ({
		"fields.json": `${JSON.stringify(fieldsOf(x), null, 2)}\n`,
	}),
});

const WAKE_PROMPT = "PROBE-TICK";
const wake = (id: string, noop: boolean): StubReply => ({
	kind: "message",
	content: [
		{
			type: "tool_use",
			id,
			name: "ScheduleWakeup",
			input: { delaySeconds: 60, reason: "probe", prompt: WAKE_PROMPT, noop },
		},
	],
	stop_reason: "tool_use",
});

/**
 * A dynamic /loop whose tick reports no work. The first prompt arms a wakeup; the wakeup's turn arms the next one
 * with noop true; the second wakeup folds the first tick: system.foldedUuids on the scheduled_task_fire row.
 * A wakeup fires on a minute boundary at least 60 s away, so each tick takes 60 to 120 s.
 */
const loopFold = (): PtyCase =>
	transcriptCase({
		id: "transcript.loop-noop-fold",
		stub: {
			turns: [wake("toolu_wake0", false)],
			rules: [{ match: WAKE_PROMPT, reply: wake("toolu_wake1", true) }],
		},
		schedule: [READY, ASK(), WAIT("no-op tick", "folded", 300)],
		secs: 300,
		notes:
			"ScheduleWakeup arms two dynamic /loop wakeups; the second tick folds the first, which reported noop true.",
		paths: [
			"system.foldedUuids",
			"system.foldedUuids[]",
			"system.noOpStreak",
			"system.streakStartedAt",
		],
	});

const RECALL_SID = "00000000-0000-4000-8000-0000000000d0";
const RECALL_TEXT =
	"Account memory snapshot for the probe: the user prefers short answers and uses Bun for each project.";

const recallId = (i: number): string =>
	`00000000-0000-4000-8000-0000000000d${i + 1}`;

/** A resumable session: a user turn, an account memory recall, and the assistant reply, chained by parentUuid. */
const recallFile = (): string => {
	const base = {
		isSidechain: false,
		userType: "external",
		entrypoint: "cli",
		cwd: "{PROJ}",
		sessionId: RECALL_SID,
		version: "2.1.327",
		timestamp: "2026-11-18T00:00:00.000Z",
	};
	const rows = [
		{ type: "user", message: { role: "user", content: "hello" } },
		{
			type: "attachment",
			attachment: {
				type: "account_memory_recall",
				content: RECALL_TEXT,
				files: [],
			},
		},
		{
			type: "assistant",
			message: {
				id: "msg_recall",
				type: "message",
				role: "assistant",
				model: "claude-opus-5-5",
				content: [{ type: "text", text: "hi" }],
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: { input_tokens: 1, output_tokens: 1 },
			},
		},
	];
	return rows
		.map((r, i) =>
			JSON.stringify({
				...base,
				...r,
				uuid: recallId(i),
				parentUuid: i === 0 ? null : recallId(i - 1),
			}),
		)
		.join("\n")
		.concat("\n");
};

const CUT_PATHS = [
	"api-request.cut",
	"api-request.cut.kind",
	"api-request.cut.cuts",
	"api-request.cut.placeholders",
	"api-request.cut.messages",
	"api-request.cut.messages[]",
	"api-request.cut.markAddresses",
];

const recallBase = {
	cfgFiles: { [`projects/{PROJKEY}/${RECALL_SID}.jsonl`]: recallFile() },
	args: ["--resume", RECALL_SID],
	stub: {
		turns: [
			{
				kind: "message" as const,
				content: [{ type: "text", text: "PROBE-RECALL-OK" }],
				stop_reason: "end_turn",
			},
		],
	},
	schedule: [READY, ASK(), WAIT("PROBE-RECALL-OK", "replied", 60)],
	secs: 90,
	paths: CUT_PATHS,
};

/**
 * A resumed session that holds an account memory recall. The interactive turn registers the cutter (KOt() in
 * chunk-cfxefa64.js:1702425), the snapshot list reads the recall row (chunk-qpav394c.js:78226), and the request
 * journal writes api-request.cut for the request that carries the recall text (chunk-m14bt1pz.js:279863).
 */
const recallCut = (): PtyCase =>
	transcriptCase({
		...recallBase,
		id: "transcript.memory-recall-cut",
		notes:
			"Resumes a session with an account_memory_recall row, then asks one prompt.",
	});

// A made-up OAuth-shaped login file with the connector scope. The program reads it only when no API key is set.
const CREDENTIALS = JSON.stringify({
	claudeAiOauth: {
		accessToken: "fake-access",
		refreshToken: "fake-refresh",
		expiresAt: 4_102_444_800_000,
		scopes: ["user:inference", "user:profile", "user:mcp_servers"],
		subscriptionType: "max",
	},
});

/**
 * The recall cut, plus a claude.ai connector whose address the service marks as reportable. The tool-provenance
 * beta lends that address to the connector's tool (QS() in chunk-qpav394c.js:464383), and the journal counts the
 * marked tool as cut.markAddresses ($5s() in chunk-qpav394c.js:465998).
 */
const recallCutAddress = (): PtyCase =>
	transcriptCase({
		...recallBase,
		id: "transcript.memory-recall-cut-address",
		auth: "none",
		cfgFiles: { ...recallBase.cfgFiles, ".credentials.json": CREDENTIALS },
		env: { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" },
		mock: startConnectorMock,
		notes:
			"Resumes a session with an account_memory_recall row under a made-up login, with a mock claude.ai connector list. badAuth is expected: the stub sees the made-up OAuth bearer, not the fake key.",
	});

/** PTY cases that sample transcript fields only the interactive session writes, such as `system.foldedUuids`. */
export const transcriptGroup: PtyGroup = {
	id: "transcript",
	title: "transcript fields that only the interactive session writes",
	cases: () => [loopFold(), recallCut(), recallCutAddress()],
};
