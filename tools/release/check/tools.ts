// The tool and binary checks of release:check.
import { pathExists } from "../lib/fs.ts";
import { binaryPath, toolEnv } from "../util.ts";

export type Level = "ok" | "warn" | "fail";
export interface Check {
	id: string;
	level: Level;
	detail: string;
}

const run = async (argv: string[]): Promise<{ ok: boolean; out: string }> => {
	try {
		const p = Bun.spawn(argv, {
			env: toolEnv(),
			stdin: "ignore",
			stdout: "pipe",
			stderr: "pipe",
		});
		const [stdout, stderr, code] = await Promise.all([
			new Response(p.stdout).text(),
			new Response(p.stderr).text(),
			p.exited,
		]);
		return { ok: code === 0, out: `${stdout}${stderr}`.trim() };
	} catch {
		return { ok: false, out: "not found" };
	}
};

const outOf = async (argv: string[]): Promise<string> => {
	const r = await run(argv);
	return r.out;
};

const which = async (name: string): Promise<string> => {
	const r = await run(["/usr/bin/which", name]);
	return r.ok ? r.out : "";
};

export const binaryChecks = async (
	from: string,
	to: string,
	installed: string[],
): Promise<Check[]> => {
	const bin = binaryPath(to);
	const hasTo = await pathExists(bin);
	const hasFrom = await pathExists(binaryPath(from));
	return [
		{
			id: "binary.to",
			level: hasTo ? "ok" : "fail",
			detail: hasTo
				? bin
				: `missing ${bin}; the user must install ${to} (installed: ${installed.length > 0 ? installed.join(", ") : "none"})`,
		},
		{
			id: "binary.from",
			level: hasFrom ? "ok" : "warn",
			detail: hasFrom
				? binaryPath(from)
				: `missing ${binaryPath(from)}; release:diff needs it`,
		},
	];
};

/** The python3, strings and openssl checks; `python` is the python version text for env.json. */
export const toolChecks = async (): Promise<{
	checks: Check[];
	python: string;
}> => {
	const py = await which("python3");
	const pyv = py === "" ? "" : await outOf([py, "--version"]);
	const pym = /(\d+)\.(\d+)/u.exec(pyv);
	const pyOk = pym !== null && Number(pym[1]) * 100 + Number(pym[2]) >= 308;
	const st = await which("strings");
	const ssl = await which("openssl");
	const sslVersion = ssl === "" ? "" : await outOf([ssl, "version"]);
	return {
		python: pyv,
		checks: [
			{
				id: "python3",
				level: pyOk ? "ok" : "fail",
				detail:
					py === ""
						? "python3 not found"
						: `${py} (${pyv}); the pty driver needs 3.8+`,
			},
			{
				id: "strings",
				level: st === "" ? "fail" : "ok",
				detail: st === "" ? "strings not found" : st,
			},
			{
				id: "openssl",
				level: ssl === "" ? "warn" : "ok",
				detail:
					ssl === ""
						? "openssl not found; only live fault tests need it"
						: `${ssl} (${sslVersion}); only live fault tests need it`,
			},
		],
	};
};
