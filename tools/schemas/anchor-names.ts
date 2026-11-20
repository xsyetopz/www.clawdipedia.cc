// Guard for the anchors of tools/schemas/manual/: an anchor that spells out a minified identifier (`n`, `IYe`, `a8t`)
// breaks on the next build, because the minifier renames them. Such a name belongs at a `«»` (see manual.ts).

// Words and literals that are short but never minified names.
const KEYWORDS = new Set([
	"as",
	"do",
	"for",
	"get",
	"if",
	"in",
	"let",
	"new",
	"null",
	"of",
	"set",
	"this",
	"true",
	"try",
	"var",
	"void",
	"await",
	"false",
	"typeof"
]);
/**
 * Short names an anchor may spell out, because they are global classes the minifier cannot rename. Add a name only
 * when it is a built-in; a name the program declares itself belongs to the minifier, and the anchor needs `«»` there.
 */
export const ALLOWED_NAMES: ReadonlySet<string> = new Set(["Map", "Set"]);
/** The longest identifier the guard treats as a minified name; the program's own names are longer. */
const MAX_MINIFIED = 3;
// A regex literal follows one of these characters (or the start), where a division could not stand.
const BEFORE_REGEX = "=(,:!&|?{};";

/** Scanner state: the text, its blanked copy, the position, and the brace depth of each open `${`. */
interface Scan {
	text: string;
	out: string[];
	at: number;
	depth: number;
	templates: number[];
}

/** Blank the body of a string or regex literal that starts at `s.at`, and leave `s.at` on its closing character. */
const blankQuoted = (s: Scan, close: string): void => {
	s.at++;
	while (s.at < s.text.length && s.text[s.at] !== close) {
		if (s.text[s.at] === "\\") {
			s.out[s.at++] = " ";
		}
		s.out[s.at++] = " ";
	}
};

/** Blank the text of a template literal from `s.at`; stop after a `${`, whose expression is code. */
const blankTemplate = (s: Scan): void => {
	s.at++;
	while (s.at < s.text.length && s.text[s.at] !== "`") {
		if (s.text[s.at] === "$" && s.text[s.at + 1] === "{") {
			s.templates.push(s.depth++);
			s.out[s.at] = " ";
			s.out[s.at + 1] = " ";
			s.at += 2;
			return;
		}
		if (s.text[s.at] === "\\") {
			s.out[s.at++] = " ";
		}
		s.out[s.at++] = " ";
	}
	s.at++;
};

/** Handle the character at `s.at` that opens or closes a literal; true when it moved `s.at` past it. */
const scanSpecial = (s: Scan): boolean => {
	const c = s.text[s.at];
	if (c === '"' || c === "'") {
		blankQuoted(s, c);
	} else if (c === "`") {
		blankTemplate(s);
		return true;
	} else if (c === "{") {
		s.depth++;
	} else if (c === "}") {
		s.depth--;
		if (s.templates.at(-1) === s.depth) {
			s.templates.pop();
			blankTemplate(s);
			return true;
		}
	} else if (
		c === "/" &&
		s.text[s.at + 1] !== "/" &&
		s.text[s.at + 1] !== "*"
	) {
		const before = s.text.slice(0, s.at).trimEnd().at(-1);
		if (before === undefined || BEFORE_REGEX.includes(before)) {
			blankQuoted(s, "/");
		}
	}
	return false;
};

/** `text` with the body of each string, template text, and regex literal blanked, so only code is left. */
const blankLiterals = (text: string): string => {
	const s: Scan = { text, out: text.split(""), at: 0, depth: 0, templates: [] };
	while (s.at < text.length) {
		if (!scanSpecial(s)) {
			s.at++;
		}
	}
	return s.out.join("");
};

/** Whether the name that starts at `at` of `code` stands where a name is declared or used, not a key or property. */
const isUse = (code: string, at: number, name: string): boolean => {
	const before = code.slice(0, at).trimEnd();
	// A property after `.` or `?.`; the operand of a spread (`...n`) is a name.
	if (before.endsWith(".") && !before.endsWith("...")) {
		return false;
	}
	const last = before.at(-1);
	const isKey =
		code
			.slice(at + name.length)
			.trimStart()
			.startsWith(":") &&
		(last === undefined || last === "{" || last === ",");
	return !isKey;
};

/**
 * The minified identifiers an anchor spells out, which the next build renames: a name of 1 to 3 characters in code
 * that is not a keyword, a literal, a property after `.` or `?.`, an object key, or in ALLOWED_NAMES. Strings,
 * templates, and regex literals are not code.
 */
export const minifiedNames = (anchor: string): string[] => {
	const code = blankLiterals(anchor);
	const names: string[] = [];
	for (const m of code.matchAll(/(?<![\w$])[A-Za-z_$][\w$]*/gu)) {
		const [name] = m;
		if (
			name.length <= MAX_MINIFIED &&
			!KEYWORDS.has(name) &&
			!ALLOWED_NAMES.has(name) &&
			isUse(code, m.index, name)
		) {
			names.push(name);
		}
	}
	return names;
};
