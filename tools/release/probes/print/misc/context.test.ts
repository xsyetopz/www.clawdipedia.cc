import { describe, expect, test } from "bun:test";

import { countSubject } from "./context.ts";

describe("countSubject", () => {
	test("labels a body by its tool names and one-line message text", () => {
		const body = {
			tools: [{ name: "Bash" }, { name: "Read" }],
			messages: [
				{
					role: "user",
					content: [{ type: "text", text: "# Memory\n\nhello" }],
				},
				{ role: "assistant", content: "ok" },
			],
		};

		const label = countSubject(body);

		expect(label).toBe("Bash,Read|# Memory hello ok");
	});

	test("gives an empty label for a body that is not an object", () => {
		const label = countSubject(null);

		expect(label).toBe("|");
	});
});
