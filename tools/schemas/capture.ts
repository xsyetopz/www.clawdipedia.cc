// Shared by generate.ts (schemas/) and tools/reference/zod.ts (payload models).
// Safety: the binary is only read. Its embedded modules are written to a temp dir, capture lines are appended to
// some of them, and a child bun process imports them with a fake key, a dead proxy, no real HOME, and no network.
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";

import { extractModules } from "../../inspect/mcp/src/bunfs.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

// `module` finds the schema's definition in a chunk; `expr` is the JS expression that evaluates to the zod schema there.
// `names` holds the expressions of earlier captures (same chunk), so a later anchor can refer to an earlier schema.
// `rewrite` changes the chunk's source before the capture line is appended (for values that are only local variables).
// A capture's expression may also evaluate to a plain value that holds schemas (array or object): the driver
// converts every schema inside it.
export interface Capture {
	kind: string;
	// Only used to anchor a later capture, not exported.
	internal?: boolean;
	module: RegExp | ((names: Map<string, string>) => RegExp | null);
	expr: (m: RegExpMatchArray, src: string) => string | null;
	rewrite?: (src: string, m: RegExpMatchArray) => string;
	// Also import every module whose source matches (the capture only fills in when those modules run).
	// Share repeated sub-schemas through $defs ("ref") instead of copying them in place ("inline", the default).
	reused?: "ref";
	// It gets the match and the name of the module the capture was found in.
	alsoImport?: (m: RegExpMatchArray, moduleName: string) => RegExp;
}
export const ID = String.raw`[\w$]+`;

// `--bin <path>` or the installed binary of the version in src/version.ts.
export const findBinary = async (): Promise<string> => {
	const i = process.argv.indexOf("--bin");
	const bin =
		i === -1
			? join(homedir(), ".local/share/claude/versions", CLAUDE_CODE_VERSION)
			: (process.argv[i + 1] ?? "");
	if (!(await Bun.file(bin).exists())) {
		throw new Error(`Claude Code ${CLAUDE_CODE_VERSION} not found at ${bin}`);
	}
	return bin;
};

const baseName = (name: string) => name.slice(name.lastIndexOf("/") + 1);

export interface Captured {
	raw: Record<string, unknown>;
	lossy: string[];
	found: Map<string, string>;
}

type Module = Awaited<ReturnType<typeof extractModules>>["modules"][number];

interface State {
	patched: Set<string>;
	kinds: string[];
	refKinds: string[];
	found: Map<string, string>;
	names: Map<string, string>;
	importers: Map<string, RegExp>;
}

/** Points a module's imports at the temp dir and drops the bytecode pragma. */
const localizeSource = (source: string): string =>
	source
		// Modules import each other as "/$bunfs/root/chunk-x.js".
		.replace(/^\/\/ @bun @bytecode/u, "// @bun")
		.replaceAll(/(from|import\(?|require\()\s*"\/\$bunfs\/root\//gu, '$1"./')
		// Embedded assets are also named by path in plain calls: Be("/$bunfs/root/x.txt").
		.replaceAll(/\(\s*"\/\$bunfs\/root\//gu, '("./');

/** Records one capture found in a module. Returns the changed source and the line to append. */
const applyCapture = (
	cap: Capture,
	src: string,
	moduleName: string,
	state: State,
): { src: string; line: string } | null => {
	const re =
		typeof cap.module === "function" ? cap.module(state.names) : cap.module;
	const m = re === null ? null : src.match(re);
	if (m === null) {
		return null;
	}
	const expr = cap.expr(m, src);
	if (expr === null || expr === "") {
		return null;
	}
	if (state.found.has(cap.kind)) {
		throw new Error(
			`anchor for "${cap.kind}" matches both ${state.found.get(cap.kind)} and ${moduleName}`,
		);
	}
	state.found.set(cap.kind, moduleName);
	state.names.set(cap.kind, expr);
	if (cap.internal !== true) {
		state.kinds.push(cap.kind);
	}
	if (cap.reused !== undefined) {
		state.refKinds.push(cap.kind);
	}
	if (cap.alsoImport !== undefined) {
		state.importers.set(cap.kind, cap.alsoImport(m, baseName(moduleName)));
	}
	return {
		src: cap.rewrite === undefined ? src : cap.rewrite(src, m),
		line: `;(globalThis.__ccSchemas??={})[${JSON.stringify(cap.kind)}]=()=>${expr};\n`,
	};
};

/** Starts the write of one module into the temp root. Marks it patched when a capture line was appended. */
const writeModule = (
	mod: Module,
	rootDir: string,
	captures: Capture[],
	state: State,
): Promise<number> => {
	const target = join(rootDir, baseName(mod.name));
	// Assets (text, wasm) that modules import by path sit beside them.
	if (!mod.name.endsWith(".js")) {
		return Bun.write(target, mod.bytes);
	}
	let src = localizeSource(mod.source);
	let tail = "";
	for (const cap of captures) {
		const applied = applyCapture(cap, src, mod.name, state);
		if (applied !== null) {
			src = applied.src;
			tail += applied.line;
		}
	}
	if (tail !== "") {
		src += `\n${tail}`;
		state.patched.add(baseName(mod.name));
	}
	return Bun.write(target, src);
};

/** Nothing from the real environment: no credentials, no config dir, all traffic points at a closed port. */
const sandboxEnv = (work: string, emptyBin: string): Record<string, string> => {
	const dead = "http://127.0.0.1:9";
	return {
		PATH: emptyBin,
		HOME: join(work, "home"),
		TMPDIR: work,
		CLAUDE_CONFIG_DIR: join(work, "config"),
		ANTHROPIC_API_KEY: "sk-ant-fake-schema-gen",
		ANTHROPIC_BASE_URL: dead,
		HTTPS_PROXY: dead,
		HTTP_PROXY: dead,
		ALL_PROXY: dead,
		NO_PROXY: "",
		// The one settings key (xaaIdp) the binary only adds when this variable is set. Without it the schema lacks the key.
		CLAUDE_CODE_ENABLE_XAA: "1",
		DISABLE_AUTOUPDATER: "1",
		DISABLE_TELEMETRY: "1",
		CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
	};
};

const runDriver = async (work: string): Promise<void> => {
	const home = join(work, "home");
	const cfg = join(work, "config");
	await mkdir(home);
	await mkdir(cfg);
	// Network is denied by the OS sandbox, not just by a dead proxy. PATH is an empty folder, so the child
	// cannot reach /usr/bin/security (keychain) or any other tool.
	const emptyBin = join(work, "empty-bin");
	await mkdir(emptyBin);
	const sandboxed =
		process.platform === "darwin" &&
		(await Bun.file("/usr/bin/sandbox-exec").exists());
	if (!sandboxed) {
		throw new Error(
			"schemas: needs macOS /usr/bin/sandbox-exec to run the binary's modules with the network denied",
		);
	}
	const child = Bun.spawn(
		[
			"/usr/bin/sandbox-exec",
			"-p",
			"(version 1)(allow default)(deny network*)",
			process.execPath,
			join(import.meta.dir, "driver.ts"),
			work,
			join(work, "raw.json"),
		],
		{
			cwd: work,
			env: sandboxEnv(work, emptyBin),

			timeout: 120_000,
			stdout: "pipe",
			stderr: "pipe",
		},
	);
	const [stderr, exitCode] = await Promise.all([
		new Response(child.stderr).text(),
		child.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(
			`schema driver failed (exit ${exitCode}):\n${stderr.slice(0, 4000)}`,
		);
	}
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const isDriverOutput = (
	v: unknown,
): v is { schemas: Record<string, unknown>; lossy: string[] } =>
	isRecord(v) &&
	isRecord(v["schemas"]) &&
	Array.isArray(v["lossy"]) &&
	v["lossy"].every((x) => typeof x === "string");

/** Writes every module into `rootDir`, appends the capture lines, and returns what was found. */
const patchModules = async (
	modules: Module[],
	rootDir: string,
	captures: Capture[],
): Promise<State> => {
	const state: State = {
		patched: new Set<string>(),
		kinds: [],
		refKinds: [],
		found: new Map<string, string>(),
		names: new Map<string, string>(),
		importers: new Map<string, RegExp>(),
	};
	await Promise.all(
		modules.map((mod) => writeModule(mod, rootDir, captures, state)),
	);
	for (const cap of captures) {
		if (!state.found.has(cap.kind)) {
			throw new Error(`no module matches the anchor for "${cap.kind}"`);
		}
	}
	for (const re of state.importers.values()) {
		for (const mod of modules) {
			if (mod.name.endsWith(".js") && re.test(mod.source)) {
				state.patched.add(baseName(mod.name));
			}
		}
	}
	return state;
};

/** Runs the capture lines in an isolated child and returns the raw schemas it wrote. */
export const runCapture = async (
	bin: string,
	captures: Capture[],
): Promise<Captured> => {
	const work = await realpath(await mkdtemp(join(tmpdir(), "cc-schemas-")));
	try {
		const { modules } = await extractModules(bin);
		const rootDir = join(work, "root");
		await mkdir(rootDir);
		const state = await patchModules(modules, rootDir, captures);
		await Bun.write(
			join(work, "manifest.json"),
			JSON.stringify({
				modules: [...state.patched],
				kinds: state.kinds,
				refKinds: state.refKinds,
			}),
		);
		await runDriver(work);
		const parsed: unknown = JSON.parse(
			await Bun.file(join(work, "raw.json")).text(),
		);
		if (!isDriverOutput(parsed)) {
			throw new Error("schema driver wrote an unexpected result");
		}
		return { raw: parsed.schemas, lossy: parsed.lossy, found: state.found };
	} finally {
		await rm(work, { recursive: true, force: true });
	}
};
