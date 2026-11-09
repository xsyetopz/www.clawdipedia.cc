// Usage: bun tools/schemas/observe/user.ts <out-dir> [--home <dir>]
// Reads local Claude Code files (read-only) and records, value-free, the key paths and JSON types in them:
//   user-transcripts.json   <home>/.claude/projects/**/*.jsonl, rooted at the line's `type`
//   user-claude-json.json   <home>/.claude.json, root `$root`
//   user-frontmatter.json   YAML headers of skill, command, agent, and output style .md files under <home>/.claude
// The raw output holds key names of the user's data (project paths in .claude.json); it is a temp file for
// observe/run.ts, which keeps only paths that are fields of a schema and never a value.
import { mkdir, readdir, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

import { Tally } from "../observe.ts";

const outDir = process.argv[2];
const hi = process.argv.indexOf("--home");
const home = hi === -1 ? homedir() : (process.argv[hi + 1] ?? homedir());
if (outDir === undefined || outDir === "") {
	throw new Error("usage: <out-dir> [--home <dir>]");
}
await mkdir(outDir, { recursive: true });

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const isDirectory = async (p: string): Promise<boolean | undefined> => {
	try {
		const st = await stat(p);
		return st.isDirectory();
	} catch {
		return undefined;
	}
};

// Runs one step after another, so only one file is in memory at a time.
const eachInTurn = async <T>(
	items: T[],
	step: (item: T) => Promise<void>,
	index = 0,
): Promise<void> => {
	const item = items[index];
	if (index >= items.length || item === undefined) {
		return;
	}
	await step(item);
	await eachInTurn(items, step, index + 1);
};

// UTF-16 order like the default sort; the lib has no `toSorted`, and `sort` mutates.
const sortedNames = (names: string[]): string[] => {
	const out: string[] = [];
	for (const name of names) {
		const at = out.findIndex((x) => x > name);
		out.splice(at === -1 ? out.length : at, 0, name);
	}
	return out;
};

const files = async (
	dir: string,
	keep: (p: string) => boolean,
	depth = 0,
): Promise<string[]> => {
	if (depth > 9) {
		return [];
	}
	let entries: string[];
	try {
		entries = await readdir(dir);
	} catch {
		return [];
	}
	const names = sortedNames(entries).filter(
		(e) => e !== "node_modules" && !e.startsWith("."),
	);
	const found = await Promise.all(
		names.map(async (e): Promise<string[]> => {
			const p = join(dir, e);
			const isDir = await isDirectory(p);
			if (isDir === true) {
				return files(p, keep, depth + 1);
			}
			return isDir === false && keep(p) ? [p] : [];
		}),
	);
	return found.flat();
};

const write = async (name: string, counts: object, t: Tally): Promise<void> => {
	await Bun.write(
		join(outDir, name),
		`${JSON.stringify({ counts, paths: t }, null, 1)}\n`,
	);
};

const transcripts = async (): Promise<void> => {
	const t = new Tally();
	const fs = await files(join(home, ".claude", "projects"), (p) =>
		p.endsWith(".jsonl"),
	);
	let lines = 0;
	await eachInTurn(fs, async (f) => {
		const text = await Bun.file(f).text();
		for (const l of text.split("\n")) {
			if (l === "") {
				continue;
			}
			try {
				const j: unknown = JSON.parse(l);
				if (!isRecord(j)) {
					continue;
				}
				lines += 1;
				t.add(typeof j["type"] === "string" ? j["type"] : "?", j);
			} catch {
				// not JSON
			}
		}
	});
	await write("user-transcripts.json", { files: fs.length, lines }, t);
	console.info(`transcripts: files=${fs.length} lines=${lines}`);
};

const claudeJson = async (): Promise<void> => {
	const t = new Tally();
	const file = Bun.file(join(home, ".claude.json"));
	const present = await file.exists();
	if (present) {
		const parsed: unknown = JSON.parse(await file.text());
		t.add("$root", parsed);
	}
	await write("user-claude-json.json", { files: present ? 1 : 0 }, t);
	console.info(`claude.json: files=${present ? 1 : 0}`);
};

const kindOf = (p: string): string | undefined => {
	if (!p.endsWith(".md")) {
		return undefined;
	}
	if (p.includes("/output-styles/")) {
		return "output-style";
	}
	if (p.includes("/agents/")) {
		return "agent";
	}
	if (/\/skills\/[^/]+\/SKILL\.md$/u.test(p) || p.includes("/commands/")) {
		return "skill";
	}
	return undefined;
};

// Frontmatter: skills (SKILL.md) and commands are one schema def; agents and output styles have their own.
const frontmatter = async (): Promise<void> => {
	const t = new Tally();
	const counts: Record<string, number> = {
		skill: 0,
		agent: 0,
		"output-style": 0,
	};
	const found = await files(
		join(home, ".claude"),
		(p) => kindOf(p) !== undefined,
	);
	await eachInTurn(found, async (f) => {
		const kind = kindOf(f);
		const text = await Bun.file(f).text();
		const m = /^---\r?\n([\s\S]*?)\r?\n---/u.exec(text);
		if (kind === undefined || m?.[1] === undefined) {
			return;
		}
		try {
			const y: unknown = Bun.YAML.parse(m[1]);
			if (isRecord(y)) {
				t.add(kind, y);
				counts[kind] = (counts[kind] ?? 0) + 1;
			}
		} catch {
			// not YAML
		}
	});
	await write("user-frontmatter.json", counts, t);
	console.info(`frontmatter: ${JSON.stringify(counts)}`);
};

await transcripts();
await claudeJson();
await frontmatter();
