import { expect, test } from "bun:test";
import { dirname, join } from "node:path";

const DRIVER = join(dirname(new URL(import.meta.url).pathname), "driver.py");
const LOAD = `import importlib.util,sys
s=importlib.util.spec_from_file_location("d",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
sys.stdout.write(m.render(sys.stdin.buffer.read()))`;

const render = async (raw: string): Promise<string> => {
	const p = Bun.spawn(["python3", "-I", "-c", LOAD, DRIVER], {
		stdin: Buffer.from(raw),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [stdout, code] = await Promise.all([
		new Response(p.stdout).text(),
		p.exited,
	]);
	expect(code).toBe(0);
	return stdout;
};

test("cursor-forward after CR moves over the letters and keeps them", async () => {
	// 2.1.319 elicitation dialog: each line ends with CR, CSI 2 C, CSI 2 B before the next one.
	const out = await render(
		"\r\u001B[2C\u001B[2BPROBE-ELICIT: pick a color\u001B[K\r\u001B[2C\u001B[2B* Color",
	);
	expect(out).toContain("PROBE-ELICIT: pick a color");
	expect(out).toContain("* Color");
});

test("cursor-forward past the end of the line adds spaces", async () => {
	expect(await render("a\u001B[3Cb")).toBe("a b");
});
