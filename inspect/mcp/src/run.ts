// Runs the program once, in print mode or with other args, against a local fake Messages API and keeps each request it sends.
// Free: a fake key, a dead proxy for any request that skips the stub, a temp HOME, config dir, and project,
// and a `security` shim on PATH, since with a temp HOME macOS would show a "Keychain Not Found" dialog.
import { rm } from "node:fs/promises";
import { isAbsolute, normalize } from "node:path";

import { API_HOST, startApiHost } from "./apihost.ts";
import type { Finished } from "./child.ts";
import { eventsOf, spawnProgram, timeoutMessage } from "./child.ts";
import { filesOf } from "./requests.ts";
import {
	argvOf,
	checkEnv,
	fixedEnv,
	makeDirs,
	makeShim,
	mk,
	stubEnv,
	writeInputs,
} from "./sandbox.ts";
import type { Cleanup, Dirs } from "./sandbox.ts";
import { makeAnswer } from "./stub.ts";
import type { Sent, Tool } from "./stub.ts";

export type { Dirs } from "./sandbox.ts";
export { API_HOST } from "./apihost.ts";
export { FAKE_KEY } from "./stub.ts";
export type { Sent } from "./stub.ts";
export { userText } from "./usertext.ts";

export interface RunResult {
	exit: number;
	requests: Sent[];
	stdout: string;
	stderr: string;
	/** The stream-json events the program wrote to stdout. */
	events: Record<string, unknown>[];
	/** The `.json`, `.jsonl`, and `.log` files of the config folder at exit, such as the transcript. */
	files: Record<string, string>;
	/** The same for the project folder, where a relative path such as `--debug-file d.log` lands. */
	projectFiles: Record<string, string>;
	dirs: Dirs;
}

interface RunOptions {
	/** Text for the program's stdin, such as stream-json user messages; without it stdin is closed. */
	input?: string;
	timeoutMs?: number;
	env?: Record<string, string>;
	files?: Record<string, string>;
	/** Stub replies by `METHOD /path` (no query), such as `GET /api/oauth/profile`. */
	replies?: Record<string, unknown>;
	/** `oauth`: a claude.ai login in `.credentials.json` whose token is the fake key, and no API key. */
	login?: "key" | "oauth";
	/**
	 * The stub also answers `https://api.anthropic.com`, for requests whose base URL no setting changes
	 * (the OAuth profile). A CONNECT proxy sends that host to a TLS copy of the stub with a throw-away CA;
	 * it refuses every other host.
	 */
	apiHost?: boolean;
	/** `false` leaves `ANTHROPIC_BASE_URL` unset, so that with `apiHost` the Messages API requests also go to `https://api.anthropic.com`. */
	baseUrl?: boolean;
	/** The model calls these tools in order, one per turn, such as `[{ name: "Bash", input: { command: "echo hi" } }]`. `safeguard` adds the server-side auto mode verdict for the call. */
	calls?: Tool[];
	/** `vertex`: the program runs as a Vertex AI client whose base URL is the stub, with a fake project and no Google sign-in. */
	provider?: "vertex";
	/** The stub answers each Messages API call that asks for `speed: "fast"` with this HTTP status, as a provider that refuses fast mode. */
	fastRefusal?: number;
}

/**
 * Run `prompt` (a slash command such as `/verify ARG`, or plain text) with `-p`, and return what the program sent.
 * Throws when a request has another host or key, or when the program does not end in `timeoutMs`.
 * The folders in `dirs` are removed before it returns.
 */
export const runPrompt = (
	bin: string,
	prompt: string,
	model = "claude-opus-5-5",
	timeoutMs = 60_000,
	env: Record<string, string> = {},
): Promise<RunResult> =>
	runArgs(
		bin,
		[
			"-p",
			prompt,
			"--output-format",
			"stream-json",
			"--verbose",
			"--model",
			model,
		],
		{ timeoutMs, env },
	);

const assertHosts = (
	requests: Sent[],
	self: string,
	apiHost: boolean,
): void => {
	const bad = requests.filter(
		(r) =>
			r.fakeKey === false ||
			(r.host !== self && !(apiHost && r.host === API_HOST)),
	);
	if (bad.length > 0) {
		throw new Error(
			`a request had another host or key: ${bad.map((r) => `${r.host}${r.path}`).join(", ")}`,
		);
	}
};

const startStub = (
	state: Cleanup,
	answer: (req: Request) => Promise<Response>,
): string => {
	state.stub = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: answer });
	return `127.0.0.1:${state.stub.port}`;
};

// Fail closed: a request that skips the stub goes to a dead proxy.
const startNet = async (
	state: Cleanup,
	answer: (req: Request) => Promise<Response>,
	apiHost: boolean,
): Promise<{ proxyUrl: string; ca: string | undefined }> =>
	apiHost
		? startApiHost(state, answer, await mk(state, "cc-run-pki-"))
		: { proxyUrl: "http://127.0.0.1:9", ca: undefined };

const resultOf = async (
	done: Finished,
	events: Record<string, unknown>[],
	requests: Sent[],
	dirs: Dirs,
): Promise<RunResult> => ({
	exit: done.exit,
	requests,
	stdout: done.out,
	stderr: done.stderr,
	events,
	files: await filesOf(dirs.config),
	projectFiles: await filesOf(dirs.project),
	dirs,
});

const execute = async (
	bin: string,
	args: string[],
	options: RunOptions,
	state: Cleanup,
): Promise<RunResult> => {
	const {
		timeoutMs = 60_000,
		env = {},
		files = {},
		replies = {},
		login = "key",
		apiHost = false,
		baseUrl = true,
		calls,
		input,
		provider,
		fastRefusal,
	} = options;
	const dirs = await makeDirs(state);
	const requests: Sent[] = [];
	const answer = makeAnswer(requests, calls, replies, fastRefusal);
	const self = startStub(state, answer);
	const net = await startNet(state, answer, apiHost);
	const fixed = fixedEnv(dirs, await makeShim(dirs.home), net, {
		login,
		baseUrl,
		self,
		provider,
	});
	checkEnv(env, fixed);
	await writeInputs(dirs, login, files);
	const done = await spawnProgram(
		argvOf(bin, args, dirs),
		dirs.project,
		{ ...fixed, ...stubEnv(env, self) },
		input,
		timeoutMs,
	);
	const events = eventsOf(done.out);
	if (done.timedOut) {
		throw new Error(timeoutMessage(timeoutMs, events, done.stderr));
	}
	assertHosts(requests, self, apiHost);
	return resultOf(done, events, requests, dirs);
};

/**
 * Run the program with `args`, such as a subcommand, in the same safe setup as `runPrompt`.
 * `files` are written in the project folder first. `<project-dir>` and `<config-dir>` in an arg become their paths.
 */
export const runArgs = async (
	bin: string,
	args: string[],
	options: RunOptions = {},
): Promise<RunResult> => {
	for (const name of Object.keys(options.files ?? {})) {
		if (isAbsolute(name) || normalize(name).startsWith("..")) {
			throw new Error(`file ${name} is outside the project`);
		}
	}
	const state: Cleanup = { made: [] };
	try {
		return await execute(bin, args, options, state);
	} finally {
		await state.stub?.stop(true);
		await state.tls?.stop(true);
		state.proxy?.close();
		state.proxy?.closeAllConnections();
		await Promise.all(
			state.made.map((d) => rm(d, { recursive: true, force: true })),
		);
	}
};
