// Kind `permission-rule`: permission modes (rule forms are not listed).
// Anchor (checked on 2.1.309, task 1.1): the zod enum described "Permission mode for controlling how tool
// executions are handled…": a `.describe("Permission mode for controlling…")` call on a call that holds
// the all-string array `["default","acceptEdits","bypassPermissions","plan","dontAsk","auto"]`. `detail`
// is "mode".
// Rule forms (`Bash(npm run *)`, `Read(./.env)`) have no reliable anchor: the parser that returns
// `{toolName, ruleContent}` and prints `${toolName}(${content})` is code, not a list of forms, and a form
// is a pattern a user writes, not a literal. So only modes are listed.
// The old `strings` heuristic has no permission list, so there is nothing to compare.
import { children, constString, type Node } from "../ast.ts";
import {
	asNode,
	type Extractor,
	scan,
	strings,
	type SurfaceItem,
	unique,
} from "./common.ts";

const DESCRIPTION =
	"Permission mode for controlling how tool executions are handled";

export const extractPermissionRules: Extractor = (bundle) => {
	const out: SurfaceItem[] = [];
	scan(bundle, [DESCRIPTION], (m, n) => {
		if (
			n.type !== "CallExpression" ||
			n.callee.type !== "MemberExpression" ||
			n.callee.property.type !== "Identifier" ||
			n.callee.property.name !== "describe" ||
			constString(m, asNode(n.arguments[0]))?.startsWith(DESCRIPTION) !== true
		) {
			return;
		}
		const root = asNode(n.callee.object);
		const stack: Node[] = root ? [root] : [];
		for (let x = stack.pop(); x !== undefined; x = stack.pop()) {
			for (const name of strings(m, x) ?? []) {
				out.push({
					kind: "permission-rule",
					name,
					module: m.name,
					offset: x.start,
					detail: "mode",
				});
			}
			stack.push(...children(x));
		}
	});
	return unique(out);
};
