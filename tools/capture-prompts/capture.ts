// Usage: bun tools/capture-prompts/capture.ts [--only id,id] [--no-render]
// Runs the installed Claude Code binary once per variant against a local fake Messages API.
// Offline and free: fake API key, dead proxy, temp HOME/config/project. No request leaves the machine.
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { assertShimReady, writeSecurityShim } from "../release/lib/shim.ts";
import { initGit, probeEnv, requireEnv } from "./env.ts";
import { startStub } from "./stub.ts";
import { SUB_MARK, type Variant, VARIANTS } from "./variants.ts";

export const ROOT = join(import.meta.dir, "..", "..");
export const DEFAULT_PROMPT = "Reply with 'OK'.";
// `--out <dir>` (release:prompts) writes the per-variant folders there; render.ts reads the same place.
const outArg = process.argv.indexOf("--out");
export const CAPTURES =
	outArg === -1
		? join(ROOT, "captures", CLAUDE_CODE_VERSION, "prompts")
		: (process.argv[outArg + 1] ?? "");
process.env["CAPTURE_OUT"] = CAPTURES;

const argv = process.argv.slice(2);
const argValue = (flag: string): string | undefined =>
	argv.includes(flag) ? (argv[argv.indexOf(flag) + 1] ?? "") : undefined;

// `--bin <path>` lets release:prompts point at another installed version.
const BIN =
	argValue("--bin") ??
	join(
		requireEnv("HOME"),
		`.local/share/claude/versions/${CLAUDE_CODE_VERSION}`,
	);
const only = argValue("--only")?.split(",");

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec =>
	typeof v === "object" && v !== null && !Array.isArray(v);

interface Dirs {
	dir: string;
	log: string;
	cfg: string;
	home: string;
	proj: string;
}

const tempDir = async (prefix: string): Promise<string> =>
	realpath(await mkdtemp(join(tmpdir(), prefix)));

const prepare = async (v: Variant): Promise<Dirs> => {
	const dir = join(CAPTURES, v.id);
	const log = join(dir, "requests.jsonl");
	await Bun.write(log, "");
	const [cfg, home, proj] = await Promise.all([
		tempDir("cap-cfg-"),
		tempDir("cap-home-"),
		tempDir("cap-proj-"),
	]);
	const writes = [
		...Object.entries(v.cfgFiles ?? {}).map(([n, c]) =>
			Bun.write(join(cfg, n), c),
		),
		...Object.entries(v.projFiles ?? {}).map(([n, c]) =>
			Bun.write(join(proj, n), c),
		),
	];
	await Promise.all(writes);
	return { dir, log, cfg, home, proj };
};

interface Result {
	so: string;
	se: string;
	code: number;
}

const spawnOnce = async (
	v: Variant,
	d: Dirs,
	shimDir: string,
	port: number,
	prompt: string,
	extra: string[],
): Promise<Result> => {
	const env = probeEnv(v, d, shimDir, port);
	await assertShimReady(env);
	const p = Bun.spawn(
		[
			BIN,
			"-p",
			prompt,
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			v.model ?? "claude-opus-5-5",
			...extra,
			...(v.args ?? []),
		],
		{
			cwd: d.proj,
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
			env,
		},
	);
	const t = setTimeout(() => {
		p.kill();
	}, 60_000);
	const [so, se] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
	]);
	const code = await p.exited;
	clearTimeout(t);
	return { so, se, code };
};

const readLog = async (log: string): Promise<Rec[]> => {
	const text = await Bun.file(log).text();
	return text
		.trim()
		.split("\n")
		.filter((l) => l !== "")
		.map((l): unknown => JSON.parse(l))
		.filter((r): r is Rec => isRec(r));
};

const bodyOf = (r: Rec): Rec => (isRec(r["body"]) ? r["body"] : {});

const hostOf = (r: Rec): string => {
	const h = isRec(r["headers"]) ? r["headers"]["host"] : undefined;
	return typeof h === "string" ? h : "";
};

const isMessage = (r: Rec): boolean =>
	typeof r["path"] === "string" &&
	r["path"].startsWith("/v1/messages") &&
	Boolean(bodyOf(r)["messages"]);

/** Print the capture summary and warnings; false when a request left the local stub or used a real credential. */
const report = (v: Variant, res: Result, reqs: Rec[]): boolean => {
	const msgs = reqs.filter((r) => isMessage(r));
	const bad = reqs.filter((r) => r["authIsFakeKey"] === false);
	const hosts = new Set(reqs.map((r) => hostOf(r)));
	const leaked = [...hosts].filter(
		(h) => h !== "" && !h.startsWith("127.0.0.1"),
	);
	console.info(
		`${v.id}: exit=${res.code} requests=${reqs.length} messages=${msgs.length} authFake=${bad.length === 0} hosts=${[...hosts].join(",")}`,
	);
	if (leaked.length > 0 || bad.length > 0) {
		console.error("UNEXPECTED HOST OR CREDENTIAL");
		return false;
	}
	if (msgs.length === 0) {
		console.warn(
			`  WARNING: no message request. stderr: ${res.se.slice(0, 200)}`,
		);
	}
	if (
		v.pick === "subagent" &&
		!msgs.some((r) => JSON.stringify(bodyOf(r)["messages"]).includes(SUB_MARK))
	) {
		console.warn("  WARNING: no subagent request");
	}
	return true;
};

const writeResult = async (v: Variant, d: Dirs, res: Result): Promise<void> => {
	await Promise.all([
		Bun.write(join(d.dir, "stdout.txt"), res.so),
		Bun.write(join(d.dir, "stderr.txt"), res.se),
		Bun.write(
			join(d.dir, "meta.json"),
			JSON.stringify(
				{ id: v.id, exit: res.code, cwd: d.proj, cfg: d.cfg, home: d.home },
				null,
				1,
			),
		),
	]);
};

const runPrompts = async (
	v: Variant,
	d: Dirs,
	shimDir: string,
	port: number,
): Promise<Result> => {
	const res = await spawnOnce(
		v,
		d,
		shimDir,
		port,
		v.prompt ?? DEFAULT_PROMPT,
		[],
	);
	if (v.followUp === undefined || v.followUp === "") {
		return res;
	}
	// second run in the same folders: gives the follow-up command a conversation to work on
	await Bun.write(join(d.dir, "stdout-first.txt"), res.so);
	return spawnOnce(v, d, shimDir, port, v.followUp, ["--continue"]);
};

/** Capture one variant; false means the run must stop with exit code 8. */
const run = async (v: Variant): Promise<boolean> => {
	const d = await prepare(v);
	const shimDir = await writeSecurityShim(d.home);
	if (v.git === true) {
		await initGit(d);
	}
	const stub = startStub({
		port: Number(process.env["STUB_PORT"] ?? 0),
		log: d.log,
		tool: v.tool?.name,
		toolInput: v.tool?.input,
	});
	const res = await runPrompts(v, d, shimDir, stub.port ?? 0);
	await stub.stop(true);
	await writeResult(v, d, res);
	if (!report(v, res, await readLog(d.log))) {
		return false;
	}
	await Promise.all(
		[d.cfg, d.home, d.proj].map((p) => rm(p, { recursive: true, force: true })),
	);
	return true;
};

/** Run the variants one after the other; each one uses the stub port and the shared captures folder. */
const runAll = async (vs: readonly Variant[]): Promise<boolean> => {
	const [v, ...rest] = vs;
	if (v === undefined) {
		return true;
	}
	if ((only === undefined || only.includes(v.id)) && !(await run(v))) {
		return false;
	}
	return runAll(rest);
};

if (import.meta.main) {
	if (await runAll(VARIANTS)) {
		if (!argv.includes("--no-render")) {
			await import("./render.ts");
		}
	} else {
		process.exitCode = 8;
	}
}
