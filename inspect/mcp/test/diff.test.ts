import { expect, test } from "bun:test";
import { join } from "node:path";

import { diffIndexes, filterChanges, unitDiff } from "../src/diff.ts";
import { indexOf } from "./bundle-index.ts";

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

test("two builds of the same code have no change, and an edited method has one", async () => {
	const [short, long] = await Promise.all([build(true), build(false)]);
	expect(diffIndexes(await indexOf(short), await indexOf(long)).counts).toEqual(
		{
			changed: 0,
			added: 0,
			gone: 0,
		},
	);
	const edited = long.replace('"tengu_example_gate"', '"tengu_other_gate"');
	const d = diffIndexes(await indexOf(short), await indexOf(edited));
	expect(d.counts).toEqual({ changed: 1, added: 0, gone: 0 });
	expect(d.changes[0]?.to?.k).toBe("isEnabled");
	const lines = d.changes.flatMap((x) => unitDiff(x));
	expect(lines).toHaveLength(3);
	expect(lines[0]).toBe("  (){");
	expect(lines[1]).toMatch(
		/^- return \$[0-9a-f]{6}\("tengu_example_gate",!1\)\}$/u,
	);
	expect(lines[2]).toMatch(
		/^\+ return \$[0-9a-f]{6}\("tengu_other_gate",!1\)\}$/u,
	);
	expect(filterChanges(d, "tengu_other")).toHaveLength(1);
	expect(filterChanges(d, "nothing like this")).toHaveLength(0);
});

const app = (version: string, time: string, sha: string, chunk: string) =>
	`export const about=()=>({VERSION:"${version}",BUILD_TIME:"${time}",GIT_SHA:"${sha}"}).VERSION;export const load=()=>import("/$bunfs/root/chunk-${chunk}.js");`;

test("a build stamp and a chunk name are not a change", async () => {
	const from = await indexOf(
		app("2.1.321", "2026-11-09T00:00:00Z", "aaaa", "39pr5kn3"),
	);
	const to = await indexOf(
		app("2.1.322", "2026-11-10T00:15:08Z", "bbbb", "bq6gz2p6"),
	);
	expect(diffIndexes(from, to).counts).toEqual({
		changed: 0,
		added: 0,
		gone: 0,
	});
});
