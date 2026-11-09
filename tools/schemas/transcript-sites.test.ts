import { describe, expect, test } from "bun:test";

import { isTranscriptSite } from "./transcript-sites.ts";

const streamKeys = new Set([
	"session_id",
	"compact_metadata",
	"logical_parent_uuid",
	"live_turn_id",
]);

describe("isTranscriptSite", () => {
	test("keeps a message constructor with camelCase keys", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid", "compactMetadata", "logicalParentUuid"],
				streamKeys,
			),
		).toBe(true);
	});

	test("keeps a snake_case key that no stream-json message has", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "source_uuid", "uuid"],
				streamKeys,
			),
		).toBe(true);
	});

	test("drops a stream-json emit site", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid", "compact_metadata", "logical_parent_uuid"],
				streamKeys,
			),
		).toBe(false);
		expect(
			isTranscriptSite("user", ["type", "uuid", "session_id"], streamKeys),
		).toBe(false);
	});

	test("drops the payload of a client event", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid"],
				streamKeys,
				"event:x,payload:",
			),
		).toBe(false);
	});

	test("needs a subtype for system and a uuid or toolUseID for all", () => {
		expect(isTranscriptSite("system", ["type", "uuid"], streamKeys)).toBe(
			false,
		);
		expect(isTranscriptSite("user", ["type", "message"], streamKeys)).toBe(
			false,
		);
	});
});
