// Port of render() in driver.py, so a slice of RAW (cut at a RAW.idx offset) renders the same way as screen.txt.
const ESC = String.fromCodePoint(27);
const BEL = String.fromCodePoint(7);
const ANSI = new RegExp(
	[
		String.raw`${ESC}\[[0-?]*[ -/]*[@-~]`,
		String.raw`${ESC}\][^${BEL}${ESC}]*(?:${BEL}|${ESC}\\)`,
		String.raw`${ESC}[PX^_][^${ESC}]*(?:${ESC}\\)?`,
		String.raw`${ESC}[=>()][A-Z0-9]?`,
		String.raw`${ESC}[78MDEHc]`,
	].join("|"),
	"gu",
);

/** Readable text: cursor-forward becomes spaces, cursor-down and home become line breaks, CR overwrites the line, other escapes are dropped, spaces collapse. */
export const renderRaw = (data: Uint8Array): string => {
	let s = Buffer.from(data).toString("utf8");
	s = s
		.replaceAll(new RegExp(String.raw`${ESC}\[(\d*)C`, "gu"), (_m, n: string) =>
			" ".repeat(Number(n || 1)),
		)
		.replaceAll(new RegExp(String.raw`${ESC}\[(\d*)B`, "gu"), (_m, n: string) =>
			"\n".repeat(Math.min(Number(n || 1), 3)),
		)
		.replaceAll(new RegExp(String.raw`${ESC}\[\d*(?:;\d*)?[Hf]`, "gu"), "\n")
		.replaceAll(ANSI, "");
	const lines: string[] = [];
	let cur: string[] = [];
	let col = 0;
	for (const ch of s) {
		if (ch === "\n") {
			lines.push(cur.join(""));
			cur = [];
			col = 0;
		} else if (ch === "\r") {
			col = 0;
		} else if (ch === "\b") {
			col = Math.max(0, col - 1);
		} else if (ch < " " && ch !== "\t") {
			continue;
		} else {
			if (col < cur.length) {
				cur[col] = ch;
			} else {
				cur.push(ch);
			}
			col++;
		}
	}
	lines.push(cur.join(""));
	return lines.map((l) => l.replaceAll(/[ \t]+/gu, " ").trim()).join("\n");
};
