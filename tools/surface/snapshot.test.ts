import { expect, test } from "bun:test";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { listInstalls } from "../../inspect/mcp/src/binary.ts";
import { KINDS } from "../../inspect/mcp/src/surface/index.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { sorted, sortedStrings } from "../schemas/sorted.ts";
import { committed, serialize, validate } from "./snapshot.ts";

const SCRIPT = join(import.meta.dir, "snapshot.ts");
const COPY = join(import.meta.dir, "..", "..", "schemas", "surface.json");
const installs = await listInstalls();
const installed = installs.some((i) => i.version === CLAUDE_CODE_VERSION);

const tmp = () => mkdtemp(join(tmpdir(), "surface-"));
const exists = async (path: string) => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};
const readText = (path: string) => Bun.file(path).text();
const readJson = (path: string): Promise<unknown> => Bun.file(path).json();

/** Run the snapshot command with no binary anywhere (an empty versions folder and no launcher). */
const run = async (args: string[], empty = true) => {
	const dir = await tmp();
	const p = Bun.spawn(["bun", SCRIPT, ...args], {
		env: {
			...process.env,
			...(empty
				? {
						CC_INSPECT_VERSIONS_DIR: join(dir, "versions"),
						CC_INSPECT_LAUNCHER: join(dir, "claude"),
					}
				: {}),
		},
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	return { code, out, err, dir };
};

interface CaptureItem {
	kind: string;
	version: string;
	module: unknown;
}
interface Capture {
	version: string;
	kinds: Record<string, CaptureItem[]>;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const isCaptureItem = (v: unknown): v is CaptureItem =>
	isRecord(v) &&
	typeof v["kind"] === "string" &&
	typeof v["version"] === "string";

const isCapture = (v: unknown): v is Capture =>
	isRecord(v) &&
	typeof v["version"] === "string" &&
	isRecord(v["kinds"]) &&
	Object.values(v["kinds"]).every(
		(items) => Array.isArray(items) && items.every((i) => isCaptureItem(i)),
	);

const copyOf = (dir: string) => readText(join(dir, "schemas", "surface.json"));

const item = (kind: string, name: string, module = "m.js", offset = 1) => ({
	kind,
	name,
	module,
	offset,
});

test("the committed copy drops module and offset and sorts kinds and items", () => {
	const a = committed("1.2.3", {
		flag: [item("flag", "--b"), item("flag", "--a")],
		env: [{ ...item("env", "Z"), default: '"1"' }, item("env", "A")],
	});
	expect(Object.keys(a.kinds)).toEqual(["env", "flag"]);
	expect(a.kinds["env"]).toEqual([
		{ name: "A" },
		{ name: "Z", default: '"1"' },
	]);
	expect(a.kinds["flag"]?.map((i) => i.name)).toEqual(["--a", "--b"]);
	expect(serialize(a)).not.toContain("module");
});

test("the output is the same for the same items in any order", () => {
	const items = ["c", "a", "b"].map((n) => item("env", n));
	const descending = sorted(items, (x, y) => y.name.localeCompare(x.name));
	const one = serialize(committed("1.2.3", { env: items, flag: items }));
	const two = serialize(
		committed("1.2.3", { flag: descending, env: descending }),
	);
	expect(one).toBe(two);
	expect(JSON.parse(one)).toHaveProperty("version", "1.2.3");
});

test("validate accepts a good file and names each problem", () => {
	const kinds = Object.fromEntries(
		Object.keys(KINDS).map((k) => [k, [{ name: "a" }, { name: "b" }]]),
	);
	expect(validate({ version: "1.2.3", kinds }, "1.2.3")).toEqual([]);
	const wrongVersion = validate({ version: "1.2.2", kinds }, "1.2.3");
	expect(wrongVersion).toHaveLength(1);
	expect(wrongVersion[0]).toContain("1.2.2");
	expect(wrongVersion[0]).toContain("1.2.3");
	const emptyKind = validate(
		{ version: "1.2.3", kinds: { ...kinds, env: [] } },
		"1.2.3",
	);
	expect(emptyKind).toHaveLength(1);
	expect(emptyKind[0]).toContain("env");
	const unsorted = validate(
		{
			version: "1.2.3",
			kinds: { ...kinds, env: [{ name: "b" }, { name: "a" }] },
		},
		"1.2.3",
	);
	expect(unsorted).toHaveLength(1);
	expect(unsorted[0]).toContain("env");
	const { env: _, ...rest } = kinds;
	expect(validate({ version: "1.2.3", kinds: rest }, "1.2.3")).toEqual([
		'kind "env" missing',
	]);
	expect(validate([], "1.2.3")).toEqual(["not an object"]);
});

test("the committed schemas/surface.json has the right shape and version", async () => {
	expect(validate(await readJson(COPY), CLAUDE_CODE_VERSION)).toEqual([]);
});

test("a missing binary exits non-zero, names the path, and writes no file", async () => {
	const out = await tmp();
	const r = await run(["--binary", "9.9.9", "--out", out]);
	expect(r.code).not.toBe(0);
	expect(r.err).toContain(join(r.dir, "versions", "9.9.9"));
	expect(await exists(join(out, "captures"))).toBe(false);
	expect(await exists(join(out, "schemas"))).toBe(false);
});

test("a missing binary given as a path names that path", async () => {
	const r = await run([
		"--binary",
		"/nonexistent/claude-bin",
		"--out",
		await tmp(),
	]);
	expect(r.code).not.toBe(0);
	expect(r.err).toContain("/nonexistent/claude-bin");
});

test("check with no binary validates the file, skips the comparison, and exits 0", async () => {
	const before = await readText(COPY);
	const r = await run(["--check"]);
	expect(r.err).toBe("");
	expect(r.code).toBe(0);
	// The skip is a notice that names the version it could not compare.
	expect(r.out.trim().split("\n")).toHaveLength(1);
	expect(r.out).toContain(CLAUDE_CODE_VERSION);
	// The check writes nothing.
	expect(await readText(COPY)).toBe(before);
});

test("check with no binary still fails on the wrong version", async () => {
	const out = await tmp();
	await mkdir(join(out, "schemas"));
	const kinds = Object.fromEntries(
		Object.keys(KINDS).map((k) => [k, [{ name: "a" }]]),
	);
	await writeFile(
		join(out, "schemas", "surface.json"),
		JSON.stringify({ version: "0.0.1", kinds }),
	);
	const r = await run(["--check", "--out", out]);
	expect(r.code).toBe(1);
	expect(r.err).toContain("0.0.1");
});

test.skipIf(!installed)(
	"two runs on the installed binary give the same bytes as the committed file",
	async () => {
		const [a, b] = await Promise.all([tmp(), tmp()]);
		const runs = await Promise.all(
			[a, b].map((out) =>
				run(["--binary", CLAUDE_CODE_VERSION, "--commit", "--out", out], false),
			),
		);
		for (const r of runs) {
			expect(r.err).toBe("");
			expect(r.code).toBe(0);
		}
		const [copyA, copyB, committedText] = await Promise.all([
			copyOf(a),
			copyOf(b),
			readText(COPY),
		]);
		expect(copyA).toBe(copyB);
		expect(copyA).toBe(committedText);
		const cap = await readJson(
			join(a, "captures", CLAUDE_CODE_VERSION, "surface.json"),
		);
		if (!isCapture(cap)) {
			throw new TypeError("the capture has an unexpected shape");
		}
		expect(cap.version).toBe(CLAUDE_CODE_VERSION);
		expect(sortedStrings(Object.keys(cap.kinds))).toEqual(
			sortedStrings(Object.keys(KINDS)),
		);
		for (const [k, items] of Object.entries(cap.kinds)) {
			expect(items.length, k).toBeGreaterThan(0);
			for (const i of items) {
				expect(i.kind).toBe(k);
				expect(i.version).toBe(CLAUDE_CODE_VERSION);
				expect("module" in i).toBe(true);
			}
		}
	},
	400_000,
);
