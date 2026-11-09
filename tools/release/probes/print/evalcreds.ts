import {
	bashRead,
	bulk,
	folders,
	P,
	refusedWith,
	relative,
	run,
} from "./evalcreds/eval.ts";
import {
	DIR_POINTERS,
	envOf,
	HELPERS,
	JVM,
	POINTERS,
} from "./evalcreds/vars.ts";
// How `claude plugin eval` picks the credential paths that its Bash sandbox hides.
// One eval run grants Bash to a fixture plugin. The program writes <kept>/config/settings.json
// (`sandbox.credentials.files`, `sandbox.filesystem.denyRead`) from the env of the run; --keep-temp keeps it.
// Every pointer is a path inside the fixture plugin folder, which the sandbox may read, so an entry
// that appears there came from the variable under test and not from the always-hidden home folder.
import { type CaseDef, runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const krb = (name: string, env: Record<string, string>): CaseDef =>
	run(name, { env }, (s) => folders(s, ["KRB"]));
const D = (n: string): string => `${P}/${n}/v`;
const AWS =
	"an AWS credential_process / credential_source cannot be excluded from the shell";
const awsCase = (name: string, body: string, message?: string): CaseDef =>
	run(
		name,
		{
			env: { AWS_CONFIG_FILE: D("AWSC") },
			seed: { "cred/AWSC/v": body },
		},
		(s) => ({
			...(message === undefined ? {} : refusedWith(s, message)),
			...folders(s, ["AWSC"]),
		}),
	);
const profile = (name: string, env: Record<string, string>): CaseDef =>
	run(
		name,
		{
			env: { ANTHROPIC_CONFIG_DIR: `${P}/ACD`, ...env },
			seed: {
				"cred/ACD/configs/a.json": `{"authentication":{"credentials_path":"${P}/ACD/cp-a.json"}}`,
				"cred/ACD/configs/b.json": "{}",
			},
		},
		(s) => ({
			...refusedWith(
				s,
				"the selected Anthropic profile name leaves the configs directory",
			),
			...folders(s, ["ACD"]),
		}),
	);

const defs: CaseDef[] = [
	bashRead("netrc.unset", {}),
	bashRead("netrc.set", { NETRC: `${P}/netrc` }),
	bulk("pointers", envOf(POINTERS)),
	bulk("dir-pointers", envOf(DIR_POINTERS)),
	bulk("helpers", envOf(HELPERS)),
	bulk(
		"jvm",
		Object.fromEntries(JVM.map((n) => [n, `-Duser.home=${P}/${n}/v`])),
	),
	bulk("args", {
		MAVEN_ARGS: `-s ${P}/MAVEN_ARGS/settings.xml`,
		MAVEN_CONFIG: `--settings=${P}/MAVEN_CONFIG/settings.xml`,
		ANSIBLE_VAULT_IDENTITY_LIST: `dev@${P}/ANSIBLE_VAULT_IDENTITY_LIST/pw`,
		GIT_SSH_COMMAND: `ssh -i ${P}/GIT_SSH_COMMAND/key`,
		GOAUTH: `${P}/GOAUTH/helper`,
	}),
	bulk(
		"followed",
		envOf([
			"ANSIBLE_CONFIG",
			"GIT_CONFIG_GLOBAL",
			"GIT_CONFIG_SYSTEM",
			"KRB5_CONFIG",
		]),
		{
			"cred/ANSIBLE_CONFIG/v": `[defaults]\nvault_password_file = ${P}/ANSIBLE_CONFIG/pw\n`,
			"cred/GIT_CONFIG_GLOBAL/v": `[http]\n\tsslkey = ${P}/GIT_CONFIG_GLOBAL/key\n`,
			"cred/GIT_CONFIG_SYSTEM/v": `[http]\n\tsslkey = ${P}/GIT_CONFIG_SYSTEM/key\n`,
			"cred/KRB5_CONFIG/v": `[libdefaults]\n default_ccache_name = FILE:${P}/KRB5_CONFIG/cc\n`,
		},
	),
	bulk(
		"dirs",
		envOf([
			"CLOUDSDK_ROOT_DIR",
			"XDG_RUNTIME_DIR",
			"PREFIX",
			"ANTHROPIC_CONFIG_DIR",
		]),
	),
	krb("krb5-file", { KRB5CCNAME: `FILE:${P}/KRB/cc` }),
	krb("krb5-wrfile", { KRB5CCNAME: `WRFILE:${P}/KRB/cc` }),
	krb("krb5-dir", { KRB5CCNAME: `DIR:${P}/KRB/d` }),
	krb("krb5-dir-colon", { KRB5CCNAME: `DIR::${P}/KRB/d/tkt` }),
	krb("krb5-keytabs", {
		KRB5_KTNAME: `FILE:${P}/KRB/kt`,
		KRB5_CLIENT_KTNAME: `FILE:${P}/KRB/ckt`,
	}),
	run(
		"kubeconfig-list",
		{ env: { KUBECONFIG: `${D("KUBE")}1:${D("KUBE")}2` } },
		(s) => folders(s, ["KUBE"]),
	),
	run(
		"jvm-d-options",
		{
			env: {
				MAVEN_OPTS: [
					`-Dgradle.user.home=${D("D1")}`,
					`-Dmaven.home=${D("D2")}`,
					`-Dsbt.global.base=${D("D3")}`,
					`-Dsbt.ivy.home=${D("D4")}`,
					`-Dmaven.user.settings=${D("D5")}`,
					`-Dmaven.repo.local=${D("D6")}`,
					`-Dsbt.boot.directory=${D("D7")}`,
					`-Dother.key=${D("D8")}`,
				].join(" "),
			},
		},
		(s) => folders(s, ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8"]),
	),
	profile("anthropic-profile", { ANTHROPIC_PROFILE: "a" }),
	profile("anthropic-profile-abs", { ANTHROPIC_PROFILE: "/etc/x" }),
	profile("anthropic-profile-dotdot", { ANTHROPIC_PROFILE: "../x" }),
	run(
		"pm",
		{
			env: {
				EVAL_MY_REG_URL: "https://u:p@example.test/x",
				EVAL_FOO_PROXY: "bar@baz",
				EVAL_FOO_NOTPX: "bar@baz",
				EVAL_MY_PROXY_PLAIN: "http://example.test:3128",
			},
		},
		// The program adds its own default names; only the probe names are of interest.
		(s) => ({ envVars: s.envVars.filter((n) => /^EVAL_(MY|FOO)_/u.test(n)) }),
	),
	awsCase("aws-credential-process", "[default]\ncredential_process = x\n", AWS),
	awsCase(
		"aws-credential-source",
		"[default]\ncredential_source = Ec2InstanceMetadata\n",
		AWS,
	),
	awsCase(
		"aws-credential-source-environment",
		"[default]\ncredential_source = Environment\n",
		AWS,
	),
	awsCase(
		"aws-web-identity",
		`[default]\nweb_identity_token_file = ${P}/AWSC/tok\n`,
	),
	run(
		"ssh-wildcard",
		{
			env: { GIT_SSH_COMMAND: `ssh -F ${D("SSHC")}` },
			seed: { "cred/SSHC/v": `Include ${P}/SSHC/*/conf\n` },
		},
		(s) =>
			refusedWith(
				s,
				"an ssh_config Include pattern with a wildcard directory cannot be followed",
			),
	),
	relative(
		"KUBECONFIG",
		{ KUBECONFIG: "rel/k" },
		"a credentials pointer variable (AWS_CONFIG_FILE, GOOGLE_APPLICATION_CREDENTIALS, ANTHROPIC_CONFIG_DIR and the like) holds a relative path",
	),
	relative(
		"ANSIBLE_CONFIG",
		{ ANSIBLE_CONFIG: "rel/a" },
		"ANSIBLE_CONFIG holds a relative path",
	),
	relative(
		"GIT_CONFIG_GLOBAL",
		{ GIT_CONFIG_GLOBAL: "rel/g" },
		"GIT_CONFIG_GLOBAL holds a relative path",
	),
	relative(
		"GIT_CONFIG_SYSTEM",
		{ GIT_CONFIG_SYSTEM: "rel/g" },
		"GIT_CONFIG_SYSTEM holds a relative path",
	),
	relative(
		"KRB5_CONFIG",
		{ KRB5_CONFIG: "rel/k" },
		"KRB5_CONFIG holds a relative path",
	),
	relative(
		"PREFIX",
		{ PREFIX: "rel/p" },
		"an npm prefix variable holds a relative path",
	),
	relative("HF_HOME", { HF_HOME: "rel/h" }, "HF_HOME holds a relative path"),
	relative(
		"CARGO_HOME",
		{ CARGO_HOME: "rel/c" },
		"CARGO_HOME holds a relative path",
	),
	relative(
		"KRB5CCNAME",
		{ KRB5CCNAME: "FILE:rel/c" },
		"a Kerberos ticket cache / keytab is named by a relative path",
	),
	relative(
		"GIT_CONFIG_COUNT",
		{ GIT_CONFIG_COUNT: "abc" },
		"GIT_CONFIG_COUNT is not a count this can follow",
	),
	relative(
		"GIT_CONFIG_PARAMETERS",
		{ GIT_CONFIG_PARAMETERS: "x" },
		"GIT_CONFIG_PARAMETERS is not in a form this can follow",
	),
	relative(
		"GOAUTH",
		{ GOAUTH: "'unclosed" },
		"GOAUTH holds an unterminated quotation",
	),
];

export const evalcreds: PrintGroup = {
	id: "evalcreds",
	title: "Credential paths that claude plugin eval hides from its Bash sandbox",
	run: (ctx) => runCases(ctx, "evalcreds", defs),
};
