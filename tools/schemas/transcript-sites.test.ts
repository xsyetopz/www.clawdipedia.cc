import { describe, expect, test } from "bun:test";

import { isTranscriptSite, isUnpersisted } from "./transcript-sites.ts";

const streamKeys = new Set([
	"session_id",
	"compact_metadata",
	"logical_parent_uuid",
	"live_turn_id"
]);

/** The entries of an `attachment` row literal whose `attachment.type` is `kind`. */
const attachmentRow = (kind: string) => [
	{ key: "uuid", opt: false, val: { k: "unk" as const, text: "u" } },
	{
		key: "attachment",
		opt: false,
		val: {
			k: "obj" as const,
			e: [{ key: "type", opt: false, val: { k: "str" as const, v: kind } }]
		}
	}
];

describe("isTranscriptSite", () => {
	test("keeps a message constructor with camelCase keys", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid", "compactMetadata", "logicalParentUuid"],
				streamKeys
			)
		).toBe(true);
	});

	test("keeps a snake_case key that no stream-json message has", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "source_uuid", "uuid"],
				streamKeys
			)
		).toBe(true);
	});

	test("drops a stream-json emit site", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid", "compact_metadata", "logical_parent_uuid"],
				streamKeys
			)
		).toBe(false);
		expect(
			isTranscriptSite("user", ["type", "uuid", "session_id"], streamKeys)
		).toBe(false);
	});

	test("drops the payload of a client event", () => {
		expect(
			isTranscriptSite(
				"system",
				["type", "subtype", "uuid"],
				streamKeys,
				"event:x,payload:"
			)
		).toBe(false);
	});

	test("needs a subtype for system and a uuid or toolUseID for all", () => {
		expect(isTranscriptSite("system", ["type", "uuid"], streamKeys)).toBe(
			false
		);
		expect(isTranscriptSite("user", ["type", "message"], streamKeys)).toBe(
			false
		);
	});
});

describe("isUnpersisted", () => {
	test("is true for a literal with persist: false", () => {
		// Arrange
		const entries = [
			{ key: "subtype", opt: false, val: { k: "str" as const, v: "placed" } },
			{ key: "persist", opt: false, val: { k: "bool" as const, v: false } }
		];

		// Act
		const out = isUnpersisted("system", entries);

		// Assert
		expect(out).toBe(true);
	});

	test("is false for persist: true, an optional persist, or no persist", () => {
		// Arrange
		const yes = {
			key: "persist",
			opt: false,
			val: { k: "bool" as const, v: true }
		};
		const opt = {
			key: "persist",
			opt: true,
			val: { k: "bool" as const, v: false }
		};

		// Act
		const out = [
			isUnpersisted("system", [yes]),
			isUnpersisted("system", [opt]),
			isUnpersisted("system", [])
		];

		// Assert
		expect(out).toEqual([false, false, false]);
	});

	test("is true for every progress literal", () => {
		// Arrange
		const entries = [
			{ key: "toolUseID", opt: false, val: { k: "str" as const, v: "t" } }
		];

		// Act
		const out = isUnpersisted("progress", entries);

		// Assert
		expect(out).toBe(true);
	});

	test("is true for an attachment row that only the display builds", () => {
		// Arrange
		const kinds = [
			"async_hook_response_batch",
			"teammate_shutdown_batch",
			"async_hook_response"
		];

		// Act
		const out = kinds.map((kind) =>
			isUnpersisted("attachment", attachmentRow(kind))
		);

		// Assert
		expect(out).toEqual([true, true, false]);
	});
});
