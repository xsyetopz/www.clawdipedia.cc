// Kind `beta`: `anthropic-beta` header values.
// Anchor (checked on 2.1.309, task 1.1): string literals of the form `<name>-YYYY-MM-DD`: mostly the
// registry calls `v("long_context","context-1m-2025-08-07")`, plus loose constants sent as
// "anthropic-beta" (`"ccr-byoc-2025-07-29"`, `"oauth-2025-04-20"`). Not only near the header name,
// because the registry is apart from it. When the literal is the second argument of a call whose first
// argument is a constant string, that string is the `detail` (`long_context`).
// The one registry value with a compact date, `v("claude_code","claude-code-20250219")`, counts only in
// that call shape, with word-only segments (`-YYYYMMDD`), so dated model ids do not match.
// Left out: `bedrock-2023-05-31` and `vertex-2023-10-16`, which have the same form but are values of
// `anthropic_version`, not betas.
// The old `strings` heuristic has no beta list, so there is nothing to compare.
import { constString, strLit } from "../ast.ts";
import {
	asNode,
	type Extractor,
	scan,
	type SurfaceItem,
	unique,
} from "./common.ts";

const BETA = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*-\d{4}-\d\d-\d\d$/u;
const COMPACT = /^[a-z]+(?:-[a-z]+)*-\d{8}$/u;
const VERSION = /^(?:bedrock|vertex)-/u;

export const extractBetas: Extractor = (bundle) => {
	const out: SurfaceItem[] = [];
	scan(bundle, ["-20"], (m, n) => {
		const name = strLit(n);
		if (name === undefined) {
			return;
		}
		const dated = BETA.test(name) && !VERSION.test(name);
		const compact = COMPACT.test(name);
		if (!dated && !compact) {
			return;
		}
		const p = m.parent(n);
		const group =
			p?.type === "CallExpression" && p.arguments[1] === n
				? constString(m, asNode(p.arguments[0]))
				: undefined;
		const hasGroup = group !== undefined && group !== "";
		if (!dated && !hasGroup) {
			return;
		}
		out.push({
			kind: "beta",
			name,
			module: m.name,
			offset: n.start,
			...(hasGroup && { detail: group }),
		});
	});
	return unique(out);
};
