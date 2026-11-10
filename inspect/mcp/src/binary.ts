// Claude Code installs and the modules inside each binary. A binary is read once and kept.
import { access, readdir, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import { Bundle } from "./ast.ts";
import { type BunModule, extractModules } from "./bunfs.ts";
import { Resolver } from "./resolve.ts";

export interface Install {
	version: string;
	path: string;
	current: boolean;
}

const envOr = (name: string, fallback: string): string => {
	const v = process.env[name];
	return v === undefined || v === "" ? fallback : v;
};
const versionsDir = () =>
	envOr(
		"CC_INSPECT_VERSIONS_DIR",
		join(homedir(), ".local/share/claude/versions"),
	);
const launcher = () =>
	envOr("CC_INSPECT_LAUNCHER", join(homedir(), ".local/bin/claude"));

const exists = async (p: string): Promise<boolean> => {
	try {
		await access(p);
		return true;
	} catch {
		return false;
	}
};

const semver = (v: string) =>
	v.split(".").map((x) => Number(/^\d+/u.exec(x)?.[0]));
const newer = (a: string, b: string) => {
	const [x, y] = [semver(a), semver(b)];
	for (let i = 0; i < 3; i++) {
		if ((x[i] ?? 0) !== (y[i] ?? 0)) {
			return (y[i] ?? 0) - (x[i] ?? 0);
		}
	}
	return 0;
};

const installsIn = async (dir: string, cur: string): Promise<Install[]> => {
	const names = await readdir(dir);
	const paths = names
		.filter((v) => /^\d+\.\d+\.\d+/u.test(v))
		.map((v) => join(dir, v));
	const found = await Promise.all(
		paths.map(async (p) => {
			const info = await stat(p);
			if (!info.isFile()) {
				return null;
			}
			return {
				version: basename(p),
				path: p,
				current: (await realpath(p)) === cur,
			};
		}),
	);
	return found.filter((i) => i !== null);
};

/** Installed versions, newest first. `current` is the one the `claude` launcher points to. */
export const listInstalls = async (): Promise<Install[]> => {
	const dir = versionsDir();
	const launch = launcher();
	const cur = (await exists(launch)) ? await realpath(launch) : "";
	const out = (await exists(dir)) ? await installsIn(dir, cur) : [];
	if (cur !== "" && !out.some((i) => i.current)) {
		out.push({ version: basename(cur), path: cur, current: true });
	}
	return out.toSorted((a, b) => newer(a.version, b.version));
};

/** The binary for a version or a path; by default the current install, else the newest. */
export const binaryPath = async (binary?: string): Promise<string> => {
	const named = binary === "" ? undefined : binary;
	if (named !== undefined && (await exists(named))) {
		return named;
	}
	const all = await listInstalls();
	const hit =
		named === undefined
			? (all.find((i) => i.current) ?? all[0])
			: all.find((i) => i.version === named);
	if (!hit) {
		throw new Error(
			named === undefined
				? `no Claude Code install under ${versionsDir()}`
				: `no install "${named}"; installed: ${all.map((i) => i.version).join(", ") || "none"}`,
		);
	}
	return hit.path;
};

export interface Program {
	path: string;
	modules: BunModule[];
	/** The parsed JS modules. The first call parses them, so an action that reads only text does not pay for it. */
	bundle: () => Promise<Bundle>;
	resolver: Resolver;
}
const programs = new Map<string, Program>();

export const program = async (binary?: string): Promise<Program> => {
	const path = await binaryPath(binary);
	let p = programs.get(path);
	if (!p) {
		const { modules } = await extractModules(path);
		let bundle: Promise<Bundle> | undefined;
		p = {
			path,
			modules,
			bundle: () => {
				bundle ??= Bundle.parse(
					modules
						.filter((m) => /\.m?js$/u.test(m.name))
						.map((m) => ({ name: m.name, text: m.source })),
				);
				return bundle;
			},
			resolver: new Resolver(),
		};
		programs.set(path, p);
	}
	return p;
};
