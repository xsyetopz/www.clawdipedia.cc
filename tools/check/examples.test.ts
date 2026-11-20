import { expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = join(import.meta.dir, "examples.ts");

test("--fix writes the bun fmt layout back into the markdown", async () => {
	const dir = await mkdtemp(join(tmpdir(), "examples-fix-"));
	try {
		// Arrange
		const page = join(dir, "page.md");
		await writeFile(
			page,
			"## Example\n\n```ts\nconst a = {\n  b: 1,\n};\n```\n"
		);
		// Act
		const p = Bun.spawn(["bun", SCRIPT, "--fix", "--self-test", dir], {
			stdout: "pipe",
			stderr: "pipe"
		});
		const [out, err] = await Promise.all([
			new Response(p.stdout).text(),
			new Response(p.stderr).text(),
			p.exited
		]);
		// Assert
		expect(err).not.toContain("changed meanwhile");
		expect(out).toContain("1 fixed");
		expect(await readFile(page, "utf8")).toContain("const a = {\n  b: 1\n};");
		expect(p.exitCode).toBe(0);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});
