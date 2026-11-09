// The env var heuristic on `strings -a` of a Claude Code binary, used by the print sweep.
// Everything here is a text heuristic on minified code; names are stable, minified identifiers are never used.

/** name -> detail ("" when there is none). */
export type Items = Map<string, string>;

/** The prefixes the docs use for environment variable names (same filter as the 2.1.305 sweep list). */
export const ENV_PREFIXES = [
	"ANTHROPIC",
	"API",
	"BASH",
	"CLAUDE",
	"DISABLE",
	"ENABLE",
	"IS",
	"MAX",
	"MCP",
	"NO",
	"OTEL",
	"USE",
];

const compare = (a: string, b: string): number => {
	if (a === b) {
		return 0;
	}
	return a < b ? -1 : 1;
};

const sorted = (m: Items): Items =>
	new Map([...m].toSorted(([a], [b]) => compare(a, b)));

/** Prefixes that also start many non-env words (NO_THREAD, MAX_VALUE, IS_SHELL, MCP_FILE_UNREAD, ...). */
const GENERIC = new Set(["API", "BASH", "IS", "MAX", "MCP", "NO", "USE"]);

/**
 * Does this occurrence look like an environment read or an env-name list entry?
 * Generic prefixes must be `x.NAME`, an entry of a quoted list (`["A","NAME"]`), or a registry key (`NAME:()=>`).
 * `NAME:{`, ` as NAME` and `code:"NAME"` are rejected for every prefix.
 */
const readContext = (text: string, i: number, name: string): boolean => {
	const end = i + name.length;
	const prev = text[i - 1] ?? "";
	const after = text.slice(end, end + 3);
	if (after.startsWith(":{") || text.slice(i - 4, i) === " as ") {
		return false;
	}
	if (!GENERIC.has(name.slice(0, name.indexOf("_")))) {
		return true;
	}
	if (prev === "." || after.startsWith(":()=>")) {
		return true;
	}
	if (prev === '"' && after.startsWith('"')) {
		const before = text[i - 2] ?? "";
		return (before === "[" || before === ",") && /^"[,\]]/u.test(after);
	}
	return false;
};

export const extractEnv = (text: string): Items => {
	const re = new RegExp(
		`(?<![A-Z0-9_])(?:${ENV_PREFIXES.join("|")})_[A-Z0-9_]*[A-Z0-9](?![A-Z0-9_])`,
		"gu",
	);
	// A name at the start of a line, followed by a letter or the line end, is a string-table entry with stray bytes glued on (e.g. `CLAUDE_CODE_NEW_INITR`).
	// Real reads sit inside code, so a name counts only when it appears at least once inside a longer line.
	const count = new Map<string, number>();
	// generic names that are also `NAME:{...}` keys of a code table
	const tableKeys = new Set<string>();
	for (const m of text.matchAll(re)) {
		const i = m.index ?? 0;
		const next = text[i + m[0].length] ?? "\n";
		const alone = (i === 0 || text[i - 1] === "\n") && /[a-z\n]/u.test(next);
		if (
			GENERIC.has(m[0].slice(0, m[0].indexOf("_"))) &&
			text.startsWith(":{", i + m[0].length)
		) {
			tableKeys.add(m[0]);
		}
		if (!alone && readContext(text, i, m[0])) {
			count.set(m[0], (count.get(m[0]) ?? 0) + 1);
		}
	}
	// Prose strings also get one stray byte glued on (`unset CLAUDE_CODE_SIMPLE` + `7`): a rare name whose
	// name minus its last character is also a name is that glue.
	const out: Items = new Map();
	for (const [n, c] of count) {
		if (!(c <= 2 && count.has(n.slice(0, -1))) && !tableKeys.has(n)) {
			out.set(n, "");
		}
	}
	return sorted(out);
};
