// Print-mode cases driven by scripted stub replies: refusals, cut replies, API errors, and media retries.
import type { Case } from "./case.ts";

// The smallest PDF the Read tool accepts as a document: one empty page.
const PDF = [
	"%PDF-1.4",
	"1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj",
	"2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj",
	"3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 72 72]>>endobj",
	"trailer<</Root 1 0 R>>",
	"%%EOF",
	"",
].join("\n");

/** The cases whose stub answers come from `turns`. */
export const REPLY_CASES: Case[] = [
	{
		id: "refusal",
		args: ["--model", "claude-fable-5-2"],
		turns: [
			{
				kind: "message",
				content: [{ type: "text", text: "No." }],
				stop_reason: "refusal",
				stop_details: {
					type: "refusal",
					category: "cyber",
					explanation: "probe",
					cyber_verification: { type: "probe", tier: "probe", reason: "probe" },
				},
			},
		],
	},
	{
		id: "cut-tool",
		turns: [
			{
				kind: "message",
				content: [
					{
						type: "tool_use",
						id: "toolu_cut",
						name: "Bash",
						input: { command: "true" },
					},
				],
				stop_reason: "max_tokens",
				open: true,
			},
		],
	},
	{
		id: "api-error-type",
		turns: [
			{
				kind: "error",
				status: 403,
				body: {
					type: "error",
					error: { type: "permission_error", message: "probe" },
				},
			},
		],
	},
	{
		id: "media-strip",
		projFiles: { "a.pdf": PDF },
		seq: [{ name: "Read", input: { file_path: "{PROJ}/a.pdf" } }],
		turns: [
			null,
			{
				kind: "error",
				status: 400,
				once: true,
				body: {
					type: "error",
					error: {
						type: "invalid_request_error",
						message:
							"messages.3.content.0.tool_result.content.1.document: probe",
					},
				},
			},
		],
	},
];
