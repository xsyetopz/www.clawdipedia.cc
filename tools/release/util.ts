// Small shared helpers for the release toolkit commands (paths, versions, run.json).
// The sandboxed child env, stub, ports and results live in lib/ (task 1.3); nothing here starts the program.
import { mkdir, readdir, readlink } from "node:fs/promises";
import { arch, constants, homedir, platform, release, tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

export const ROOT = join(import.meta.dir, "..", "..");
export const CAPTURES = join(ROOT, "captures");
export const VERSIONS_DIR = join(homedir(), ".local/share/claude/versions");
export const DEFAULT_PROMPT = "Reply with 'OK'.";

export interface Ctx {
	from: string;
	to: string;
	only: string[] | null;
	dry: boolean;
	/** args the command parses itself */
	rest: string[];
}

export const versionDir = (v: string): string => join(CAPTURES, v);
export const binaryPath = (v: string): string => join(VERSIONS_DIR, v);

const cmpVersion = (a: string, b: string): number => {
	const pa = a.split(".").map(Number);
	const pb = b.split(".").map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const d = (pa[i] ?? 0) - (pb[i] ?? 0);
		if (d !== 0) {
			return d;
		}
	}
	return 0;
};

const VERSION_RE = /^\d+\.\d+\.\d+$/u;

export const installedVersions = async (): Promise<string[]> => {
	let names: string[];
	try {
		names = await readdir(VERSIONS_DIR);
	} catch {
		return [];
	}
	return names.filter((n) => VERSION_RE.test(n)).toSorted(cmpVersion);
};

/** The version `~/.local/bin/claude` points at; else the highest one in the versions folder. */
export const installedVersion = async (): Promise<string> => {
	try {
		const target = await readlink(join(homedir(), ".local/bin/claude"));
		const v = target.split("/").pop() ?? "";
		if (VERSION_RE.test(v) && (await Bun.file(binaryPath(v)).exists())) {
			return v;
		}
	} catch {
		// not a symlink or missing: fall through
	}
	const versions = await installedVersions();
	return versions.at(-1) ?? "";
};

/** `--flag value` lookup; removes nothing. A missing value or one that starts with `--` is an error. */
export const argValue = (args: string[], name: string): string | undefined => {
	const i = args.indexOf(name);
	if (i === -1) {
		return undefined;
	}
	const v = args[i + 1];
	if (v === undefined || v.startsWith("--")) {
		throw new Error(`${name} needs a value`);
	}
	return v;
};

const version = (name: string, v: string): string => {
	if (!VERSION_RE.test(v)) {
		throw new Error(`${name} must be x.y.z, got "${v}"`);
	}
	return v;
};

export const parseCtx = async (args: string[]): Promise<Ctx> => {
	const only = argValue(args, "--only");
	const to = argValue(args, "--to");
	return {
		from: version("--from", argValue(args, "--from") ?? CLAUDE_CODE_VERSION),
		to:
			to !== undefined && to !== ""
				? version("--to", to)
				: await installedVersion(),
		only: only !== undefined && only !== "" ? only.split(",") : null,
		dry: args.includes("--dry"),
		rest: args,
	};
};

/** Environment for helper tools such as `strings`: fixed PATH, nothing from the parent but its temp dir. */
export const toolEnv = (): Record<string, string> => ({
	PATH: "/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin",
	HOME: homedir(),
	LC_ALL: "C",
	TMPDIR: tmpdir(),
});

export const writeJson = async (path: string, data: unknown): Promise<void> => {
	await mkdir(dirname(path), { recursive: true });
	await Bun.write(path, `${JSON.stringify(data, null, 2)}\n`);
};

const gitOut = async (args: string[]): Promise<string> => {
	const p = Bun.spawn(["git", ...args], {
		cwd: ROOT,
		env: toolEnv(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, code] = await Promise.all([
		new Response(p.stdout).text(),
		p.exited,
	]);
	return code === 0 ? out.trim() : "";
};

export const toolkitRev = async (): Promise<string> => {
	const rev = await gitOut(["rev-parse", "--short", "HEAD"]);
	const dirty = await gitOut(["status", "--porcelain", "--", "tools/release"]);
	return rev ? `${rev}${dirty ? "+dirty" : ""}` : "unknown";
};

export interface CommandRecord {
	name: string;
	args: string[];
	startedAt: string;
	endedAt: string;
	exit: number;
}

/** Append one command entry to captures/<version>/run.json (creates the file on first use). */
export const recordCommand = async (
	forVersion: string,
	rec: CommandRecord,
): Promise<void> => {
	const path = join(versionDir(forVersion), "run.json");
	const file = Bun.file(path);
	const run: Record<string, unknown> & { commands?: CommandRecord[] } = {};
	if (await file.exists()) {
		const previous: unknown = await file.json();
		Object.assign(run, previous);
	}
	run["version"] ??= forVersion;
	run["startedAt"] ??= rec.startedAt;
	run["toolkitRev"] = await toolkitRev();
	run["host"] = {
		platform: platform(),
		arch: arch(),
		osRelease: release(),
		bun: Bun.version,
	};
	run.commands = [...(run.commands ?? []), rec];
	await writeJson(path, run);
};

/** Exit code of a finished Bun.spawnSync child. A signal kill (exitCode null) is reported, not hidden as 1. */
export const exitCodeOf = (
	step: string,
	r: { exitCode: number | null; signalCode?: string | number | null },
): number => {
	if (r.exitCode !== null) {
		return r.exitCode;
	}
	const sig = r.signalCode;
	const signals: Record<string, number> = constants.signals;
	const n = typeof sig === "number" ? sig : (signals[sig ?? ""] ?? 0);
	console.error(`${step} killed by ${sig ?? "unknown signal"}`);
	return 128 + n;
};
