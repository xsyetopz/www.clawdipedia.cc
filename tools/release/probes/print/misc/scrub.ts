// Subprocess env scrub probes: which variable names reach a Bash tool child.
import { pathExists } from "../run.ts";
import {
	type CaseDef,
	initEvent,
	msgs,
	readCfg,
	toolResultTexts,
	withRun,
} from "../run/helpers.ts";
import { BASE } from "./shared.ts";

// Credential-named variables go through childEnv `fakeCredentials` (sentinel value, never a real secret).
// ANTHROPIC_AUTH_TOKEN is left out: the program would use it for the request and the stub would flag it.
const FAKE_CRED = [
	"AWS_SECRET_ACCESS_KEY",
	"MY_SECRET",
	"GH_TOKEN",
	"GITHUB_TOKEN",
	"GH_ENTERPRISE_TOKEN",
	"GITHUB_ENTERPRISE_TOKEN",
	"HF_TOKEN",
];
const PLAIN_NAMES = ["DATABASE_URL", "KUBECONFIG", "GH_HOST", "PLAIN_VAR"];
const SCRUB_NAMES = [...FAKE_CRED, ...PLAIN_NAMES];
export const scrubEnv: CaseDef = {
	name: "subprocess-env-scrub.names",
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: {
					CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: "1",
					...Object.fromEntries(
						PLAIN_NAMES.map((n) => [
							n,
							n === "DATABASE_URL" ? "postgres://u:p@h/db" : "v",
						]),
					),
				},
				fakeCredentials: FAKE_CRED,
				args: [...BASE, "--allowedTools", "Bash"],
				stub: {
					seq: [
						{
							name: "Bash",
							input: {
								command: String.raw`env | cut -d= -f1 | sort | tr '\n' ' ' > {CFG}/benv.txt`,
							},
						},
					],
				},
			},
			async (r) => {
				const text = await readCfg(r, "benv.txt");
				const seen = text.split(" ");
				const mode = initEvent(r)?.["permissionMode"];
				return {
					from: r,
					data: {
						precondition: seen.length > 3 && seen.includes("PATH"),
						kept: SCRUB_NAMES.filter((n) => seen.includes(n)),
						removed: SCRUB_NAMES.filter((n) => !seen.includes(n)),
						initPermissionMode: typeof mode === "string" ? mode : null,
					},
					notes:
						"Credential-named variables hold the sentinel probe-fake-credential, not a secret.",
				};
			},
		),
};

export const scrubPerm = (allowed: boolean, scrub: "1" | "0"): CaseDef => ({
	name: `subprocess-env-scrub.bypass${allowed ? "-allowedtools" : ""}-scrub${scrub}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: { CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: scrub },
				args: [...BASE, ...(allowed ? ["--allowedTools", "Bash"] : [])],
				stub: {
					seq: [{ name: "Bash", input: { command: "touch {PROJ}/zz.txt" } }],
				},
			},
			async (r) => ({
				from: r,
				data: {
					precondition: msgs(r).length >= 2,
					needsApproval: (toolResultTexts(r)[0] ?? "").includes(
						"needs approval",
					),
					fileMade: await pathExists(`${r.sb.proj}/zz.txt`),
					forcedNotice: (r.stdout + r.stderr).includes(
						"Permission mode forced to default",
					),
				},
			}),
		),
});
