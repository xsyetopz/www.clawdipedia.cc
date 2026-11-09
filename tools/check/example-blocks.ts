import { readdir } from "node:fs/promises";
import { join } from "node:path";

export const ROOT = join(import.meta.dir, "..", "..");
export const DOCS = join(ROOT, "docs");
export const SKIP_MARKER = "skip-lint";
const SKIP_DIRS = new Set([join(DOCS, "prompts")]);

const EXT: Record<string, string> = {
	ts: "ts",
	typescript: "ts",
	tsx: "tsx",
	js: "js",
	javascript: "js",
	jsx: "jsx",
	mjs: "mjs",
	json: "json",
	jsonc: "jsonc",
};

export interface Block {
	file: string;
	// 1-based line of the first code line
	line: number;
	lang: string;
	ext: string;
	indent: string;
	// number of code lines
	lines: number;
	code: string;
	id: string;
}

export const walk = async (dir: string): Promise<string[]> => {
	const entries = await readdir(dir, { withFileTypes: true });
	const found = await Promise.all(
		entries.map(async (entry) => {
			const p = join(dir, entry.name);
			if (SKIP_DIRS.has(p)) {
				return [];
			}
			if (entry.isDirectory()) {
				const inner = await walk(p);
				return inner;
			}
			return /\.(md|mdx)$/u.test(entry.name) ? [p] : [];
		}),
	);
	return found.flat();
};

const OPEN = /^(\s*)(`{3,}|~{3,})\s*([\w-]*)(.*)$/u;

const dedent = (indent: string, l: string) =>
	indent !== "" && l.startsWith(indent) ? l.slice(indent.length) : l;

export const findBlocks = (
	file: string,
	text: string,
	counter: { n: number },
) => {
	const lines = text.split("\n");
	const blocks: Block[] = [];
	let skipped = 0;
	for (let i = 0; i < lines.length; i++) {
		const m = OPEN.exec(lines[i] ?? "");
		if (!m) {
			continue;
		}
		const indent = m[1] ?? "";
		const fence = m[2] ?? "";
		const lang = (m[3] ?? "").toLowerCase();
		const meta = m[4] ?? "";
		let end = i + 1;
		const close = new RegExp(`^\\s*${fence[0]}{${fence.length},}\\s*$`, "u");
		while (end < lines.length && !close.test(lines[end] ?? "")) {
			end++;
		}
		const ext = EXT[lang];
		if (ext !== undefined) {
			if (meta.split(/\s+/u).includes(SKIP_MARKER)) {
				skipped++;
			} else {
				const body = lines.slice(i + 1, end).map((l) => dedent(indent, l));
				counter.n++;
				blocks.push({
					file,
					line: i + 2,
					lang,
					ext,
					indent,
					lines: end - i - 1,
					code: `${body.join("\n")}\n`,
					id: `b${String(counter.n).padStart(4, "0")}`,
				});
			}
		}
		i = end;
	}
	return { blocks, skipped };
};
