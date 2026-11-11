import { expect, test } from "bun:test";
import { join } from "node:path";

import { Bundle } from "../src/ast.ts";
import { cleanModule, renameModule } from "../src/clean.ts";

const mod = async (text: string) => {
	const bundle = new Bundle([{ name: "/$bunfs/root/a.js", text }]);
	const found = await bundle.get("a.js");
	if (found === undefined) {
		throw new Error("module a.js missing");
	}
	return found;
};

const build = async (minifyNames: boolean): Promise<string> => {
	const r = await Bun.build({
		entrypoints: [join(import.meta.dir, "fixtures/clean-app.ts")],
		format: "esm",
		target: "bun",
		minify: { whitespace: true, syntax: true, identifiers: minifyNames },
	});
	if (!r.success) {
		throw new Error(r.logs.map((l) => l.message).join("\n"));
	}
	return (await r.outputs[0]?.text()) ?? "";
};

test("two builds of the same code clean to the same text", async () => {
	const [short, long] = await Promise.all([build(true), build(false)]);
	expect(short).not.toBe(long);
	const a = await cleanModule(await mod(short));
	expect(a).toBe(await cleanModule(await mod(long)));
	expect(a).toContain("tengu_example_gate");
});

test("keeps shorthand keys, export names, and class names", async () => {
	const out = renameModule(
		await mod(
			"const a=1;function f({b,c=2}){return{a,b,c}}class K{m(){return K}}export{f,K as Z};",
		),
	);
	expect(out).toMatch(/\{b:a1,c:a2=2\}/u);
	expect(out).toMatch(/return\{a:\$[0-9a-f]{6},b:a1,c:a2\}/u);
	expect(out).toMatch(/class (\$[0-9a-f]{6})\{m\(\)\{return \1\}\}/u);
	expect(out).toMatch(/export\{\$[0-9a-f]{6} as f,\$[0-9a-f]{6} as Z\}/u);
});

const moduleLevelName = async (src: string) =>
	/function (\$[0-9a-f]{6})\(\)\{return"x"\}/u.exec(
		renameModule(await mod(src)),
	)?.[1];

test("a module-level name stays when other code is added", async () => {
	const before = await moduleLevelName('function q(){return"x"}export{q};');
	expect(before).toBeDefined();
	expect(
		await moduleLevelName('var z=1;function w(){return"x"}export{w,z};'),
	).toBe(before);
});

test("rewrites chunk paths from the map", async () => {
	const out = renameModule(
		await mod('var r=import.meta.require("/$bunfs/root/chunk-ab12.js");'),
		new Map([["chunk-ab12.js", "chunk@f00d.js"]]),
	);
	expect(out).toContain('"/$bunfs/root/chunk@f00d.js"');
});
