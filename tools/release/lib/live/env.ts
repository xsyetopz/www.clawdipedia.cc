// The explicit live-run env: the one place where CLAUDE_CODE_OAUTH_TOKEN may reach a child.
// env.ts stays strict (childEnv never allows "oauth"). The token is only read from process.env, which is
// clean on purpose: the whole runner is started by tools/release/secret-runner.sh under `env -i`.
import { dirname, join } from "node:path";

import { CREDENTIAL_NAME, NON_SECRET_NAMES, SYSTEM_PATH } from "../env.ts";
import { registerSecret } from "../results.ts";
import { shimDir } from "../shim.ts";

const TOKEN_VAR = "CLAUDE_CODE_OAUTH_TOKEN";

/** The token from our own env. Throws when it is missing or when other credentials are present (we are not in `env -i`). */
export const liveToken = (): string => {
	const token = process.env[TOKEN_VAR];
	if (token === undefined || token === "") {
		throw new Error(
			`${TOKEN_VAR} is not set: run through tools/release/secret-runner.sh oauth`,
		);
	}
	const other = Object.keys(process.env).filter(
		(k) =>
			k !== TOKEN_VAR && CREDENTIAL_NAME.test(k) && !NON_SECRET_NAMES.has(k),
	);
	if (other.length > 0) {
		throw new Error(
			`refusing live run: other credential-looking names in the env (${other.join(", ")}); run through tools/release/secret-runner.sh oauth`,
		);
	}
	registerSecret(token);
	return token;
};

/** Like assertSafeEnv, except exactly CLAUDE_CODE_OAUTH_TOKEN === token is allowed. No API key, ever. */
export const assertLiveEnv = (
	env: Record<string, string>,
	token: string,
): void => {
	if (token === "") {
		throw new Error("assertLiveEnv needs the token value");
	}
	for (const [k, v] of Object.entries(env)) {
		if (k === TOKEN_VAR) {
			if (v !== token) {
				throw new Error(`unsafe live env: ${k} is not the live token`);
			}
			continue;
		}
		if (CREDENTIAL_NAME.test(k) && !NON_SECRET_NAMES.has(k)) {
			throw new Error(`unsafe live env: ${k} looks like a credential`);
		}
		if (v.includes("sk-ant-") || v.includes(token)) {
			throw new Error(`unsafe live env: ${k} holds a key-shaped value`);
		}
	}
};

export interface LiveEnvOpts {
	home: string;
	configDir: string;
	/** Adds TERM, LANG. */
	tty?: boolean;
	/** HTTPS_PROXY + NODE_EXTRA_CA_CERTS to the local stand-in. */
	mitm?: { proxyUrl: string; caFile: string };
	/** Dry runs only: the local stub. */
	baseUrl?: string;
	/** Dry runs only: nothing can leave the machine. */
	deadProxy?: boolean;
	/** The /usage cases need the endpoint call that this variable blocks. */
	allowNonessential?: boolean;
	/** Keep telemetry and nonessential traffic on so the program fetches its feature values (gate probes). */
	featureGates?: boolean;
	/** Variable under test. */
	extra?: Record<string, string>;
	/** Default liveToken(). */
	token?: string;
}

/** Built from nothing. No ANTHROPIC_BASE_URL, no ANTHROPIC_API_KEY, no proxy unless asked. */
export const liveEnv = (o: LiveEnvOpts): Record<string, string> => {
	const token = o.token ?? liveToken();
	const env: Record<string, string> = {
		PATH: `${shimDir(o.home)}:${SYSTEM_PATH}:${dirname(process.execPath)}`,
		HOME: o.home,
		TMPDIR: join(o.home, "tmp"),
		CLAUDE_CONFIG_DIR: o.configDir,
		...(o.featureGates === true ? {} : { DISABLE_TELEMETRY: "1" }),
		GIT_CONFIG_GLOBAL: join(o.home, ".gitconfig"),
		// git's osxkeychain helper must not run
		GIT_CONFIG_NOSYSTEM: "1",
		[TOKEN_VAR]: token,
	};
	if (o.allowNonessential !== true && o.featureGates !== true) {
		env["CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC"] = "1";
	}
	if (o.baseUrl !== undefined && o.baseUrl !== "") {
		env["ANTHROPIC_BASE_URL"] = o.baseUrl;
	}
	if (o.deadProxy === true) {
		env["HTTPS_PROXY"] = "http://127.0.0.1:9";
		env["HTTP_PROXY"] = "http://127.0.0.1:9";
		env["NO_PROXY"] = "127.0.0.1,localhost";
	}
	if (o.mitm) {
		env["HTTPS_PROXY"] = o.mitm.proxyUrl;
		env["NODE_EXTRA_CA_CERTS"] = o.mitm.caFile;
		env["NO_PROXY"] = "127.0.0.1,localhost";
	}
	if (o.tty === true) {
		env["TERM"] = "xterm-256color";
		env["LANG"] = "en_US.UTF-8";
	}
	for (const [k, v] of Object.entries(o.extra ?? {})) {
		if (k in env) {
			throw new Error(`extra would overwrite fixed key ${k}`);
		}
		env[k] = v;
	}
	assertLiveEnv(env, token);
	return env;
};

/** The only token a --dry run accepts. It is set by the dry parent, never by the secret runner. */
export const DRY_TOKEN = "sk-ant-oat-fake-dry";
