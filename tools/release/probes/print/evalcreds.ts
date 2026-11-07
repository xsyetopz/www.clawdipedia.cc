// How `claude plugin eval` picks the credential paths that its Bash sandbox hides.
// One eval run grants Bash to a fixture plugin. The program writes <kept>/config/settings.json
// (`sandbox.credentials.files`, `sandbox.filesystem.denyRead`) from the env of the run; --keep-temp keeps it.
// Every pointer is a path inside the fixture plugin folder, which the sandbox may read, so an entry
// that appears there came from the variable under test and not from the always-hidden home folder.
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { PROMPT } from "../../lib/env.ts";
import type { Data } from "../../lib/results.ts";
import { type CaseDef, runCases } from "./run/helpers.ts";
import { arr, dispose, obj, type Run, runCase } from "./run.ts";
import type { PrintGroup } from "./types.ts";

const P = "{PROJ}/plug/cred";
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

type Settings = {
  sandbox: {
    credentials: { files: { path: string }[]; envVars: { name: string }[] };
    filesystem: { denyRead: string[] };
  };
};

type Seen = {
  r: Run;
  error: string | null;
  files: string[];
  denyRead: string[];
  envVars: string[];
  toolText: string;
};

const read = (p: string): string => readFileSync(p, "utf8");
const scrub = (s: string): string => s.replace(/\/\S*\/ccrel-\w+/g, "<TMP>");

/** One eval run of a fixture plugin whose case makes the stub model call Bash with `cmd`. */
const evalRun = async (
  bin: string,
  o: {
    env: Record<string, string>;
    seed?: Record<string, string>;
    cmd?: string;
  },
): Promise<Seen> => {
  const r = await runCase(bin, {
    argv: ARGV,
    env: o.env,
    allowOverride: ["GIT_CONFIG_GLOBAL"],
    tool: "Bash",
    toolInput: { command: o.cmd ?? "true" },
    text: "done",
    timeoutMs: 90_000,
    setup: ({ proj }) => {
      const files: Record<string, string> = {
        ".claude-plugin/plugin.json": JSON.stringify({
          name: "ecp",
          version: "1.0.0",
        }),
        "evals/c1/prompt.md": `---\nmax_turns: 3\nallowed_tools: [Bash]\n---\n\n${PROMPT}\n`,
        "evals/c1/graders/used.md": "---\ntype: tool_used\ntool: Bash\n---\n",
        ...o.seed,
      };
      for (const [rel, body] of Object.entries(files)) {
        mkdirSync(dirname(`${proj}/plug/${rel}`), { recursive: true });
        writeFileSync(`${proj}/plug/${rel}`, body.split("{PROJ}").join(proj));
      }
    },
  });
  const arm = obj(
    arr(
      obj(
        obj(arr(obj(JSON.parse(read(`${r.sb.proj}/out.json`)))["cases"])[0])[
          "arms"
        ],
      )["with"],
    )[0],
  );
  const kept = r.stderr.match(/kept (\/[^ :]+)/)?.[1];
  let files: string[] = [];
  let denyRead: string[] = [];
  let envVars: string[] = [];
  let toolText = "";
  if (kept) {
    Bun.spawnSync(["chmod", "-R", "u+rwx", kept]);
    if (existsSync(`${kept}/config/settings.json`)) {
      const s = JSON.parse(read(`${kept}/config/settings.json`)) as Settings;
      files = s.sandbox.credentials.files.map((f) => f.path);
      denyRead = s.sandbox.filesystem.denyRead;
      envVars = s.sandbox.credentials.envVars.map((e) => e.name);
    }
    const trace = existsSync(`${kept}/out/trace.jsonl`)
      ? read(`${kept}/out/trace.jsonl`)
      : "";
    for (const l of trace.split("\n"))
      if (l.includes('"tool_result"'))
        toolText = String(
          obj(arr(obj(obj(JSON.parse(l))["message"])["content"])[0])["content"],
        );
    rmSync(kept, { recursive: true, force: true });
  }
  return {
    r,
    error: typeof arm["error"] === "string" ? arm["error"] : null,
    files,
    denyRead,
    envVars,
    toolText,
  };
};

/** Fixture entries (settings paths, `//` marks an absolute path) that name `name`. */
const entriesFor = (s: Seen, name: string): string[] =>
  [...new Set([...s.files, ...s.denyRead])]
    .filter((p) => p.includes(`/plug/cred/${name}`))
    .map((p) => p.slice(p.indexOf("/plug/cred/")))
    .sort();

const run = (
  name: string,
  o: {
    env: Record<string, string>;
    seed?: Record<string, string>;
    cmd?: string;
  },
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
      dispose(s.r);
    }
  },
});

/** Many variables in one run, one entry list for each. */
const bulk = (
  name: string,
  env: Record<string, string>,
  seed?: Record<string, string>,
): CaseDef =>
  run(name, { env, ...(seed ? { seed } : {}) }, (s) =>
    Object.fromEntries(
      Object.keys(env).map((k) => [`entries.${k}`, entriesFor(s, k)]),
    ),
  );

/** A relative value stops the run; `message` is the predicted reason in the error. */
const relative = (
  name: string,
  env: Record<string, string>,
  message: string,
): CaseDef =>
  run(`relative.${name}`, { env }, (s) => ({
    matchesPrediction: s.error?.includes(message) ?? false,
  }));

const bashRead = (name: string, env: Record<string, string>): CaseDef =>
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
const folders = (s: Seen, names: string[]): Record<string, Data> =>
  Object.fromEntries(names.map((k) => [`entries.${k}`, entriesFor(s, k)]));

const refusedWith = (s: Seen, message: string): Record<string, Data> => ({
  matchesPrediction: s.error?.includes(message) ?? false,
});

const v = (name: string, sub = "v"): [string, string] => [
  name,
  `${P}/${name}/${sub}`,
];
const envOf = (names: string[]): Record<string, string> =>
  Object.fromEntries(names.map((n) => v(n)));

// Pointer variables of the list `ll` in the eval code (a path value is hidden as a file).
const POINTERS = [
  "CLAUDE_ENV_FILE",
  "SSL_CLIENT_CERT",
  "REGISTRY_AUTH_FILE",
  "RCLONE_CONFIG",
  "SOPS_AGE_KEY_FILE",
  "ANSIBLE_VAULT_PASSWORD_FILE",
  "BOTO_CONFIG",
  "S3CMD_CONFIG",
  "BUN_CONFIG_FILE",
  "GOENV",
  "HF_TOKEN_PATH",
  "HF_STORED_TOKENS_PATH",
  "HELM_REGISTRY_CONFIG",
  "HELM_REPOSITORY_CONFIG",
  "AWS_WEB_IDENTITY_TOKEN_FILE",
  "AWS_CONTAINER_AUTHORIZATION_TOKEN_FILE",
  "GOOGLE_GHA_CREDS_PATH",
  "AZURE_CLIENT_CERTIFICATE_PATH",
  "AZURE_FEDERATED_TOKEN_FILE",
  "KUBECONFIG",
  "NPM_CONFIG_GLOBALCONFIG",
  "NETRC",
  "NPM_CONFIG_USERCONFIG",
  "CLAUDE_CODE_CLIENT_KEY",
  "CLAUDE_CODE_CLIENT_CERT",
  "GIT_SSL_KEY",
  "GIT_SSL_CERT",
  "PIP_CLIENT_CERT",
  "PIP_CONFIG_FILE",
  "PGPASSFILE",
  "PGSERVICEFILE",
  "PGSSLKEY",
  "VAULT_CLIENT_KEY",
  "VAULT_CLIENT_CERT",
  "CONSUL_CLIENT_KEY",
  "CONSUL_CLIENT_CERT",
  "NOMAD_CLIENT_KEY",
  "NOMAD_CLIENT_CERT",
  "CONSUL_HTTP_TOKEN_FILE",
  "TF_CLI_CONFIG_FILE",
  "WGETRC",
  "ANTHROPIC_IDENTITY_TOKEN_FILE",
  "AZURE_AUTH_LOCATION",
  "CLOUDSDK_AUTH_CREDENTIAL_FILE_OVERRIDE",
  "CLOUDSDK_AUTH_ACCESS_TOKEN_FILE",
  "CLOUDSDK_AUTH_AUTHORIZATION_TOKEN_FILE",
  "AWS_SHARED_CREDENTIALS_FILE",
  "AWS_CONFIG_FILE",
  "GOOGLE_APPLICATION_CREDENTIALS",
];
// Pointer variables of the same list that name a folder, not a file.
const DIR_POINTERS = [
  "HEX_HOME",
  "CLOUDSDK_CONFIG",
  "AZURE_CONFIG_DIR",
  "DOCKER_CONFIG",
  "DOCKER_CERT_PATH",
  "GH_CONFIG_DIR",
  "GNUPGHOME",
  "CREDENTIALS_DIRECTORY",
  "CLAUDE_CODE_FEDERATION_CACHE_DIR",
];
// Variables that the code reads by name with a home folder default.
const HELPERS = [
  "HF_HOME",
  "CARGO_HOME",
  "COMPOSER_HOME",
  "GRADLE_USER_HOME",
  "M2_HOME",
  "MAVEN_HOME",
  "LEIN_HOME",
  "BUNDLE_CONFIG",
  "BUNDLE_USER_CONFIG",
  "BUNDLE_USER_HOME",
  "BUNDLE_APP_CONFIG",
  "HELM_CONFIG_HOME",
  "CONDARC",
  "POETRY_CONFIG_DIR",
  "UV_CONFIG_FILE",
  "SBT_CREDENTIALS",
  "COURSIER_CREDENTIALS",
  "COURSIER_CONFIG_DIR",
  "SYSTEM_WGETRC",
  "CURL_HOME",
  "BOTO_PATH",
  "PGSYSCONFDIR",
  "NPM_CONFIG_PREFIX",
  "KRB5CCNAME",
  "KRB5_KTNAME",
  "KRB5_CLIENT_KTNAME",
];

const JVM = [
  "JAVA_TOOL_OPTIONS",
  "JDK_JAVA_OPTIONS",
  "_JAVA_OPTIONS",
  "IBM_JAVA_OPTIONS",
  "OPENJ9_JAVA_OPTIONS",
  "MAVEN_OPTS",
  "GRADLE_OPTS",
  "ANT_OPTS",
  "JAVA_OPTS",
  "SBT_OPTS",
  "JVM_OPTS",
  "LEIN_JVM_OPTS",
  "ES_JAVA_OPTS",
  "SONAR_SCANNER_OPTS",
  "SONAR_SCANNER_JAVA_OPTS",
];

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
      ...(message ? refusedWith(s, message) : {}),
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
    (s) => ({ envVars: s.envVars.filter((n) => /^EVAL_(MY|FOO)_/.test(n)) }),
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
