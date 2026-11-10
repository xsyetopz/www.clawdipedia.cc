// Usage: bun tools/surface/snapshot.ts [--binary <version|path>] [--commit] [--out <dir>] [--kind <a,b>] [--check]
// Reads one installed Claude Code binary and writes every surface item (design D4), grouped by kind, to
// captures/<version>/surface.json. --commit also writes schemas/surface.json (site version only): the same
// items minus module and offset, sorted by kind and name, so two runs on one binary give the same bytes.
// --check (part of schemas:check) validates the shape and version of schemas/surface.json, and compares it
// with a fresh run only when the binary of the site version is installed.
// --out moves both output folders under <dir>. --kind limits the kinds and cannot be combined with --commit.
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, dirname, join } from "node:path";
import { parseArgs } from "node:util";

import { binaryPath, program } from "../../inspect/mcp/src/binary.ts";
import {
	KINDS,
	surface,
	type SurfaceItem,
} from "../../inspect/mcp/src/surface/index.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { sorted } from "../schemas/sorted.ts";
import { cmp, FIELDS, isRecord, validate } from "./shape.ts";

export { validate } from "./shape.ts";

const ROOT = join(import.meta.dir, "..", "..");
// The `bun fmt` print width, counting a tab as two columns (`tabWidth` in bunfig.toml).
const WIDTH = 80;
const VERSION_RE = /^\d+\.\d+\.\d+/u;

/** An item of the committed copy: no kind (the group key), no module, no offset. */
export interface CommittedItem {
	name: string;
	default?: string;
	values?: string[];
	gate?: string;
	detail?: string;
}
export interface Committed {
	version: string;
	kinds: Record<string, CommittedItem[]>;
}

const stripped = (i: SurfaceItem): CommittedItem => {
	const out: CommittedItem = { name: i.name };
	for (const f of FIELDS) {
		const x = i[f];
		if (x !== undefined) {
			Object.assign(out, { [f]: x });
		}
	}
	return out;
};

const byNameThenJson = (a: CommittedItem, b: CommittedItem) =>
	cmp(a.name, b.name) || cmp(JSON.stringify(a), JSON.stringify(b));

/** The committed copy of the items by kind: kinds and items sorted. */
export const committed = (
	version: string,
	byKind: Record<string, SurfaceItem[]>,
): Committed => {
	const kinds: Record<string, CommittedItem[]> = {};
	for (const k of sorted(Object.keys(byKind), cmp)) {
		kinds[k] = sorted(
			(byKind[k] ?? []).map((i) => stripped(i)),
			byNameThenJson,
		);
	}
	return { version, kinds };
};

// `bun fmt` style: an object or array stays on one line when it fits in WIDTH (with the trailing comma), else one member per line.
const flat = (v: unknown): string => {
	if (Array.isArray(v)) {
		return `[${v.map((x) => flat(x)).join(", ")}]`;
	}
	if (isRecord(v)) {
		return `{ ${Object.entries(v)
			.map(([k, x]) => `${JSON.stringify(k)}: ${flat(x)}`)
			.join(", ")} }`;
	}
	return JSON.stringify(v);
};
const tabs = (pad: number) => "\t".repeat(pad / 2);
const layout = (v: unknown, pad: number, last: boolean, lead = 0): string => {
	const one = flat(v);
	if (
		pad + lead + one.length + (last ? 0 : 1) <= WIDTH ||
		typeof v !== "object" ||
		v === null
	) {
		return one;
	}
	const sp = tabs(pad);
	const rows = Array.isArray(v)
		? v.map((x, n) => `${sp}\t${layout(x, pad + 2, n === v.length - 1)}`)
		: Object.entries(v).map(([k, x], n, all) => {
				const key = `${JSON.stringify(k)}: `;
				return `${sp}\t${key}${layout(x, pad + 2, n === all.length - 1, key.length)}`;
			});
	const [open, close] = Array.isArray(v) ? ["[", "]"] : ["{", "}"];
	return `${open}\n${rows.map((r, n) => (n === rows.length - 1 ? r : `${r},`)).join("\n")}\n${sp}${close}`;
};

/** The bytes of schemas/surface.json. */
export const serialize = (c: Committed): string => {
	const groups = Object.entries(c.kinds).map(([k, items]) => {
		const rows = items.map(
			(i, n) =>
				`${layout(i, 6, n === items.length - 1)}${n === items.length - 1 ? "" : ","}`,
		);
		return rows.length > 0
			? `\t\t${JSON.stringify(k)}: [\n${rows.map((r) => `\t\t\t${r}`).join("\n")}\n\t\t]`
			: `\t\t${JSON.stringify(k)}: []`;
	});
	return `{\n\t"version": ${JSON.stringify(c.version)},\n\t"kinds": {\n${groups.join(",\n")}\n\t}\n}\n`;
};

/** The bytes of captures/<version>/surface.json: the full items, one per line. */
export const serializeCapture = (
	version: string,
	byKind: Record<string, SurfaceItem[]>,
): string => {
	const groups = sorted(Object.keys(byKind), cmp).map((k) => {
		const rows = (byKind[k] ?? []).map((i) => ({
			name: i.name,
			json: JSON.stringify(
				Object.fromEntries([...Object.entries(i), ["version", version]]),
			),
		}));
		const lines = sorted(
			rows,
			(a, b) => cmp(a.name, b.name) || cmp(a.json, b.json),
		).map((r) => r.json);
		return `${JSON.stringify(k)}: [\n${lines.join(",\n")}\n]`;
	});
	return `{\n"version": ${JSON.stringify(version)},\n"kinds": {\n${groups.join(",\n")}\n}\n}\n`;
};

const versionsDir = () => {
	const dir = process.env["CC_INSPECT_VERSIONS_DIR"];
	return dir === undefined || dir === ""
		? join(homedir(), ".local/share/claude/versions")
		: dir;
};

/** The path to name when the binary is missing. */
const wanted = (binary: string) =>
	VERSION_RE.test(binary) ? join(versionsDir(), binary) : binary;

/** Read the binary and give its version and the items by kind. Throws a message that names the missing path. */
export const snapshot = async (
	binary: string,
	only?: string[],
): Promise<{ version: string; byKind: Record<string, SurfaceItem[]> }> => {
	try {
		await binaryPath(binary);
	} catch {
		throw new Error(`binary not found: ${wanted(binary)}`);
	}
	const kinds = only ?? Object.keys(KINDS);
	for (const k of kinds) {
		if (!(k in KINDS)) {
			throw new Error(
				`unknown kind "${k}"; kinds: ${Object.keys(KINDS).join(", ")}`,
			);
		}
	}
	const p = await program(binary);
	const bundle = await p.bundle();
	const byKind: Record<string, SurfaceItem[]> = {};
	const runs = await Promise.all(
		kinds.map(async (k) => [k, await surface(bundle, k, p.modules)] as const),
	);
	for (const [k, items] of runs) {
		byKind[k] = items;
	}
	const version = VERSION_RE.test(binary) ? binary : basename(binary);
	return { version, byKind };
};

const write = async (file: string, text: string) => {
	await mkdir(dirname(file), { recursive: true });
	await writeFile(file, text);
};

const errorMessage = (error: unknown) =>
	error instanceof Error ? error.message : String(error);

const isInstalled = async () => {
	try {
		await binaryPath(CLAUDE_CODE_VERSION);
		return true;
	} catch {
		return false;
	}
};

/** The exit code of `--check`. */
const check = async (copy: string): Promise<number> => {
	const file = Bun.file(copy);
	if (!(await file.exists())) {
		console.error('schemas/surface.json: missing (run "bun run surface")');
		return 1;
	}
	const text = await file.text();
	let bad: string[];
	try {
		bad = validate(JSON.parse(text), CLAUDE_CODE_VERSION);
	} catch (error) {
		bad = [`not JSON: ${errorMessage(error)}`];
	}
	if (bad.length > 0) {
		for (const p of bad.slice(0, 20)) {
			console.error(`schemas/surface.json: ${p} (run "bun run surface")`);
		}
		return 1;
	}
	if (!(await isInstalled())) {
		console.info(
			`schemas/surface.json ok, skipped the comparison with a fresh run (Claude Code ${CLAUDE_CODE_VERSION} is not installed)`,
		);
		return 0;
	}
	const fresh = await snapshot(CLAUDE_CODE_VERSION);
	if (serialize(committed(fresh.version, fresh.byKind)) !== text) {
		console.error(
			'schemas/surface.json: differs from a fresh run on the binary (run "bun run surface")',
		);
		return 1;
	}
	console.info("schemas/surface.json ok, same as a fresh run");
	return 0;
};

const main = async (): Promise<number> => {
	const { values: a } = parseArgs({
		options: {
			binary: { type: "string" },
			commit: { type: "boolean" },
			check: { type: "boolean" },
			out: { type: "string" },
			kind: { type: "string" },
		},
	});
	const out = a.out ?? ROOT;
	const copy = join(out, "schemas", "surface.json");
	if (a.check === true) {
		return check(copy);
	}
	const only = a.kind?.split(",");
	if (a.commit === true && only !== undefined) {
		console.error("surface: --kind cannot be combined with --commit");
		return 2;
	}
	try {
		const { version, byKind } = await snapshot(
			a.binary ?? CLAUDE_CODE_VERSION,
			only,
		);
		if (a.commit === true && version !== CLAUDE_CODE_VERSION) {
			throw new Error(
				`--commit needs the site version ${CLAUDE_CODE_VERSION}, not ${version}`,
			);
		}
		const file = join(out, "captures", version, "surface.json");
		await write(file, serializeCapture(version, byKind));
		console.info(
			`${file}: ${Object.values(byKind).reduce((n, l) => n + l.length, 0)} items in ${Object.keys(byKind).length} kinds`,
		);
		if (a.commit === true) {
			await write(copy, serialize(committed(version, byKind)));
			console.info(`${copy} written`);
		}
		return 0;
	} catch (error) {
		console.error(`surface: ${errorMessage(error)}`);
		return 1;
	}
};

if (import.meta.main) {
	process.exitCode = await main();
}
