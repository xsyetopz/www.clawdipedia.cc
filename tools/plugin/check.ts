// Usage: bun tools/plugin/check.ts   (also: bun run plugin:check)
// Validates each plugin manifest and the marketplace file against schemas/ with ajv, and checks
// that each plugin's .mcp.json, skill, and committed server bundle exist, pass their tests, and are fresh.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";

import { SCHEMA_NAMES, TYPE_FILE } from "../../plugin/mcp/src/content.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import {
	MARKETPLACE,
	SKILL_FILES,
	TARGETS,
	versionProblems,
} from "../version/bump.ts";
import { bundleProblems, validateProblems } from "./bundle.ts";
import { exists, manifestFile, PLUGINS, ROOT, text } from "./plugins.ts";
import type { Plugin } from "./plugins.ts";

type Json = Record<string, unknown>;

const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
addFormats(ajv);
for (const f of ["starts_with", "ends_with"]) {
	ajv.addFormat(f, true);
}
ajv.addKeyword({ keyword: "x-managed-only", schemaType: "boolean" });

const isJson = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** The JSON files read so far; `read` serves the sync callers from it. */
const cache = new Map<string, Json>();
const load = async (p: string): Promise<Json> => {
	const cached = cache.get(p);
	if (cached) {
		return cached;
	}
	const doc: unknown = JSON.parse(await text(p));
	const json = isJson(doc) ? doc : {};
	cache.set(p, json);
	return json;
};
const read = (p: string): Json => cache.get(p) ?? {};

const CC_VERSION_RE = /\b2\.\d+\.\d+\b/gu;

const schemaProblems = async (): Promise<string[]> => {
	const problems: string[] = [];
	const targets: [string, string][] = [
		...PLUGINS.map((p): [string, string] => [
			manifestFile(p.dir),
			"claude-code-plugin-manifest",
		]),
		[MARKETPLACE, "claude-code-marketplace"],
	];
	const loaded = await Promise.all(
		targets.map(async ([file, kind]) => ({
			file,
			kind,
			schema: await load(`schemas/${kind}.json`),
			doc: await load(file),
		})),
	);
	for (const { file, kind, schema, doc } of loaded) {
		const want = `https://clawdipedia.cc/schemas/${kind}.json`;
		const check = ajv.getSchema(want) ?? ajv.compile(schema);
		if (check(doc) !== true) {
			for (const e of check.errors ?? []) {
				problems.push(`${file}: ${e.instancePath || "/"} ${e.message}`);
			}
		}
		if (doc["$schema"] !== want) {
			problems.push(`${file}: $schema should be ${want}`);
		}
	}
	return problems;
};

// Reserved plugin names, per docs/extend/plugins/manifest.md (Top-Level Keys, `name`).
const RESERVED =
	/^(claude-|anthropic-|anthropics-|cc-plugin-)|^(claude|anthropic|claude-code|claude-mods)$/u;

const marketplacePlugins = (): Json[] => {
	const plugins = read(MARKETPLACE)["plugins"];
	return Array.isArray(plugins)
		? plugins.filter((p): p is Json => isJson(p))
		: [];
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

const nameProblems = (): string[] => {
	const names = [
		...PLUGINS.map((p) => read(manifestFile(p.dir))["name"]),
		...marketplacePlugins().map((p) => p["name"]),
	];
	return names
		.filter(
			(n) => typeof n !== "string" || !n || /\s/u.test(n) || RESERVED.test(n),
		)
		.map(
			(n) => `plugin name "${String(n)}" is empty, has spaces, or is reserved`,
		);
};

const staleVersions = (file: string, body: string, prefix: string): string[] =>
	[...new Set([...body.matchAll(CC_VERSION_RE)].map((m) => m[0]))]
		.filter((v) => v !== CLAUDE_CODE_VERSION)
		.map(
			(v) =>
				`${file}: ${prefix}names Claude Code ${v}, but src/version.ts has ${CLAUDE_CODE_VERSION}: run "bun run version:bump"`,
		);

const versionTextProblems = async (): Promise<string[]> => {
	// A manifest description must not name a Claude Code version other than src/version.ts.
	const problems = PLUGINS.flatMap((p) => {
		const file = manifestFile(p.dir);
		return staleVersions(file, str(read(file)["description"]), "description ");
	});
	// A skill body tells the model which version the `clawdipedia` source covers, so it must match too.
	const skills = await Promise.all(
		SKILL_FILES.map(async (file) => staleVersions(file, await text(file), "")),
	);
	return [...problems, ...skills.flat()];
};

// Every description goes into the model's context on each session, so each one stays short.
const DESCRIPTION_MAX = 200;

const skillDescription = async (
	p: Plugin,
): Promise<readonly [string, string]> => {
	const file = `${p.dir}/skills/${p.skill}/SKILL.md`;
	const body = (await exists(file)) ? await text(file) : "";
	return [file, /^description:[ \t]*(.*)$/mu.exec(body)?.[1]?.trim() ?? ""];
};

const descriptionProblems = async (): Promise<string[]> => {
	const market = read(MARKETPLACE);
	const descriptions: (readonly [where: string, text: string])[] = [
		[MARKETPLACE, str(market["description"])],
		...marketplacePlugins().map((p): readonly [string, string] => [
			`${MARKETPLACE} ${String(p["name"])}`,
			str(p["description"]),
		]),
		...PLUGINS.map((p): readonly [string, string] => [
			manifestFile(p.dir),
			str(read(manifestFile(p.dir))["description"]),
		]),
		...(await Promise.all(PLUGINS.map((p) => skillDescription(p)))),
	];
	return descriptions
		.filter(([, body]) => body.length > DESCRIPTION_MAX)
		.map(
			([where, body]) =>
				`${where}: description is ${body.length} characters, over ${DESCRIPTION_MAX}`,
		);
};

const pluginFileProblems = async (p: Plugin): Promise<string[]> => {
	const problems: string[] = [];
	const files = [`${p.dir}/skills/${p.skill}/SKILL.md`, p.out];
	const present = await Promise.all(files.map((f) => exists(f)));
	for (const [i, f] of files.entries()) {
		if (present[i] !== true) {
			problems.push(`${f}: missing`);
		}
	}
	// The CLI plugin adds no tool list, so it has no .mcp.json.
	if ((await exists(`${p.dir}/.mcp.json`)) !== p.mcp) {
		problems.push(
			`${p.dir}/.mcp.json: ${p.mcp ? "missing" : "must not exist (no MCP server)"}`,
		);
	}
	return problems;
};

const fileProblems = async (): Promise<string[]> => {
	const perPlugin = await Promise.all(
		PLUGINS.map((p) => pluginFileProblems(p)),
	);
	const problems = perPlugin.flat();
	// The command ships only in cli/, so the MCP plugin puts nothing on the Bash PATH.
	if (await exists("plugin/bin")) {
		problems.push("plugin/bin: must not exist (the command is in cli/)");
	}
	return problems;
};

const manifestRoutes = (parsed: unknown): string[] =>
	Array.isArray(parsed)
		? parsed.flatMap((e: unknown) =>
				isJson(e) && typeof e["route"] === "string" ? [e["route"]] : [],
			)
		: [];

const routeProblems = async (): Promise<string[]> => {
	const raw = await text("build/llms-manifest.json");
	const routes = manifestRoutes(JSON.parse(raw));
	const rels = routes.map((route) =>
		route === "/" ? "index" : route.replaceAll(/^\/+|\/+$/gu, ""),
	);
	const present = await Promise.all(
		rels.map((rel) => exists(`build/${rel}.md`)),
	);
	return routes.flatMap((route, i) =>
		present[i] === true
			? []
			: [`build/${rels[i]}.md: missing for manifest route ${route}`],
	);
};

const schemaListProblems = async (): Promise<string[]> => {
	const problems: string[] = [];
	const dir = join(ROOT, "build", "schemas");
	const files = (await exists("build/schemas")) ? await readdir(dir) : [];
	const built = files
		// surface.json is the item snapshot, not a schema that get_schema serves
		.filter((f) => f.endsWith(".json") && f !== "surface.json")
		.map((f) => f.slice(0, -5));
	const names = new Set<string>(SCHEMA_NAMES);
	if (built.length !== names.size || !built.every((n) => names.has(n))) {
		problems.push(
			`SCHEMA_NAMES (${[...SCHEMA_NAMES].join(", ")}) differs from build/schemas/ (${built.join(", ")})`,
		);
	}
	if (!(await Bun.file(join(dir, TYPE_FILE)).exists())) {
		problems.push(
			`build/schemas/${TYPE_FILE}: missing, so get_schema "types" fails`,
		);
	}
	return problems;
};

// Contract with the built site: what the server fetches must exist in build/.
const siteProblems = async (): Promise<string[]> => {
	if (!(await exists("build/llms-manifest.json"))) {
		console.warn(
			'plugin:check: build/ missing, skipped site contract check (run "bun run build")',
		);
		return [];
	}
	return [...(await routeProblems()), ...(await schemaListProblems())];
};

const main = async (): Promise<void> => {
	const slotFiles = Object.values(TARGETS).flatMap((slots) =>
		slots.map((s) => s.file),
	);
	await Promise.all([
		...slotFiles.map((f) => load(f)),
		...PLUGINS.map((p) => load(manifestFile(p.dir))),
		load(MARKETPLACE),
	]);
	const bundles = await Promise.all(PLUGINS.map((p) => bundleProblems(p)));
	const problems = [
		...(await schemaProblems()),
		...nameProblems(),
		...versionProblems(read),
		...(await versionTextProblems()),
		...(await descriptionProblems()),
		...(await fileProblems()),
		...(await validateProblems()),
		...bundles.flat(),
		...(await siteProblems()),
	];
	if (problems.length > 0) {
		for (const p of problems) {
			console.error(`plugin:check: ${p}`);
		}
		process.exitCode = 1;
		return;
	}
	console.info("plugin:check: manifests valid, plugin files present");
};

await main();
