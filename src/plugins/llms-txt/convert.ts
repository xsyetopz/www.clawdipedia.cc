// Turns a docs .md/.mdx source into plain markdown for agents (design: agent-access D1).
// Line based and fence aware: code fences are copied as they are, components become text.
import { CLAUDE_CODE_VERSION } from "../../version";

export type LinkResolver = (target: string) => string | null;

const BADGE_LABELS: Record<string, string> = {
	Documented: "Documented",
	Undocumented: "Undocumented",
	Differs: "Differs",
	Gated: "Gated",
	ManagedOnly: "Managed Only",
	Experimental: "Experimental",
	Deprecated: "Deprecated",
	Caution: "Caution",
};
const BADGE =
	/<(Documented|Undocumented|Differs|Gated|ManagedOnly|Experimental|Deprecated|Caution)(?:\s+note=(?:\{?"([^"]*)"\}?))?\s*\/>/gu;
const FENCE = /^\s*(`{3,}|~{3,})/u;
const ADMONITION = /^:::(\w+)(?:\[(.*)\])?\s*$/u;
const MARK = "\u0000";

/** The overview hero as text: its H1, lede, and badge key. */
export const HERO_TEXT = [
	"# Every Part of Claude Code You Can Use or Change",
	"",
	`Unofficial community docs for version \`${CLAUDE_CODE_VERSION}\`, built from the official docs and the program itself. Not made by or tied to Anthropic. For supported behavior, check the official docs first.`,
	"",
	"- [Documented] An official docs page names it.",
	"- [Undocumented] Only the program shows it. It can change without notice.",
	"- [Differs] The docs and the program disagree. The row says how.",
	"- [Gated] It works only behind a flag or a server gate.",
	"- [Managed Only] It works only in managed (organization policy) settings.",
	"- [Experimental] The program or the official docs call it experimental or beta.",
	"- [Deprecated] The program or the official docs call it deprecated.",
	"- [Caution] It deletes data, skips a safety check, or sends data off your machine.",
].join("\n");

export const stripFrontMatter = (raw: string): string => {
	const text = raw.replaceAll("\r\n", "\n");
	if (!text.startsWith("---\n")) {
		return text;
	}
	const end = text.indexOf("\n---", 3);
	if (end === -1) {
		return text;
	}
	return text.slice(text.indexOf("\n", end + 1) + 1);
};

/** Converts prose outside code spans. `inTable` keeps `\|` escaped. */
const convertInline = (
	line: string,
	inTable: boolean,
	resolve: LinkResolver,
): string => {
	const spans: string[] = [];
	let out = line.replaceAll(/(`+)(?!`)[\s\S]*?[^`]\1(?!`)/gu, (m) => {
		spans.push(m);
		return `${MARK}${spans.length - 1}${MARK}`;
	});
	out = out
		.replaceAll(BADGE, (_m, kind: string, note?: string) => {
			const label = BADGE_LABELS[kind] ?? kind;
			return note === undefined || note === ""
				? `[${label}]`
				: `[${label}: ${note}]`;
		})
		.replaceAll("{CLAUDE_CODE_VERSION}", CLAUDE_CODE_VERSION)
		.replaceAll(/\\([{}])/gu, "$1")
		.replaceAll(/\]\(([^)\s]+)((?:\s+"[^"]*")?)\)/gu, (m, target: string) => {
			const url = resolve(target);
			return url === null ? m : `](${url})`;
		});
	if (!inTable) {
		out = out.replaceAll(String.raw`\|`, "|");
	}
	const restore = new RegExp(`${MARK}(\\d+)${MARK}`, "gu");
	return out.replaceAll(restore, (_m, i: string) => spans[Number(i)] ?? "");
};

interface State {
	out: string[];
	fence: { char: string; len: number } | undefined;
	admonition: boolean;
	pendingTitle: string | undefined;
}

const push = (state: State, line: string): void => {
	const { out, pendingTitle } = state;
	if (state.admonition) {
		if (pendingTitle !== undefined && line.trim() !== "") {
			const plain = !/^\s*([-*+>|#]|\d+[.)]|`{3}|~{3})/u.test(line);
			out.push(
				plain
					? `> **${pendingTitle}:** ${line}`
					: `> **${pendingTitle}:**\n> ${line}`,
			);
			state.pendingTitle = undefined;
			return;
		}
		out.push(line === "" ? ">" : `> ${line}`);
		return;
	}
	if (line === "" && out.at(-1) === "") {
		return;
	}
	out.push(line);
};

/** Copies fence lines as they are. Returns true when the line was a fence line. */
const handleFence = (state: State, line: string): boolean => {
	const { fence } = state;
	const open = FENCE.exec(line)?.[1];
	if (fence) {
		push(state, line);
		if (
			open?.[0] === fence.char &&
			open.length >= fence.len &&
			line.trim() === open
		) {
			state.fence = undefined;
		}
		return true;
	}
	if (open !== undefined && open !== "") {
		state.fence = { char: open[0] ?? "`", len: open.length };
		push(state, line);
		return true;
	}
	return false;
};

/** Handles lines that are dropped or rewritten whole. Returns true when it did. */
const handleDirective = (state: State, line: string): boolean => {
	if (/^(import|export)\s/u.test(line)) {
		return true;
	}
	if (/^\s*<\/?FileTree>\s*$/u.test(line)) {
		return true;
	}
	if (/^\s*<Hero\s*\/>\s*$/u.test(line)) {
		for (const l of HERO_TEXT.split("\n")) {
			push(state, l);
		}
		return true;
	}
	const adm = ADMONITION.exec(line);
	if (adm && !state.admonition) {
		state.admonition = true;
		const type = adm[1] ?? "note";
		state.pendingTitle = adm[2] ?? type.charAt(0).toUpperCase() + type.slice(1);
		return true;
	}
	if (state.admonition && line.trim() === ":::") {
		state.admonition = false;
		state.pendingTitle = undefined;
		push(state, "");
		return true;
	}
	return false;
};

export const convertBody = (source: string, resolve: LinkResolver): string => {
	const state: State = {
		out: [],
		fence: undefined,
		admonition: false,
		pendingTitle: undefined,
	};
	for (const line of stripFrontMatter(source).split("\n")) {
		if (handleFence(state, line) || handleDirective(state, line)) {
			continue;
		}
		push(state, convertInline(line, line.trimStart().startsWith("|"), resolve));
	}
	while (state.out.at(-1) === "") {
		state.out.pop();
	}
	return state.out.join("\n");
};
