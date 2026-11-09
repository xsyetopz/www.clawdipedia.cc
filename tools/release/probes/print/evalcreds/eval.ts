import { rm } from "node:fs/promises";

import { PROMPT } from "../../../lib/env.ts";
import type { Data } from "../../../lib/results.ts";
import { arr, dispose, obj, pathExists, type Run, runCase } from "../run.ts";
import type { CaseDef } from "../run/helpers.ts";

export const P = "{PROJ}/plug/cred";
const ARGV = [
	"plugin",
	"eval",
	"{PROJ}/plug",
	"--trust-plugin",
	"--runs",
	"1",
	"--ablation",
	"none",
	"--allow-tools",
	"Bash",
	"--keep-temp",
	"--no-publish",
	"--json",
	"{PROJ}/out.json",
	"--output-dir",
	"{PROJ}/out",
];

export interface Seen {
	r: Run;
	error: string | null;
	files: string[];
	denyRead: string[];
	envVars: string[];
	toolText: string;
}

interface Opts {
	env: Record<string, string>;
	seed?: Record<string, string>;
	cmd?: string;
}

const scrub = (s: string): string =>
	s.replaceAll(/\/\S*\/ccrel-\w+/gu, "<TMP>");

const pick = (v: unknown, key: string): string[] =>
	arr(v).map((e) => String(obj(e)[key]));

type Kept = Pick<Seen, "files" | "denyRead" | "envVars" | "toolText">;

const keptOf = async (kept: string): Promise<Kept> => {
	await Bun.spawn(["chmod", "-R", "u+rwx", kept]).exited;
	const out: Kept = { files: [], denyRead: [], envVars: [], toolText: "" };
	const settings = `${kept}/config/settings.json`;
	if (await pathExists(settings)) {
		const sandbox = obj(
			obj(JSON.parse(await Bun.file(settings).text()))["sandbox"],
		);
		const creds = obj(sandbox["credentials"]);
		out.files = pick(creds["files"], "path");
		out.denyRead = arr(obj(sandbox["filesystem"])["denyRead"]).map(String);
		out.envVars = pick(creds["envVars"], "name");
	}
	const tracePath = `${kept}/out/trace.jsonl`;
	const trace = (await pathExists(tracePath))
		? await Bun.file(tracePath).text()
		: "";
	for (const l of trace.split("\n")) {
		if (l.includes('"tool_result"')) {
			out.toolText = String(
				obj(arr(obj(obj(JSON.parse(l))["message"])["content"])[0])["content"],
			);
		}
	}
	await rm(kept, { recursive: true, force: true });
	return out;
};

const FIXTURE = (o: Opts): Record<string, string> => ({
	".claude-plugin/plugin.json": JSON.stringify({
		name: "ecp",
		version: "1.0.0",
	}),
	"evals/c1/prompt.md": `---\nmax_turns: 3\nallowed_tools: [Bash]\n---\n\n${PROMPT}\n`,
	"evals/c1/graders/used.md": "---\ntype: tool_used\ntool: Bash\n---\n",
	...o.seed,
});

/** One eval run of a fixture plugin whose case makes the stub model call Bash with `cmd`. */
const evalRun = async (bin: string, o: Opts): Promise<Seen> => {
	const r = await runCase(bin, {
		argv: ARGV,
		env: o.env,
		allowOverride: ["GIT_CONFIG_GLOBAL"],
		tool: "Bash",
		toolInput: { command: o.cmd ?? "true" },
		text: "done",
		timeoutMs: 90_000,
		setup: async ({ proj }) => {
			await Promise.all(
				Object.entries(FIXTURE(o)).map(([rel, body]) =>
					Bun.write(`${proj}/plug/${rel}`, body.split("{PROJ}").join(proj)),
				),
			);
		},
	});
	const out = obj(JSON.parse(await Bun.file(`${r.sb.proj}/out.json`).text()));
	const arm = obj(arr(obj(obj(arr(out["cases"])[0])["arms"])["with"])[0]);
	const kept = /kept (\/[^ :]+)/u.exec(r.stderr)?.[1];
	const seen =
		kept === undefined
			? { files: [], denyRead: [], envVars: [], toolText: "" }
			: await keptOf(kept);
	return {
		r,
		error: typeof arm["error"] === "string" ? arm["error"] : null,
		...seen,
	};
};

/** Fixture entries (settings paths, `//` marks an absolute path) that name `name`. */
export const entriesFor = (s: Seen, name: string): string[] =>
	[...new Set([...s.files, ...s.denyRead])]
		.filter((p) => p.includes(`/plug/cred/${name}`))
		.map((p) => p.slice(p.indexOf("/plug/cred/")))
		.toSorted();
export const run = (
	name: string,
	o: Opts,
	data: (s: Seen) => Record<string, Data>,
): CaseDef => ({
	name,
	run: async (ctx) => {
		const s = await evalRun(ctx.bin, o);
		try {
			return {
				from: s.r,
				data: { refused: s.error !== null, ...data(s) },
				samples: { error: scrub(s.error ?? ""), toolResult: scrub(s.toolText) },
			};
		} finally {
			await dispose(s.r);
		}
	},
});

/** Many variables in one run, one entry list for each. */
export const bulk = (
	name: string,
	env: Record<string, string>,
	seed?: Record<string, string>,
): CaseDef =>
	run(name, { env, ...(seed === undefined ? {} : { seed }) }, (s) =>
		Object.fromEntries(
			Object.keys(env).map((k) => [`entries.${k}`, entriesFor(s, k)]),
		),
	);

/** A relative value stops the run; `message` is the predicted reason in the error. */
export const relative = (
	name: string,
	env: Record<string, string>,
	message: string,
): CaseDef =>
	run(`relative.${name}`, { env }, (s) => ({
		matchesPrediction: s.error?.includes(message) ?? false,
	}));

export const bashRead = (name: string, env: Record<string, string>): CaseDef =>
	run(
		name,
		{
			env,
			cmd: `cat ${P}/netrc`,
			seed: { "cred/netrc": "machine example.test login probe\n" },
		},
		(s) => ({
			bashRead: s.toolText.includes("machine example.test"),
			bashDenied: s.toolText.includes("Operation not permitted"),
			entries: entriesFor(s, "netrc"),
		}),
	);

/** Entry lists for the fixture folders `names` (each is a path under cred/). */
export const folders = (s: Seen, dirs: string[]): Record<string, Data> =>
	Object.fromEntries(dirs.map((k) => [`entries.${k}`, entriesFor(s, k)]));

export const refusedWith = (
	s: Seen,
	message: string,
): Record<string, Data> => ({
	matchesPrediction: s.error?.includes(message) ?? false,
});
