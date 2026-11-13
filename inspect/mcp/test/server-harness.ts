// Shared setup for the server-*.test.ts files: each file gets its own config dir, fixture binary, and server.
// Needs inspect/mcp/dist/server.js; part of plugin:check.
// Builds a small Bun single-file executable as the "Claude Code" binary, and a config dir with one session.
import { afterAll, beforeAll } from "bun:test";
import { access, chmod, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { z } from "zod";

const SERVER = join(import.meta.dir, "..", "dist", "server.js");
export const SESSION = "11111111-2222-3333-4444-555555555555";

/** The program the fixture binary holds: an event emitter and two calls of it, minified by the build. */
export const APP = `
const base = () => ({ "session.id": "s" });
export async function emit(name, attrs) {
  globalThis.out = { ...base(), "event.name": name, "event.sequence": 1, ...attrs };
}
const extra = (x) => ({ "tool.kind": x ? "a" : "b" });
emit("tool_result", { tool_name: "Bash", success: "true", ...extra(globalThis.x) });
emit("tool_result", { tool_name: "Read", duration_ms: 5 });
emit("api_error", { status: 500 });
const build = (d) => ({ isEnabled: () => true, ...d });
const Glob = build({ name: "Glob" });
const Grep = build({ name: "Grep", isEnabled() { return process.env.GREP === "1"; } });
const Shell = build({ name: "Shell" });
const Cron = build({ name: "CronCreate" });
const off = () => null;
function lean() { return process.env.LEAN === "1"; }
function hidden() { return lean() ? new Set(["Glob"]) : new Set(); }
function allTools() {
  const o = off();
  return [Shell, ...[Glob, Grep].filter((t) => !hidden().has(t.name)), ...(lean() ? [Cron] : []), ...(o ? [o] : [])];
}
globalThis.api = { getAllBaseTools: allTools };
globalThis.envs = [process.env.CLAUDE_CODE_USE_BEDROCK, process.env.ANTHROPIC_BEDROCK_BASE_URL, process.env.FIXTURE_OTHER];
`;

/** 400 env reads with 150-character names: one page of them is over the reply cap. */
const LONG_ENV = Array.from(
	{ length: 400 },
	(_, i) =>
		`process.env.FIXTURE_LONG_${String(i).padStart(3, "0")}_${"X".repeat(130)}`,
).join(",");

const LINES = [
	{ type: "custom-title", customTitle: "Fixture", sessionId: SESSION },
	// 2.1.323 writes `explicit` from a parameter, so the schema leaves it untyped.
	{ type: "last-prompt", lastPrompt: 5, sessionId: SESSION },
	{ type: "no-such-type" },
];

const ResultSchema = z.object({
	content: z.array(z.object({ type: z.string(), text: z.string() })),
	structuredContent: z.record(z.string(), z.unknown()).optional(),
	isError: z.boolean().optional(),
});

export type Result = z.infer<typeof ResultSchema>;

/** Compares strings by code unit, as the default `sort` does. */
export const byCode = (a: string, b: string) => Number(a > b) - Number(a < b);

/** Sorts a copy of the strings by code unit. */
export const sorted = (xs: string[]) => xs.toSorted(byCode);

/** The text of the first content item, or an empty string. */
export const text = (r: Result) => r.content[0]?.text ?? "";

/** The structured content of a reply, or an empty object. */
export const structured = (r: Result) => r.structuredContent ?? {};

/** What the model sees: the structured content when set, else the text. */
export const seen = (r: Result) =>
	r.structuredContent ? JSON.stringify(r.structuredContent) : text(r);

/** Reads one structured field as an array of items that match the schema. */
export const listOf = <T extends z.ZodType>(
	r: Result,
	key: string,
	item: T,
): z.infer<T>[] => z.array(item).parse(structured(r)[key] ?? []);

/** Reads one structured field as an object with string keys. */
export const recordOf = (r: Result, key: string) =>
	z.record(z.string(), z.unknown()).parse(structured(r)[key]);

/** The item at an index; fails the test run when it is missing. */
export const at = <T>(xs: readonly T[], i: number): T => {
	const v = xs[i];
	if (v === undefined) {
		throw new Error(`no item at ${i} of ${xs.length}`);
	}
	return v;
};

/** Whether a path exists, a file or a folder. */
export const exists = async (path: string) => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};

/** Builds a Bun single-file executable from a module, and fails with the build's stderr. */
export const compile = async (entry: string, outfile: string) => {
	const proc = Bun.spawn(
		["bun", "build", "--compile", "--minify", entry, `--outfile=${outfile}`],
		{ stderr: "pipe", stdout: "ignore" },
	);
	const [err, code] = await Promise.all([
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (code !== 0) {
		throw new Error(err);
	}
};

const STUB = (tmp: string) =>
	`#!/bin/sh\necho run >> "${tmp}/wakaru-runs"\nenv > "${tmp}/wakaru-env"\npwd > "${tmp}/wakaru-cwd"\ntouch out\n[ -e "${tmp}/wakaru-fail" ] && { echo "stub broke" >&2; exit 3; }\n[ -e "${tmp}/wakaru-empty" ] && exit 0\n[ -e "${tmp}/wakaru-slow" ] && sleep 2\necho "// readable: $*"\nfor last; do :; done\ncat "$last"\n`;

const writeFixtures = async (tmp: string, config: string, versions: string) => {
	const project = join(config, "projects", "-tmp-demo");
	await mkdir(project, { recursive: true });
	await writeFile(
		join(project, `${SESSION}.jsonl`),
		`${LINES.map((l) => JSON.stringify(l)).join("\n")}\nnot json\n`,
	);
	await mkdir(versions);
	await writeFile(
		join(tmp, "app.mjs"),
		`${APP}\nglobalThis.longs = [${LONG_ENV}];\nexport * from ${JSON.stringify(join(import.meta.dir, "fixtures/clean-app.ts"))};\n`,
	);
	await compile(join(tmp, "app.mjs"), join(tmp, "app.js"));
	await symlink(join(tmp, "app.js"), join(versions, "9.9.9"));
	// Stands in for `bunx @wakaru/cli@1.14.0`: counts its runs, records its env and cwd and leaves a file there,
	// fails while `wakaru-fail` exists, prints nothing while `wakaru-empty` exists, waits while `wakaru-slow` exists,
	// else prints a marker and the input.
	await writeFile(join(tmp, "wakaru-stub"), STUB(tmp));
	await chmod(join(tmp, "wakaru-stub"), 0o755);
};

const serverEnv = (tmp: string, config: string, versions: string) => {
	const env: Record<string, string> = {};
	for (const [k, v] of Object.entries(process.env)) {
		if (v !== undefined) {
			env[k] = v;
		}
	}
	return {
		...env,
		CLAUDE_CONFIG_DIR: config,
		CC_INSPECT_VERSIONS_DIR: versions,
		CC_INSPECT_LAUNCHER: join(tmp, "no-launcher"),
		CC_INSPECT_CACHE: join(tmp, "cache"),
		CC_INSPECT_WAKARU: join(tmp, "wakaru-stub"),
		CC_INSPECT_TEST_SECRET: "do-not-pass",
	};
};

/** Registers the setup and teardown hooks of the calling file and gives it the server's client. `extra` adds to the server's environment. */
export const startServer = (extra: Record<string, string> = {}) => {
	const tmp = join(tmpdir(), `cc-inspect-test-${crypto.randomUUID()}`);
	const config = join(tmp, "config");
	const versions = join(tmp, "versions");
	const client = new Client({ name: "test", version: "0" });
	const call = async (name: string, args: Record<string, unknown> = {}) =>
		ResultSchema.parse(await client.callTool({ name, arguments: args }));

	beforeAll(async () => {
		await mkdir(tmp, { recursive: true });
		await writeFixtures(tmp, config, versions);
		await client.connect(
			new StdioClientTransport({
				command: "bun",
				args: [SERVER],
				env: { ...serverEnv(tmp, config, versions), ...extra },
			}),
		);
	}, 60_000);

	afterAll(async () => {
		await client.close();
		await rm(tmp, { recursive: true, force: true });
	});

	return { tmp, client, call };
};
