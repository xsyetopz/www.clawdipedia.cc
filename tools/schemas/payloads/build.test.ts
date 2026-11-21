import { expect, test } from "bun:test";

import { tools } from "./build.ts";

const schema = (description: string) => ({
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	properties: { message: { type: "string", description } }
});

test("tools keeps one definition when the program builds a tool twice with the same schemas", () => {
	const t = { name: "SubagentHandback", inputSchema: schema("report") };
	const { body } = tools({ tools: [t, { ...t }] });
	const defs = body["$defs"];
	expect(defs).toBeObject();
	expect(Object.keys(defs ?? {})).toEqual(["SubagentHandbackInput"]);
});

test("tools refuses one tool name built with different schemas", () => {
	expect(() =>
		tools({
			tools: [
				{ name: "SubagentHandback", inputSchema: schema("a") },
				{ name: "SubagentHandback", inputSchema: schema("b") }
			]
		})
	).toThrow('tool "SubagentHandback" is built twice with different schemas');
});
