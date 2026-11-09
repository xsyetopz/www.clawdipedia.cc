// Site checks (design D9). Run with: bun tools/check/docs.ts
// 1. No emoji characters in docs/ or src/, except the allow-list below.
// 2. Every doc has `title` and `description` front matter.
// 3. Headings and titles follow a simple Chicago Title Case rule.
// 4. A `Source:` line names a page only as a markdown link.
// 5. No emoji in a heading or in link text.
// 6. The counts on docs/reference/undocumented.md match its rows and the linked pages.
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, relative, sep } from "node:path";

import { normalizeHost, numberUuids } from "../capture-prompts/normalize.ts";
import { countProblems } from "../undocumented-counts.ts";
import { badEmoji, checkBody, emojiIn } from "./docs-body.ts";
import { titleCaseProblems } from "./title-case.ts";

export { bareCodeTokens } from "./docs-body.ts";

const ROOT = join(import.meta.dir, "..", "..");
const DOC_EXT = /\.(md|mdx)$/u;
const TEXT_EXT = /\.(md|mdx|ts|tsx|css|json|svg)$/u;

interface Problem {
	file: string;
	line: number;
	message: string;
}
const problems: Problem[] = [];
const report = (file: string, line: number, message: string): void => {
	problems.push({ file: relative(ROOT, file), line, message });
};

const walk = async (dir: string): Promise<string[]> => {
	let names: string[];
	try {
		names = await readdir(dir);
	} catch {
		return [];
	}
	const found = await Promise.all(
		names.map(async (name): Promise<string[]> => {
			if (name === "node_modules" || name.startsWith(".")) {
				return [];
			}
			const path = join(dir, name);
			const info = await stat(path);
			return info.isDirectory() ? walk(path) : [path];
		}),
	);
	return found.flat();
};

interface FrontMatter {
	data: Record<string, string>;
	bodyStart: number;
}

const parseFrontMatter = (text: string): FrontMatter | null => {
	const lines = text.split("\n");
	if (lines[0]?.trim() !== "---") {
		return null;
	}
	const data: Record<string, string> = {};
	for (const [i, line] of lines.entries()) {
		if (i === 0) {
			continue;
		}
		if (line.trim() === "---") {
			return { data, bodyStart: i + 1 };
		}
		const m = /^([A-Za-z_][\w-]*):\s*(.*)$/u.exec(line);
		if (m !== null) {
			const [, key = "", raw = ""] = m;
			let v = raw.trim();
			if (/^(['"]).*\1$/u.test(v)) {
				v = v.slice(1, -1);
			}
			data[key] = v;
		}
	}
	return null;
};

// docs/prompts/ holds verbatim program text, so it is exempt.
const CAPTURES = join(ROOT, "docs", "prompts") + sep;
const UNDOCUMENTED = join(ROOT, "docs", "reference", "undocumented.md");

const readAll = async (files: string[]): Promise<Map<string, string>> => {
	const texts = await Promise.all(files.map((f) => readFile(f, "utf8")));
	return new Map(files.map((f, i) => [f, texts[i] ?? ""]));
};

const checkEmojiLines = (file: string, text: string): void => {
	for (const [i, line] of text.split("\n").entries()) {
		const bad = badEmoji(line)[0];
		if (bad !== undefined) {
			report(
				file,
				i + 1,
				`emoji not on the allow-list: U+${bad.codePointAt(0)?.toString(16).toUpperCase()}`,
			);
		}
	}
};

const checkCategory = (file: string, text: string): void => {
	try {
		const parsed: unknown = JSON.parse(text);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"label" in parsed &&
			typeof parsed.label === "string" &&
			emojiIn(parsed.label).length > 0
		) {
			report(file, 1, "emoji in a category label");
		}
	} catch {
		report(file, 1, "invalid JSON");
	}
};

const checkFrontMatter = (file: string, fm: FrontMatter): void => {
	for (const key of ["title", "sidebar_label"]) {
		if (emojiIn(fm.data[key] ?? "").length > 0) {
			report(file, 1, `emoji in \`${key}\``);
		}
	}
	for (const key of ["title", "description"]) {
		if ((fm.data[key] ?? "") === "") {
			report(file, 1, `front matter needs \`${key}\``);
		}
	}
	const title = fm.data["title"] ?? "";
	if (title !== "") {
		const bad = titleCaseProblems(title);
		if (bad.length > 0) {
			report(file, 1, `title not in Title Case: ${bad.join(", ")}`);
		}
	}
};

const checkHandWritten = (file: string, text: string): void => {
	const n = numberUuids()(normalizeHost(text));
	if (n === text) {
		return;
	}
	const a = text.split("\n");
	const b = n.split("\n");
	const at = a.findIndex((l, i) => l !== b[i]);
	report(
		file,
		at + 1,
		"hand-written prompt page has host data (platform, OS version, build suffix, temp path, or random id); use the placeholders from tools/capture-prompts/normalize.ts",
	);
};

const checkDoc = (
	file: string,
	text: string,
	docs: Map<string, string>,
): void => {
	const fm = parseFrontMatter(text);
	if (fm === null) {
		report(file, 1, "missing front matter");
		return;
	}
	checkFrontMatter(file, fm);
	if (file.startsWith(CAPTURES) && fm.data["generated"] === "false") {
		checkHandWritten(file, text);
	}
	if (file === UNDOCUMENTED) {
		const read = (link: string): string => {
			const page = docs.get(join(dirname(file), link));
			if (page === undefined) {
				throw new Error(`ENOENT: no linked page ${link}`);
			}
			return page;
		};
		for (const p of countProblems(text, read)) {
			report(file, p.line, p.message);
		}
	}
	checkBody({ report, captures: CAPTURES }, file, text, fm.bodyStart);
};

const docFiles = await walk(join(ROOT, "docs"));
const srcFiles = await walk(join(ROOT, "src"));
const EMOJI_FILES = [...docFiles, ...srcFiles].filter((f) => TEXT_EXT.test(f));

const emojiTexts = await readAll(
	EMOJI_FILES.filter((f) => !f.startsWith(CAPTURES)),
);
for (const [file, text] of emojiTexts) {
	checkEmojiLines(file, text);
}

const categoryFiles = docFiles.filter((f) => f.endsWith("_category_.json"));
const categoryTexts = await readAll(categoryFiles);
for (const [file, text] of categoryTexts) {
	checkCategory(file, text);
}

const docTexts = await readAll(docFiles.filter((f) => DOC_EXT.test(f)));
for (const [file, text] of docTexts) {
	checkDoc(file, text, docTexts);
}

if (problems.length > 0) {
	for (const p of problems) {
		console.error(`${p.file}:${p.line}: ${p.message}`);
	}
	console.error(`\n${problems.length} problem(s) found.`);
	process.exitCode = 1;
} else {
	console.info(`check-docs: ok (${EMOJI_FILES.length} files scanned)`);
}
