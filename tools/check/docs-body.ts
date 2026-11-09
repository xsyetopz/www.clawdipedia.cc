// Line checks for one doc body: headings, admonition titles, links, and sources.

import { titleCaseProblems } from "./title-case.ts";

/** What the line checks need from the caller. */
export interface Ctx {
	report: (file: string, line: number, message: string) => void;
	captures: string;
}

const EMOJI =
	/\p{Extended_Pictographic}|\u{FE0F}|\u{20E3}|[\u{1F1E6}-\u{1F1FF}]/gu;

// Emojis that docs may use: the yes/no marks in table cells. The status
// labels (managed only, experimental, deprecated, caution) are components.
// U+2705 is the check mark (yes) and U+274C is the cross mark (no).
const ALLOWED_EMOJI = new Set(["\u2705", "\u274C"]);
export const emojiIn = (s: string) => [...s.matchAll(EMOJI)].map((m) => m[0]);
export const badEmoji = (s: string) =>
	emojiIn(s).filter((e) => !ALLOWED_EMOJI.has(e));

// A `Source:` line may cite the program, a probe, or code without a link.
const PLAIN_SOURCE =
	/^\s*Sources?(?: for all \w+)?:\s*(the program|a probe|the text|the \w+ of|`)/iu;

// Brand and product words that look like camelCase but are not code.
const BRAND_WORDS = new Set([
	"SchemaStore",
	"GitHub",
	"GitLab",
	"JavaScript",
	"TypeScript",
	"PowerShell",
	"OpenTelemetry",
	"OAuth",
	"macOS",
	"iOS",
	"iTerm2",
	"VSCode",
	"JetBrains",
]);

// In order: a --flag, UPPER_SNAKE, a file name, a leading /command, a $.
// JSONPath, a dotted.name, and snake_case.
const CODE_LIKE = [
	/(^|\s)--[a-z][\w-]*/u,
	/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/u,
	/\b[\w-]+\.(?:json|jsonl|md|mdx|ts|toml|yaml|yml)\b/u,
	/^\/[a-z][\w-]*/u,
	/\$\./u,
	/\b(?!(?:e\.g|i\.e)\b)[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\b/u,
	/\b[a-z][a-z0-9]*_[a-z0-9_]+\b/u,
];
const CAMEL =
	/\b[A-Za-z]*[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b|\b[A-Z][a-z0-9]+[A-Z][A-Za-z0-9]*\b/gu;

/** Returns code-like tokens in a heading that sit outside backticks. */
export const bareCodeTokens = (raw: string): string[] => {
	const text = raw
		.replace(/\s*\{#[^}]*\}\s*$/u, "")
		.replaceAll(/`[^`]*`/gu, "")
		.replaceAll(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
		.replaceAll(/<[^>]+>/gu, "")
		.trim();
	const found: string[] = [];
	for (const re of CODE_LIKE) {
		const m = re.exec(text);
		if (m !== null) {
			found.push(m[0].trim());
		}
	}
	for (const m of text.matchAll(CAMEL)) {
		if (!BRAND_WORDS.has(m[0])) {
			found.push(m[0]);
		}
	}
	return found;
};

const checkHeading = (
	ctx: Ctx,
	file: string,
	n: number,
	title: string,
): void => {
	if (emojiIn(title).length > 0) {
		ctx.report(file, n, "emoji in a heading");
	}
	const bad = titleCaseProblems(title);
	if (bad.length > 0) {
		ctx.report(file, n, `heading not in Title Case: ${bad.join(", ")}`);
	}
	if (!file.startsWith(ctx.captures)) {
		const code = bareCodeTokens(title);
		if (code.length > 0) {
			ctx.report(
				file,
				n,
				`heading has code outside backticks: ${code.join(", ")}`,
			);
		}
	}
};

const checkAdmonition = (
	ctx: Ctx,
	file: string,
	n: number,
	line: string,
): void => {
	const t = /^\s*:::[a-z]+(?:\[(.*)\]|[ \t]+(\S.*?))\s*$/u.exec(line);
	if (t === null || file.startsWith(ctx.captures)) {
		return;
	}
	const code = bareCodeTokens(t[1] ?? t[2] ?? "");
	if (code.length > 0) {
		ctx.report(
			file,
			n,
			`admonition title has code outside backticks: ${code.join(", ")}`,
		);
	}
};

const checkProseLine = (
	ctx: Ctx,
	file: string,
	n: number,
	line: string,
): void => {
	if (
		/^\s*Sources?\b[^|]*:/u.test(line) &&
		!PLAIN_SOURCE.test(line) &&
		!/\]\(https?:/u.test(line)
	) {
		ctx.report(file, n, "source names a page without a link");
	}
	if (/`[^`\n]*\\[{}][^`\n]*`/u.test(line)) {
		ctx.report(
			file,
			n,
			"escaped brace inside inline code (write { and } as is)",
		);
	}
	for (const m of line.matchAll(/\[([^\]]*)\]\([^)]*\)/gu)) {
		if (emojiIn(m[1] ?? "").length > 0) {
			ctx.report(file, n, "emoji in link text");
		}
	}
	checkAdmonition(ctx, file, n, line);
	const h = /^#{1,6}\s+(.*?)\s*#*\s*$/u.exec(line);
	if (h !== null) {
		checkHeading(ctx, file, n, h[1] ?? "");
	}
};

interface Fence {
	ch: string;
	len: number;
}

/** Returns the fence after `line`, or `undefined` when `line` is no fence marker. */
const advanceFence = (
	line: string,
	fence: Fence | null,
): Fence | null | undefined => {
	const f = /^\s*(`{3,}|~{3,})/u.exec(line);
	if (f === null) {
		return undefined;
	}
	const marks = f[1] ?? "";
	const ch = marks.charAt(0);
	const len = marks.length;
	if (fence === null) {
		return { ch, len };
	}
	const closes =
		fence.ch === ch && len >= fence.len && /^\s*[`~]+\s*$/u.test(line);
	return closes ? null : fence;
};

export const checkBody = (
	ctx: Ctx,
	file: string,
	text: string,
	bodyStart: number,
): void => {
	const lines = text.split("\n");
	let fence: Fence | null = null;
	for (const [i, line] of lines.entries()) {
		if (i < bodyStart) {
			continue;
		}
		const next = advanceFence(line, fence);
		if (next !== undefined) {
			fence = next;
		} else if (fence === null) {
			checkProseLine(ctx, file, i + 1, line);
		}
	}
};
