// Instruction-file size warnings at start (ported from the p305-pty size runs; docs/configure/memory-and-rules.md).
// Each case writes CLAUDE.md files of a set size and reads the banner and the /status line. No model call is needed.
import {
	ESC,
	pre,
	type PtyCase,
	type PtyGroup,
	READY,
	shows,
} from "./harness.ts";

/** About `chars` characters of plain lines, ending with a newline. */
const body = (chars: number, tag: string): string => {
	const line = `${tag} filler line for the size probe, nothing here is an instruction.\n`;
	return `${line.repeat(Math.ceil(chars / line.length)).slice(0, chars - 1)}\n`;
};

interface Size {
	name: string;
	model: string;
	files: number;
	chars: number;
}
const SIZES: Size[] = [
	{ name: "sonnet-45k", model: "claude-sonnet-4-5", files: 1, chars: 45_600 },
	{ name: "opus-45k", model: "claude-opus-5-5", files: 1, chars: 45_600 },
	{ name: "sonnet-4x34k", model: "claude-sonnet-4-5", files: 4, chars: 34_400 },
	{ name: "opus-156k", model: "claude-opus-5-5", files: 1, chars: 156_000 },
	{ name: "opus-116k", model: "claude-opus-5-5", files: 1, chars: 116_000 },
];

/** Where the instruction files go: project CLAUDE.md, CLAUDE.local.md, a rules file, and the user CLAUDE.md. */
const FILES: { dir: "proj" | "cfg"; path: string }[] = [
	{ dir: "proj", path: "CLAUDE.md" },
	{ dir: "proj", path: "CLAUDE.local.md" },
	{ dir: "proj", path: ".claude/rules/size-a.md" },
	{ dir: "cfg", path: "CLAUDE.md" },
];

const sizeCase = (s: Size): PtyCase => {
	const projFiles: Record<string, string> = {};
	const cfgFiles: Record<string, string> = {};
	for (const f of FILES.slice(0, s.files)) {
		(f.dir === "proj" ? projFiles : cfgFiles)[f.path] = body(s.chars, f.path);
	}
	return {
		id: `sizes.${s.name}`,
		model: s.model,
		projFiles,
		cfgFiles,
		schedule: [READY, { t: 3, send: "/status\r", label: "status" }, ESC(8)],
		secs: 10,
		facts: ["memory.size-warning"],
		notes: `${s.files} instruction file(s) of ${s.chars} chars on ${s.model}; /status is a command, not a model prompt.`,
		data: (x) => ({
			...pre(
				shows(x, "shortcuts") || shows(x, "Claude Code"),
				"UI never started",
			),
			model: s.model,
			files: s.files,
			chars: s.chars,
			bannerOverLimit: shows(x, "-char limit"),
			bannerTotal: shows(x, "total limit"),
			statusLargeLine: shows(x, "will impact performance"),
			bannerLine:
				x.screen
					.split("\n")
					.find((l) => /limit/iu.test(l) && /chars/iu.test(l)) ?? "",
		}),
	};
};

export const sizesGroup: PtyGroup = {
	id: "sizes",
	title: "instruction file size warnings",
	cases: () => SIZES.map((s) => sizeCase(s)),
};
