import { expect, test } from "bun:test";

import { diffIndexes } from "../src/diff.ts";
import { checkNotes } from "../src/notes.ts";
import { indexOf } from "./bundle-index.ts";

const before = `function g(a,b){return b}
var t={name:"Monitor",isEnabled(){return g("tengu_amber_sentinel",!1)}};`;
const after = `function g(a,b){return b}
var t={name:"Monitor",isEnabled(){return process.platform!=="windows"}};
function h(n){return n>2?["effort-2025-11-24"]:[]}`;

const NOTES = `## 2.1.310

- Added the Monitor tool for streaming events from a background script
- Fixed requests failing when \`effort-2025-11-24\` was sent twice
- Added \`CLAUDE_CODE_FOO\` to turn off the foo
- [Cloud sessions] Improved the checklist view
`;

test("notes lines are matched by a code span, gated by a subject, or left unmatched", async () => {
	const d = diffIndexes(await indexOf(before), await indexOf(after));
	const lines = checkNotes(NOTES, d, ["- env CLAUDE_CODE_FOO (added)"]);
	expect(lines.map((l) => l.status)).toEqual([
		"gated",
		"matched",
		"matched",
		"unmatched",
	]);
	const [monitor, effort, env, cloud] = lines;
	expect(monitor?.change?.to?.k).toBe("isEnabled");
	expect(monitor?.hits).toEqual(["Monitor"]);
	expect(effort?.change?.kind).toBe("added");
	expect(effort?.hits).toEqual(["effort-2025-11-24"]);
	expect(env?.item).toBe("- env CLAUDE_CODE_FOO (added)");
	expect(cloud?.change).toBeUndefined();
	expect(cloud?.item).toBeUndefined();
});
