import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { z } from "zod";

import { Bundle } from "../src/ast.ts";
import { prepare, unitsOf } from "../src/prepare.ts";

const mod = async (
	text: string,
): Promise<NonNullable<ReturnType<Bundle["get"]>>> => {
	const bundle = await Bundle.parse([{ name: "/$bunfs/root/a.js", text }]);
	const found = bundle.get("a.js");
	if (found === undefined) {
		throw new Error("the bundle holds no a.js");
	}
	return found;
};

test("a unit cuts out the functions inside it", async () => {
	const units = unitsOf(
		"a.js",
		await mod(
			'var t={name:"Monitor",isEnabled(){return g("tengu_x")}};function g(k){return k.length}',
		),
	);
	const top = units.find((u) => u.k === "VariableDeclaration");
	const method = units.find((u) => u.k === "isEnabled");
	expect(top?.t).toMatch(/name:"Monitor",isEnabledƒ/u);
	expect(top?.f).toEqual(['"Monitor"', ".isEnabled", ".name"]);
	expect(method?.f).toEqual(['"tengu_x"']);
	expect(units.filter((u) => u.k === "function")).toHaveLength(1);
});

test("a second call for the same binary reads the cache and parses nothing", async () => {
	const root = await mkdtemp(join(tmpdir(), "cc-inspect-test-"));
	try {
		const modules = [
			{
				name: "/$bunfs/root/cli.js",
				text: 'var r=import.meta.require("/$bunfs/root/chunk-ab12.js");',
			},
			{
				name: "/$bunfs/root/chunk-ab12.js",
				text: 'export function q(){return"x"}',
			},
			{ name: "/$bunfs/root/notes.txt", text: "not code" },
		];
		const first = await prepare("9.9.9", import.meta.path, modules, root);
		expect(first.parsed).toBe(2);
		const chunks = Object.values(first.index.chunks);
		expect(chunks).toHaveLength(1);
		expect(chunks[0]).toMatch(/^chunk@[0-9a-f]{8}\.js$/u);
		expect(first.index.units.find((u) => u.m === "cli.js")?.t).toContain(
			"chunk@",
		);
		const written = await readdir(join(first.dir, "modules"));
		expect(written.toSorted((x, y) => x.localeCompare(y))).toEqual([
			"chunk-ab12.js",
			"cli.js",
		]);
		const second = await prepare("9.9.9", import.meta.path, modules, root);
		expect(second.parsed).toBe(0);
		expect(second.index.units).toEqual(first.index.units);
		// An index from an older cleaning format is cleaned again, and the readable views of the old text go.
		const file = join(first.dir, "index.json");
		const stored = z
			.record(z.string(), z.unknown())
			.parse(await Bun.file(file).json());
		await Bun.write(file, JSON.stringify({ ...stored, format: 0 }));
		await mkdir(join(first.dir, "readable"));
		await Bun.write(join(first.dir, "readable", "cli.js"), "old");
		const again = await prepare("9.9.9", import.meta.path, modules, root);
		expect(again.parsed).toBe(2);
		expect(await Bun.file(join(first.dir, "readable", "cli.js")).exists()).toBe(
			false,
		);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});
