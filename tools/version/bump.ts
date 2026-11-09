// Usage: bun tools/version/bump.ts <site|clawdipedia-docs|clawdipedia-docs-cli|cc-inspect|all> <patch|minor|major>
//        (also: bun run version:bump -- <target> <level>, or: just bump <target> <level>)
// Bumps the version in every file of a target, and sets the Claude Code version that the marketplace
// texts name to CLAUDE_CODE_VERSION. plugin:check runs versionProblems, so a missed file fails verify.
import { join } from "node:path";

import { CLAUDE_CODE_VERSION } from "../../src/version.ts";

export type Level = "patch" | "minor" | "major";
type Json = Record<string, unknown>;
/** A file and the key path of its version. */
interface Slot {
	file: string;
	path: string[];
}

export const MARKETPLACE = ".claude-plugin/marketplace.json";
/** Plugin manifests whose description names the Claude Code version. */
const PLUGIN_MANIFESTS = [
	"plugin/.claude-plugin/plugin.json",
	"cli/.claude-plugin/plugin.json",
];
/** Skill bodies that tell the model which Claude Code version the `clawdipedia` source covers. */
export const SKILL_FILES = [
	"plugin/skills/clawdipedia-docs/SKILL.md",
	"cli/skills/clawdipedia-docs-cli/SKILL.md",
];
export const TARGETS: Record<string, Slot[]> = {
	site: [{ file: "package.json", path: ["version"] }],
	"clawdipedia-docs": [
		{ file: "plugin/.claude-plugin/plugin.json", path: ["version"] },
		{ file: "plugin/mcp/package.json", path: ["version"] },
		{ file: MARKETPLACE, path: ["metadata", "version"] },
	],
	"clawdipedia-docs-cli": [
		{ file: "cli/.claude-plugin/plugin.json", path: ["version"] },
		{ file: "cli/package.json", path: ["version"] },
	],
	"cc-inspect": [
		{ file: "inspect/.claude-plugin/plugin.json", path: ["version"] },
		{ file: "inspect/mcp/package.json", path: ["version"] },
	],
};

const isJson = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** Parse JSON text into an object, or an empty object when it holds no object. */
const parseJson = (text: string): Json => {
	const doc: unknown = JSON.parse(text);
	return isJson(doc) ? doc : {};
};

const isLevel = (v: string | undefined): v is Level =>
	v === "patch" || v === "minor" || v === "major";

const bumpParts = (x: number, y: number, z: number, level: Level): string => {
	if (level === "major") {
		return `${x + 1}.0.0`;
	}
	if (level === "minor") {
		return `${x}.${y + 1}.0`;
	}
	return `${x}.${y}.${z + 1}`;
};

export const bumpVersion = (v: string, level: Level): string => {
	const m = /^(\d+)\.(\d+)\.(\d+)$/u.exec(v);
	if (!m) {
		throw new Error(`not a version: ${v}`);
	}
	return bumpParts(Number(m[1]), Number(m[2]), Number(m[3]), level);
};

const get = (doc: Json, path: string[]): unknown => {
	let node: unknown = doc;
	for (const k of path) {
		node = isJson(node) ? node[k] : undefined;
	}
	return node;
};

/** The Claude Code versions (`2.1.x`) named in the marketplace texts. */
const ccVersions = (market: Json): string[] =>
	JSON.stringify([market["description"], market["plugins"]]).match(
		/\b2\.\d+\.\d+\b/gu,
	) ?? [];

const CC_VERSION_RE = /\b2\.\d+\.\d+\b/gu;

/**
 * The text with the Claude Code version of every `"description"` line set to `CLAUDE_CODE_VERSION`.
 * Only those lines, because a plugin version such as `2.0.0` looks the same to the pattern.
 */
export const syncDescriptions = (text: string): string =>
	text.replaceAll(/^.*"description".*$/gmu, (line) =>
		line.replaceAll(CC_VERSION_RE, CLAUDE_CODE_VERSION),
	);

/** The text with every Claude Code version set to `CLAUDE_CODE_VERSION`. For a skill body, which holds no plugin version. */
export const syncVersions = (text: string): string =>
	text.replaceAll(CC_VERSION_RE, CLAUDE_CODE_VERSION);

/** Each target whose files hold different versions, and each marketplace text with an old Claude Code version. */
export const versionProblems = (read: (file: string) => Json): string[] => {
	const out: string[] = [];
	for (const [name, slots] of Object.entries(TARGETS)) {
		const got = slots.map(
			(s) => `${s.file}=${String(get(read(s.file), s.path))}`,
		);
		if (new Set(got.map((g) => g.split("=")[1])).size > 1) {
			out.push(`${name} versions differ: ${got.join(", ")}`);
		}
	}
	for (const v of new Set(ccVersions(read(MARKETPLACE)))) {
		if (v !== CLAUDE_CODE_VERSION) {
			out.push(
				`${MARKETPLACE} names Claude Code ${v}, not ${CLAUDE_CODE_VERSION}: run "bun run version:bump"`,
			);
		}
	}
	return out;
};

/** Bump every slot of the named targets; the new texts go into `texts`. */
const bumpTargets = (
	names: string[],
	level: Level,
	text: (f: string) => string,
	texts: Map<string, string>,
): void => {
	for (const n of names) {
		for (const s of TARGETS[n] ?? []) {
			const t = text(s.file);
			const old = String(get(parseJson(t), s.path));
			const next = bumpVersion(old, level);
			const key = JSON.stringify(s.path.at(-1));
			const re = new RegExp(
				`(${key}:\\s*)"${old.replaceAll(".", String.raw`\.`)}"`,
				"u",
			);
			if (!re.test(t)) {
				throw new Error(`${s.file}: no ${key} "${old}"`);
			}
			texts.set(s.file, t.replace(re, `$1"${next}"`));
			console.info(`${s.file}: ${old} -> ${next}`);
		}
	}
};

/** Set the Claude Code version in the marketplace, the manifests, and the skill bodies. */
const syncClaudeCode = (
	text: (f: string) => string,
	texts: Map<string, string>,
): void => {
	// The marketplace and the plugin manifests name the Claude Code version in their descriptions.
	// A skill body names it in prose, and the model repeats it to the user.
	const sync: [files: string[], fn: (t: string) => string][] = [
		[[MARKETPLACE, ...PLUGIN_MANIFESTS], syncDescriptions],
		[SKILL_FILES, syncVersions],
	];
	for (const [files, fn] of sync) {
		for (const f of files) {
			const t = text(f);
			const next = fn(t);
			if (next !== t) {
				texts.set(f, next);
				console.info(`${f}: Claude Code version -> ${CLAUDE_CODE_VERSION}`);
			}
		}
	}
};

const main = async (): Promise<void> => {
	const ROOT = join(import.meta.dir, "..", "..");
	const [target, level] = process.argv.slice(2);
	const names = target === "all" ? Object.keys(TARGETS) : [target ?? ""];
	if (
		(target !== undefined && !names.every((n) => n in TARGETS)) ||
		(target !== undefined && !isLevel(level))
	) {
		console.error(
			`usage: bun tools/version/bump.ts [<${[...Object.keys(TARGETS), "all"].join("|")}> <patch|minor|major>]`,
		);
		process.exitCode = 2;
		return;
	}
	// Files keep their text; only the version values change, so the formatting stays.
	const files = [
		...new Set([
			MARKETPLACE,
			...PLUGIN_MANIFESTS,
			...SKILL_FILES,
			...Object.values(TARGETS).flatMap((slots) => slots.map((s) => s.file)),
		]),
	];
	const originals = new Map(
		await Promise.all(
			files.map(
				async (f) => [f, await Bun.file(join(ROOT, f)).text()] as const,
			),
		),
	);
	const texts = new Map<string, string>();
	const text = (f: string) => texts.get(f) ?? originals.get(f) ?? "";
	if (target !== undefined && isLevel(level)) {
		bumpTargets(names, level, text, texts);
	}
	syncClaudeCode(text, texts);
	await Promise.all([...texts].map(([f, t]) => Bun.write(join(ROOT, f), t)));
	const left = versionProblems((f) => parseJson(text(f)));
	for (const p of left) {
		console.error(p);
	}
	process.exitCode = left.length > 0 ? 1 : 0;
};

if (import.meta.main) {
	await main();
}
