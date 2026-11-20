import { expect, test } from "bun:test";

import { scanFields } from "../src/fields.ts";
import type { Line } from "../src/sessions.ts";

const line = (n: number, json: NonNullable<Line["json"]>): Line => ({
	n,
	text: JSON.stringify(json),
	json
});

const lines: Line[] = [
	line(1, {
		type: "system",
		foldedUuids: ["a", "b"],
		noOpStreak: 2,
		meta: { ratio: 0.5, gone: null }
	}),
	line(2, { type: "system", noOpStreak: 1 }),
	line(3, { message: { content: [{ type: "text" }] } }),
	{ n: 4, text: "not json" }
];

test("records JSON types at each key path, rooted at the line type", () => {
	// Arrange: the lines above
	// Act
	const r = scanFields(lines);
	// Assert
	expect(r).toEqual({
		"system.type": { string: 2 },
		"system.foldedUuids": { array: 1 },
		"system.foldedUuids[]": { string: 2 },
		"system.noOpStreak": { integer: 2 },
		"system.meta": { object: 1 },
		"system.meta.ratio": { number: 1 },
		"system.meta.gone": { null: 1 },
		"?.message": { object: 1 },
		"?.message.content": { array: 1 },
		"?.message.content[]": { object: 1 },
		"?.message.content[].type": { string: 1 }
	});
});

test("a match keeps only the paths it accepts, and counts add up across calls", () => {
	// Arrange
	const into = scanFields(lines, /^system\.noOpStreak$/u);
	// Act
	const r = scanFields(lines, /^system\.noOpStreak$/u, into);
	// Assert
	expect(r).toEqual({ "system.noOpStreak": { integer: 4 } });
});

test("keeps no value, only paths and type names", () => {
	// Arrange
	const secret = "sk-ant-never-shown";
	// Act
	const r = scanFields([line(1, { type: "user", token: secret })]);
	// Assert
	expect(JSON.stringify(r)).not.toContain(secret);
});
