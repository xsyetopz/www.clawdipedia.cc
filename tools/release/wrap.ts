// release:schemas and release:prompts - thin wrappers over the existing generators.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { pathExists } from "./lib/fs.ts";
import {
	binaryPath,
	type Ctx,
	DEFAULT_PROMPT,
	exitCodeOf,
	ROOT,
	toolEnv,
	versionDir,
	writeJson,
} from "./util.ts";

const bunPath = process.execPath;
const clean = (extra: Record<string, string> = {}): Record<string, string> => ({
	...toolEnv(),
	PATH: `${bunPath.slice(0, bunPath.lastIndexOf("/"))}:${toolEnv()["PATH"]}`,
	...extra,
});

const needBinary = async (v: string): Promise<string> => {
	const bin = binaryPath(v);
	if (v === "" || !(await pathExists(bin))) {
		throw new Error(`no binary for ${v === "" ? "--to" : v}`);
	}
	return bin;
};

// ---- schema diff -------------------------------------------------------------------------------------------

/** Flatten JSON to `path -> compact leaf` so two schemas can be compared key by key. */
const flatten = (v: unknown, path = "", out = new Map<string, string>()) => {
	if (v !== null && typeof v === "object") {
		const entries = Array.isArray(v)
			? v.map((x, i) => [String(i), x] as const)
			: Object.entries(v);
		if (entries.length === 0) {
			out.set(path, Array.isArray(v) ? "[]" : "{}");
		}
		for (const [k, x] of entries) {
			flatten(x, path ? `${path}.${k}` : k, out);
		}
	} else {
		out.set(path, JSON.stringify(v));
	}
	return out;
};
const cut = (s: string) => (s.length > 200 ? `${s.slice(0, 200)}...` : s);

export const diffJson = (oldText: string | null, newText: string | null) => {
	const a =
		oldText !== null && oldText !== ""
			? flatten(JSON.parse(oldText))
			: new Map<string, string>();
	const b =
		newText !== null && newText !== ""
			? flatten(JSON.parse(newText))
			: new Map<string, string>();
	return {
		added: [...b.keys()].filter((k) => !a.has(k)),
		removed: [...a.keys()].filter((k) => !b.has(k)),
		changed: [...b]
			.filter(([k, v]) => a.has(k) && a.get(k) !== v)
			.map(([path, v]) => ({ path, old: cut(a.get(path) ?? ""), new: cut(v) })),
	};
};

export const gitHead = async (rel: string): Promise<string | null> => {
	const p = Bun.spawn(["git", "show", `HEAD:${rel}`], {
		cwd: ROOT,
		env: toolEnv(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, code] = await Promise.all([
		new Response(p.stdout).text(),
		p.exited,
	]);
	return code === 0 ? out : null;
};

/** Runs a child with inherited stdio and returns its exit code. */
const runInherit = async (step: string, argv: string[]): Promise<number> => {
	const p = Bun.spawn(argv, {
		cwd: ROOT,
		env: clean(),
		stdout: "inherit",
		stderr: "inherit",
	});
	await p.exited;
	return exitCodeOf(step, p);
};

const gitTypesDiff = async (): Promise<string> => {
	const p = Bun.spawn(["git", "diff", "--", "schemas/claude-code.d.ts"], {
		cwd: ROOT,
		env: toolEnv(),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out] = await Promise.all([new Response(p.stdout).text(), p.exited]);
	return out;
};

const schemaNames = async (dir: string): Promise<string[]> => {
	if (!(await pathExists(dir))) {
		return [];
	}
	const names = await readdir(dir);
	return names.filter((n) => n.endsWith(".json"));
};

const reportSchemas = async (
	dir: string,
	before: Map<string, string | null>,
): Promise<Record<string, ReturnType<typeof diffJson>>> => {
	const names = await readdir(dir);
	const entries = await Promise.all(
		names
			.filter((x) => x.endsWith(".json"))
			.map(async (n) => {
				const d = diffJson(
					before.get(n) ?? (await gitHead(`schemas/${n}`)),
					await Bun.file(join(dir, n)).text(),
				);
				return [n, d] as const;
			}),
	);
	for (const [n, d] of entries) {
		console.info(
			`  ${n}: +${d.added.length} -${d.removed.length} ~${d.changed.length}`,
		);
	}
	return Object.fromEntries(entries);
};

/**
 * The generators of `schemas/`, in order. `code.ts` reads the probes of `from`, because the probes of the new
 * version run after this step: with none, it would drop every `x-observed` mark and bury the code changes.
 */
export const schemaGenerators = (bin: string, from: string): string[][] => [
	[bunPath, "tools/schemas/generate.ts", "--bin", bin],
	[
		bunPath,
		"tools/schemas/code.ts",
		"--bin",
		bin,
		"--captures",
		versionDir(from),
	],
	// The Mod API type file: a text diff against git HEAD, kept beside the schema diff.
	[bunPath, "tools/schemas/types.ts", "--bin", bin],
];

/** Runs each command after the last one exits 0, because code.ts reads the stream-json schema generate.ts writes. */
const runInOrder = async ([argv, ...rest]: string[][]): Promise<number> => {
	if (argv === undefined) {
		return 0;
	}
	const code = await runInherit("release:schemas", argv);
	return code === 0 ? runInOrder(rest) : code;
};

export const runSchemas = async (ctx: Ctx): Promise<number> => {
	const bin = await needBinary(ctx.to);
	const scripts = schemaGenerators(bin, ctx.from);
	if (CLAUDE_CODE_VERSION !== ctx.to) {
		console.warn(
			`warning: the generator stamps src/version.ts (${CLAUDE_CODE_VERSION}) into the schemas, not --to ${ctx.to}. Bump src/version.ts before committing them.`,
		);
	}
	for (const argv of scripts) {
		console.info(`release:schemas -> ${argv.slice(1).join(" ")}`);
	}
	if (ctx.dry) {
		return 0;
	}
	const dir = join(ROOT, "schemas");
	const files = await schemaNames(dir);
	const before = new Map(
		await Promise.all(
			files.map(async (n) => [n, await gitHead(`schemas/${n}`)] as const),
		),
	);
	const code = await runInOrder(scripts);
	if (code !== 0) {
		return code;
	}
	const typesDiff = await gitTypesDiff();
	await Bun.write(join(versionDir(ctx.to), "types.diff"), typesDiff);
	console.info(
		`  claude-code.d.ts: ${typesDiff.split("\n").filter((l) => /^[+-][^+-]/u.test(l)).length} changed lines (types.diff)`,
	);
	const report = await reportSchemas(dir, before);
	await writeJson(join(versionDir(ctx.to), "schemas-diff.json"), {
		from: "git HEAD",
		to: ctx.to,
		note: "old = schemas/ at git HEAD, new = schemas/ after generation. The generator stamps src/version.ts, not --to.",
		files: report,
	});
	console.info("  next: bun run schemas:check");
	return 0;
};

// ---- prompts -----------------------------------------------------------------------------------------------

export const runPrompts = async (ctx: Ctx): Promise<number> => {
	const bin = await needBinary(ctx.to);
	const out = join(versionDir(ctx.to), "prompts");
	const argv = [
		bunPath,
		"tools/capture-prompts/capture.ts",
		"--bin",
		bin,
		"--out",
		out,
	];
	if (ctx.only) {
		argv.push("--only", ctx.only.join(","));
	}
	// render.ts rewrites docs/prompts from all variants and deletes pages of missing ones: never render a subset
	if (ctx.rest.includes("--no-render") || ctx.only) {
		argv.push("--no-render");
	}
	console.info(`release:prompts (default prompt: ${DEFAULT_PROMPT})`);
	console.info(`  ${argv.slice(1).join(" ")}`);
	if (ctx.dry) {
		return 0;
	}
	return runInherit("release:prompts", argv);
};
