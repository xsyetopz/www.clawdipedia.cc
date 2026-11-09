// The temp folders, environment, and files that `runArgs` (run.ts) gives the program, so that it touches nothing of the user.
import { chmod, mkdir, mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import type { Servers } from "./apihost.ts";
import { FAKE_KEY } from "./stub.ts";

export interface Dirs {
	home: string;
	config: string;
	project: string;
}
/** What a run starts and must undo: its servers and its temp folders. */
export interface Cleanup extends Servers {
	made: string[];
}

// Names that name a credential, or that could send a request past the stub and the dead proxy.
const UNSAFE =
	/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|SESSION|PROXY|BASE_URL|ENDPOINT|HEADERS|^(NODE|BUN)_OPTIONS$|^(LD|DYLD)_/iu;
const tempDir = async (p: string) => realpath(await mkdtemp(join(tmpdir(), p)));

export const makeShim = async (home: string): Promise<string> => {
	const shim = join(home, ".probe-bin");
	await mkdir(shim);
	await Bun.write(
		join(shim, "security"),
		'#!/bin/sh\n[ "$1" = "-i" ] && cat >/dev/null\nexit 44\n',
	);
	await chmod(join(shim, "security"), 0o755);
	return shim;
};

export const checkEnv = (
	env: Record<string, string>,
	fixed: Record<string, string>,
): void => {
	for (const [k, v] of Object.entries(env)) {
		if (k.toUpperCase() in fixed || UNSAFE.test(k) || v.includes("sk-ant-")) {
			throw new Error(
				`env ${k} is not allowed: run fixes it, or it could carry a credential or route a request`,
			);
		}
	}
};

export const writeInputs = async (
	dirs: Dirs,
	login: "key" | "oauth",
	files: Record<string, string>,
): Promise<void> => {
	if (login === "oauth") {
		await Bun.write(
			join(dirs.config, ".credentials.json"),
			JSON.stringify({
				claudeAiOauth: {
					accessToken: FAKE_KEY,
					refreshToken: FAKE_KEY,
					expiresAt: Date.now() + 86_400_000,
					scopes: ["user:inference", "user:profile"],
					subscriptionType: null,
				},
			}),
		);
	}
	await Promise.all(
		Object.entries(files).map(async ([name, body]) => {
			await mkdir(dirname(join(dirs.project, name)), { recursive: true });
			await Bun.write(join(dirs.project, name), body);
		}),
	);
};

export const fixedEnv = (
	dirs: Dirs,
	shim: string,
	net: { proxyUrl: string; ca: string | undefined },
	{ login, baseUrl, self }: { login: string; baseUrl: boolean; self: string },
): Record<string, string> => ({
	PATH: `${shim}:${process.env["PATH"] ?? ""}`,
	HOME: dirs.home,
	TMPDIR: tmpdir(),
	CLAUDE_CONFIG_DIR: dirs.config,
	...(login === "key" && { ANTHROPIC_API_KEY: FAKE_KEY }),
	...(baseUrl && { ANTHROPIC_BASE_URL: `http://${self}` }),
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
	DISABLE_TELEMETRY: "1",
	HTTPS_PROXY: net.proxyUrl,
	HTTP_PROXY: net.proxyUrl,
	NO_PROXY: "127.0.0.1,localhost",
	// The AWS SDK reaches 169.254.169.254 directly, not through the proxy.
	AWS_EC2_METADATA_DISABLED: "true",
	...(net.ca !== undefined && { NODE_EXTRA_CA_CERTS: net.ca }),
});

export const mk = async (state: Cleanup, p: string): Promise<string> => {
	const d = await tempDir(p);
	state.made.push(d);
	return d;
};

export const makeDirs = async (state: Cleanup): Promise<Dirs> => ({
	home: await mk(state, "cc-run-home-"),
	config: await mk(state, "cc-run-cfg-"),
	project: await mk(state, "cc-run-proj-"),
});

export const argvOf = (bin: string, args: string[], dirs: Dirs): string[] => [
	bin,
	...args.map((a) =>
		a
			.replaceAll("<project-dir>", dirs.project)
			.replaceAll("<config-dir>", dirs.config),
	),
];

export const stubEnv = (
	env: Record<string, string>,
	self: string,
): Record<string, string> =>
	Object.fromEntries(
		Object.entries(env).map(([k, v]) => [
			k,
			v.replaceAll("<stub>", `http://${self}`),
		]),
	);
