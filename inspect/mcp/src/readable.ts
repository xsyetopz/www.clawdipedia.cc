// The optional reading view of one module: Wakaru (`@wakaru/cli`) run on its cleaned source, cached beside the clean cache.
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { prepared } from "./prepare.ts";

/** The command that runs Wakaru; `CC_INSPECT_WAKARU` replaces it (a stub in tests). */
const wakaru = (): string[] =>
	(process.env["CC_INSPECT_WAKARU"] ?? "bunx @wakaru/cli@1.14.0")
		.split(/\s+/u)
		.filter(Boolean);

/**
 * The Wakaru text of a module, from `<clean dir>/readable/<module>` when it is there, else made by one run of Wakaru
 * on `<clean dir>/modules/<module>` and written to that path. Wakaru runs in a temp folder with only `PATH` and `HOME`.
 */
export const readable = async (
	binary: string | undefined,
	module: string,
): Promise<string> => {
	const { dir, index } = await prepared(binary);
	const name = basename(module);
	const input = join(dir, "modules", name);
	const file = join(dir, "readable", name);
	const cached = Bun.file(file);
	if (await cached.exists()) {
		return cached.text();
	}
	if (!(await Bun.file(input).exists())) {
		throw new Error(
			`"${name}" has no cleaned source (${index.skipped[name] ?? "it is not JavaScript"})`,
		);
	}
	const cwd = await mkdtemp(join(tmpdir(), "cc-inspect-wakaru-"));
	try {
		const p = Bun.spawn([...wakaru(), "--formatter", input], {
			cwd,
			env: {
				PATH: process.env["PATH"] ?? "",
				HOME: process.env["HOME"] ?? "",
			},
			stdout: "pipe",
			stderr: "pipe",
			timeout: 120_000,
		});
		const [out, err, code] = await Promise.all([
			new Response(p.stdout).text(),
			new Response(p.stderr).text(),
			p.exited,
		]);
		if (code !== 0) {
			throw new Error(`wakaru failed (exit ${code}): ${err.slice(0, 300)}`);
		}
		if (!out.trim()) {
			throw new Error("wakaru printed nothing");
		}
		await mkdir(join(dir, "readable"), { recursive: true });
		await Bun.write(`${file}.${process.pid}.tmp`, out);
		await rename(`${file}.${process.pid}.tmp`, file);
		return out;
	} finally {
		await rm(cwd, { recursive: true, force: true });
	}
};
