import { expect, test } from "bun:test";

import { runChild } from "./proc.ts";

const env = { PATH: process.env["PATH"] ?? "/usr/bin:/bin" };

test("stdin ends at once without stdinOpenMs", async () => {
	const t = Date.now();
	const r = await runChild(["cat"], { cwd: "/tmp", env, stdin: "hi" });
	expect(r.stdout).toBe("hi");
	expect(Date.now() - t).toBeLessThan(1000);
});

test("stdinOpenMs keeps stdin open after the text is written", async () => {
	const t = Date.now();
	const r = await runChild(["cat"], {
		cwd: "/tmp",
		env,
		stdin: "hi",
		stdinOpenMs: 1500,
	});
	expect(r.stdout).toBe("hi");
	expect(Date.now() - t).toBeGreaterThanOrEqual(1500);
});
