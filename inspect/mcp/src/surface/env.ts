// Kind `env`: environment variables the program reads or sets for a child process.
// Anchors (checked on 2.1.309, task 1.1):
// 1. The typed registry: `reg(ns,{NAME:()=>v,...})` where most getters are `v=H.bool()`, `H.triBool()`,
//    `H.int({min:0})`, `H.str()`, or `H.enum([...])` (chunk-jnz7zw3f.js in 2.1.309). The method gives
//    `detail`, the enum array gives `values`. (env/registry.ts)
// 2. Env objects: `process.env`; a proxy made by a function that is called with a registry namespace
//    (`i=WG({...ns1,...ns2},c)`, `Zn=WG({},null)`); a call of a function that returns an env object
//    (`Io()`); an object that spreads one; a variable, an import, a parameter default, or a parameter
//    that every call fills with one. Reads of an env object: `x.NAME`, `x["NAME"]`, `"NAME" in x`,
//    and `const {NAME}=x`. Only SCREAMING_CASE names count, except on `process.env` itself. (env/objects.ts, env/reads.ts)
// 3. Helpers that read `process.env[param]` or `globalThis.process.env?.[param]` (the SDK's), and
//    OpenTelemetry readers `x.get*FromEnv("NAME")` and their wrappers, called with a constant string.
// 4. Names set for a child process: the keys (also `[CONST]`) of `{...env, NAME:v}`, of an `env:{...}`
//    option, of objects spread into those (`...s&&{NAME:s}`), and `"--setenv","NAME"` sandbox arguments.
// 5. Name lists and name-keyed objects of uppercase strings (`["A_B",...x,"C"]`, `{A_B:1}`) where at
//    least a third of the names are found: the rest of their `A_B` names, with detail "listed". Repeated
//    until no list adds a name, so lists that share names (the telemetry set `bi`, the child-env scrub
//    lists) fill each other. (env/helpers.ts)
// Compared with the old `strings` heuristic (tools/release/diff/extract.ts, 1257 names) on 2.1.309:
// 1846 names, 704 only here, 115 only there.
// - Only here: 703 start with a prefix outside its 12 `ENV_PREFIXES` (GIT, AWS, CCR, VERTEX, AZURE, ...;
//   mostly the child-env scrub lists); CLAUDE_CODE_VERSION is set in a child `env:{}` with an object value.
// - Only there, not env names: constants and enum words (`MAX_*`, `NO_*`, `API_*`, `MCP_ENTRY_*`,
//   `OTEL_STATUS_CODE_VALUE_*`, `IS_A_SYMLINK`, `MCP_TRANSPORT_POLICY_ONLY`), shell variables (`BASH_*`),
//   config fields and hosts (`MCP_PROXY_URL`, `CLAUDE_AI_HOST`, `ANTHROPIC_TIER_NAMES`,
//   `ANTHROPIC_TELEMETRY_GROUP`), export names (`CLAUDE_AGENT`, `MCP_TASK`, `ENABLE_STUB_TOOLS`,
//   `CLAUDE_NAMES`), a warning code (`CLAUDE_SDK_CAN_USE_TOOL_SHADOWED`), a file name (`CLAUDE_BASE`),
//   UI text (`CLAUDE_API_KEY` placeholder, `CLAUDE_IN_SLACK_V2`), and part of a regex (`DISABLE_COLORS`).
// - Only there, by design: `${NAME}` placeholders (`CLAUDE_SKILL_DIR`, `CLAUDE_SESSION_ID`,
//   `CLAUDE_TEST_*`, `CLAUDE_SESSION_SURFACE`, `CLAUDE_DEV_MODS_DIR`), and a name only in help text
//   (`CLAUDE_HELPER_CONTEXT`).
// - Only there, missed: `CLAUDE_CODE_DISABLE_HOME_SETTINGS_SEED` (read from a method result,
//   `e.spawnEnv()`), `CLAUDE_RUNNER_CLAUDE_BIN` (set in an env object with no `env:` key or spread),
//   and `CLAUDE_CODE_ARTIFACT_FD` (held in a constant; no read found).

import type { Bundle } from "../ast.ts";
import { type Extractor, scanOf, type SurfaceItem, unique } from "./common.ts";
import { growLists, resolveHelpers } from "./env/helpers.ts";
import { EnvObjects } from "./env/objects.ts";
import { readNode, SHOWN } from "./env/reads.ts";
import { scanRegistries } from "./env/registry.ts";
import { type Ctx, NAME } from "./env/shared.ts";

/** Every place that names an env variable, in the order found; `extractEnv` keeps the first of each name. */
export const envPlaces = async (bundle: Bundle): Promise<SurfaceItem[]> => {
	const out: SurfaceItem[] = [];
	const add: Ctx["add"] = (m, n, name, extra = {}) => {
		if (NAME.test(name)) {
			out.push({
				kind: "env",
				name,
				module: m.name,
				offset: n.start,
				...extra,
			});
		}
	};
	const env = new EnvObjects();
	await env.findFactories(await scanRegistries(bundle, add));
	const c: Ctx = { add, env, helpers: [], lists: [] };
	await scanOf(bundle, [""], SHOWN, (m, n) => readNode(c, m, n));
	await resolveHelpers(c);
	growLists(c, out);
	return out;
};

export const extractEnv: Extractor = async (bundle) =>
	unique(await envPlaces(bundle));
