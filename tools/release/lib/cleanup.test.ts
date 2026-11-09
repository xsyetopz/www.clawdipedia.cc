// Run: bun test tools/release/lib/cleanup.test.ts
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const crashWith = async (
	end: string,
): Promise<{ code: number; cleaned: boolean }> => {
	const dir = await mkdtemp(join(tmpdir(), "cleanup-test-"));
	const mark = join(dir, "cleaned");
	const script = join(dir, "crash.ts");
	await Bun.write(
		script,
		`import { onCleanup } from ${JSON.stringify(join(import.meta.dir, "cleanup.ts"))};
onCleanup(async () => { await Bun.write(${JSON.stringify(mark)}, "1"); });
${end}
`,
	);
	const proc = Bun.spawn([process.execPath, script], {
		stdout: "ignore",
		stderr: "ignore",
	});
	const code = await proc.exited;
	const cleaned = await Bun.file(mark).exists();
	await rm(dir, { recursive: true, force: true });
	return { code, cleaned };
};

test("an uncaught error runs cleanup and exits with status 1", async () => {
	expect(await crashWith(`throw new Error("boom");`)).toEqual({
		code: 1,
		cleaned: true,
	});
});

test("an unhandled rejection runs cleanup and exits with status 1", async () => {
	expect(await crashWith(`void Promise.reject(new Error("boom"));`)).toEqual({
		code: 1,
		cleaned: true,
	});
});

test("a normal end runs cleanup and exits with status 0", async () => {
	expect(await crashWith("")).toEqual({ code: 0, cleaned: true });
});
