import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { extractModules } from "../src/bunfs.ts";
import { rejection } from "./run-helpers.ts";

const TRAILER = "\n---- Bun! ----\n";
const WINDOW = 4 * 1024 * 1024;

/** A file with the layout of a Bun single-file executable: `before`, the module graph, the trailer, `after` zero bytes. */
const executable = (
	mods: { name: string; contents: Buffer }[],
	entry: number,
	before: Buffer,
	after: number,
): Buffer => {
	// Data that is no name and no contents comes first in the graph, as the bytecode does in the program.
	const data: Buffer[] = [Buffer.alloc(100, 7)];
	let size = 100;
	const put = (b: Buffer): [number, number] => {
		const at: [number, number] = [b.length === 0 ? 0 : size, b.length];
		data.push(b);
		size += b.length;
		return at;
	};
	const table = Buffer.alloc(mods.length * 52);
	for (const [i, m] of mods.entries()) {
		const parts = [put(Buffer.from(m.name)), put(m.contents)];
		for (const [k, [off, len]] of parts.entries()) {
			table.writeUInt32LE(off, i * 52 + k * 8);
			table.writeUInt32LE(len, i * 52 + k * 8 + 4);
		}
	}
	const offsets = Buffer.alloc(32);
	offsets.writeBigUInt64LE(BigInt(size + table.length), 0);
	offsets.writeUInt32LE(size, 8);
	offsets.writeUInt32LE(table.length, 12);
	offsets.writeUInt32LE(entry, 16);
	return Buffer.concat([
		before,
		...data,
		table,
		offsets,
		Buffer.from(TRAILER),
		Buffer.alloc(after),
	]);
};

const MODS = [
	{ name: "/$bunfs/root/a.js", contents: Buffer.from('var a="zażółć"') },
	{ name: "/$bunfs/root/empty.js", contents: Buffer.alloc(0) },
	{ name: "/$bunfs/root/b.zst", contents: Buffer.from([40, 181, 47, 253, 0]) },
];

// The trailer text stands in the program's data too, and the last one ends the graph.
test.each([
	["at the end of the file", 0],
	["across the start of the last part the reader takes", WINDOW - 7],
	["before the last part the reader takes", 2 * WINDOW + 3],
])(
	"extractModules reads the modules when the trailer is %s",
	async (_, after) => {
		const root = await mkdtemp(join(tmpdir(), "cc-inspect-test-"));
		try {
			const path = join(root, "program");
			await Bun.write(
				path,
				executable(MODS, 2, Buffer.from(`junk${TRAILER}junk`), after),
			);
			const { modules, entry } = await extractModules(path);
			expect(entry).toBe("/$bunfs/root/b.zst");
			expect(modules.map((m) => m.name)).toEqual(MODS.map((m) => m.name));
			expect(modules.map((m) => m.bytes.toString("hex"))).toEqual(
				MODS.map((m) => m.contents.toString("hex")),
			);
			expect(modules.map((m) => m.source).slice(0, 2)).toEqual([
				'var a="zażółć"',
				"",
			]);
		} finally {
			await rm(root, { recursive: true });
		}
	},
);

test("extractModules rejects a file that has no trailer", async () => {
	const root = await mkdtemp(join(tmpdir(), "cc-inspect-test-"));
	try {
		const path = join(root, "program");
		await Bun.write(path, Buffer.alloc(WINDOW + 100, 1));
		expect(await rejection(extractModules(path))).toMatch(/no trailer/u);
	} finally {
		await rm(root, { recursive: true });
	}
});
