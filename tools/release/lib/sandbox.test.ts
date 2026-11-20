import { expect, test } from "bun:test";

import { makeSandbox, projKey } from "./sandbox.ts";

test("projKey turns each character that is not a letter or a digit into a dash", () => {
	// Arrange
	const proj = "/private/var/a_b.c";

	// Act
	const key = projKey(proj);

	// Assert
	expect(key).toBe("-private-var-a-b-c");
});

test("a {PROJKEY} fixture key lands in the transcript dir of the project", async () => {
	// Arrange
	const sb = await makeSandbox({
		cfgFiles: { "projects/{PROJKEY}/s.jsonl": "{PROJ}\n" }
	});

	// Act
	const text = await Bun.file(
		`${sb.cfg}/projects/${projKey(sb.proj)}/s.jsonl`
	).text();
	await sb.cleanup();

	// Assert
	expect(text).toBe(`${sb.proj}\n`);
});
