import { expect, test } from "bun:test";
import { dirname, join } from "node:path";

const DRIVER = join(dirname(new URL(import.meta.url).pathname), "driver.py");
const LOAD = `import importlib.util,sys
s=importlib.util.spec_from_file_location("d",sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
sys.stdout.write(m.render(sys.stdin.buffer.read()))`;

const render = (raw: string): string => {
  const r = Bun.spawnSync(["python3", "-I", "-c", LOAD, DRIVER], {
    stdin: Buffer.from(raw),
  });
  expect(r.exitCode).toBe(0);
  return r.stdout.toString();
};

test("cursor-forward after CR moves over the letters and keeps them", () => {
  // 2.1.319 elicitation dialog: each line ends with CR, CSI 2 C, CSI 2 B before the next one.
  const out = render(
    "\r\x1b[2C\x1b[2BPROBE-ELICIT: pick a color\x1b[K\r\x1b[2C\x1b[2B* Color",
  );
  expect(out).toContain("PROBE-ELICIT: pick a color");
  expect(out).toContain("* Color");
});

test("cursor-forward past the end of the line adds spaces", () => {
  expect(render("a\x1b[3Cb")).toBe("a b");
});
