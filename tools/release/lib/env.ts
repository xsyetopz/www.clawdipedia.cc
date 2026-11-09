// The one safe way to build a child env for the program. Built from nothing; never copies process.env.
// The parent shell exports CLAUDE_CODE_* names that must not reach a probe.
import { dirname, join } from "node:path";

import { shimDir } from "./shim.ts";

// PROMPT is the only prompt probes send. Anything else needs an explicit reason in the case notes.
export {
	binaryPath,
	DEFAULT_PROMPT as PROMPT,
	installedVersions,
} from "../util.ts";
export const FAKE_KEY = "sk-ant-fake-probe";

export interface ChildEnvOpts {
	home: string;
	configDir: string;
	/** from sandbox + stub */
	baseUrl: string;
	/** variable under test */
	extra?: Record<string, string>;
	/** adds TERM, LANG */
	tty?: boolean;
	/** never "oauth" */
	auth?: "fake-key" | "none";
	/** fixed keys that `extra` may replace (explicit, per call) */
	allowOverride?: string[];
	/** credential-looking names set to FAKE_CREDENTIAL (e.g. GH_TOKEN for the scrub probe) */
	fakeCredentials?: string[];
}

/** Sentinel value for fake credential-named variables. Only accepted for names listed in `fakeCredentials`. */
export const FAKE_CREDENTIAL = "probe-fake-credential";

export const SYSTEM_PATH =
	"/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin";

export const CREDENTIAL_NAME =
	/(^|_)(TOKEN|SECRET|PASSWORD|CREDENTIALS?|API_KEY)(_|$)/iu;

/** Names that match CREDENTIAL_NAME but are settings, not secrets (thresholds, TTLs, URLs, message codes, file paths). */
export const NON_SECRET_NAMES: ReadonlySet<string> = new Set([
	"CLAUDE_CODE_ENABLE_TOKEN_USAGE_ATTACHMENT",
	"CLAUDE_CODE_IDLE_TOKEN_THRESHOLD",
	"CLAUDE_CODE_RESUME_TOKEN_THRESHOLD",
	"CLAUDE_CODE_API_KEY_HELPER_TTL_MS",
	"API_KEY_URL",
	"NO_CREDENTIALS_FOUND",
	// paths to credential files, read by the plugin eval probes
	"ANSIBLE_VAULT_PASSWORD_FILE",
	"HF_TOKEN_PATH",
	"AWS_WEB_IDENTITY_TOKEN_FILE",
	"CLAUDE_SESSION_INGRESS_TOKEN_FILE",
	"AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE",
	"AZURE_FEDERATED_TOKEN_FILE",
	"CONSUL_HTTP_TOKEN_FILE",
	"ANTHROPIC_IDENTITY_TOKEN_FILE",
	"CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
	"CLOUDSDK_AUTH_ACCESS_TOKEN_FILE",
	"CLOUDSDK_AUTH_AUTHORIZATION_TOKEN_FILE",
	"AWS_SHARED_CREDENTIALS_FILE",
	"GOOGLE_APPLICATION_CREDENTIALS",
	"CREDENTIALS_DIRECTORY",
	"SBT_CREDENTIALS",
	"COURSIER_CREDENTIALS",
]);

/** Throws on a credential-looking name (other than ANTHROPIC_API_KEY=FAKE_KEY) or a real-looking key value. */
export const assertSafeEnv = (
	env: Record<string, string>,
	fakeCredentials: string[] = [],
): void => {
	for (const [k, v] of Object.entries(env)) {
		if (k === "ANTHROPIC_API_KEY" && v === FAKE_KEY) {
			continue;
		}
		if (fakeCredentials.includes(k) && v === FAKE_CREDENTIAL) {
			continue;
		}
		if (CREDENTIAL_NAME.test(k) && !NON_SECRET_NAMES.has(k)) {
			throw new Error(`unsafe child env: ${k} looks like a credential`);
		}
		if (v.includes("sk-ant-") && v !== FAKE_KEY) {
			throw new Error(`unsafe child env: ${k} holds a key-shaped value`);
		}
	}
};

export const childEnv = (o: ChildEnvOpts): Record<string, string> => {
	const env: Record<string, string> = {
		PATH: `${shimDir(o.home)}:${SYSTEM_PATH}:${dirname(process.execPath)}`,
		HOME: o.home,
		TMPDIR: join(o.home, "tmp"),
		CLAUDE_CONFIG_DIR: o.configDir,
		ANTHROPIC_BASE_URL: o.baseUrl,
		CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
		DISABLE_TELEMETRY: "1",
		HTTPS_PROXY: "http://127.0.0.1:9",
		HTTP_PROXY: "http://127.0.0.1:9",
		NO_PROXY: "127.0.0.1,localhost",
		// The AWS SDK reaches 169.254.169.254 directly, not through the proxy.
		AWS_EC2_METADATA_DISABLED: "true",
		GIT_CONFIG_GLOBAL: join(o.home, ".gitconfig"),
		// git's osxkeychain helper must not run
		GIT_CONFIG_NOSYSTEM: "1",
	};
	if ((o.auth ?? "fake-key") === "fake-key") {
		env["ANTHROPIC_API_KEY"] = FAKE_KEY;
	}
	if (o.tty === true) {
		env["TERM"] = "xterm-256color";
		env["LANG"] = "en_US.UTF-8";
	}
	for (const [k, v] of Object.entries(o.extra ?? {})) {
		if (k in env && o.allowOverride?.includes(k) !== true) {
			throw new Error(
				`extra would overwrite fixed key ${k}; list it in allowOverride`,
			);
		}
		env[k] = v;
	}
	for (const n of o.fakeCredentials ?? []) {
		if (n.startsWith("ANTHROPIC_") || n.startsWith("CLAUDE_CODE_")) {
			throw new Error(
				`fakeCredentials may not name ${n}: the program would use it`,
			);
		}
		env[n] = FAKE_CREDENTIAL;
	}
	assertSafeEnv(env, o.fakeCredentials);
	return env;
};
