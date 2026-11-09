// Text helpers for the parts of the program that are not JavaScript, such as the JSON template in a
// prompt. JavaScript itself is read with the parser in inspect/mcp/src/ast.ts.

/** Index after the string or template literal that starts at `i`. */
export const skipString = (s: string, i: number): number => {
	const q = s[i];
	let j = i + 1;
	while (j < s.length) {
		const c = s[j];
		if (c === "\\") {
			j += 2;
		} else if (c === q) {
			return j + 1;
		} else if (q === "`" && c === "$" && s[j + 1] === "{") {
			j = matchClose(s, j + 1) + 1;
		} else {
			j++;
		}
	}
	return s.length;
};

/** Index of the bracket that closes the one at `i`. */
export const matchClose = (s: string, i: number): number => {
	let depth = 0;
	let j = i;
	while (j < s.length) {
		const c = s.charAt(j);
		if (c === '"' || c === "'" || c === "`") {
			j = skipString(s, j);
			continue;
		}
		if (c === "(" || c === "[" || c === "{") {
			depth++;
		} else if (c === ")" || c === "]" || c === "}") {
			depth--;
			if (depth === 0) {
				return j;
			}
		}
		j++;
	}
	return -1;
};

/** Split `s` at top-level occurrences of `sep` (a single character or `&&`). */
export const splitTop = (s: string, sep: string): string[] => {
	const out: string[] = [];
	let depth = 0;
	let last = 0;
	let j = 0;
	while (j < s.length) {
		const c = s.charAt(j);
		if (c === '"' || c === "'" || c === "`") {
			j = skipString(s, j);
			continue;
		}
		if (c === "(" || c === "[" || c === "{") {
			depth++;
		} else if (c === ")" || c === "]" || c === "}") {
			depth--;
		} else if (depth === 0 && s.startsWith(sep, j)) {
			out.push(s.slice(last, j));
			j += sep.length;
			last = j;
			continue;
		}
		j++;
	}
	out.push(s.slice(last));
	return out;
};
