// Shared by the diff, notes, and explain tests: an Index of one small program text.
import { Bundle } from "../src/ast.ts";
import { type Index, unitsOf } from "../src/prepare.ts";

/** Parse `text` as the module `a.js` and return an Index with its units. */
export const indexOf = async (text: string): Promise<Index> => {
	const bundle = await Bundle.parse([{ name: "/$bunfs/root/a.js", text }]);
	const m = bundle.get("a.js");
	if (m === undefined) {
		throw new Error("module a.js is missing");
	}
	return {
		version: "0",
		binary: { size: 0, mtime: 0 },
		skipped: {},
		chunks: {},
		units: unitsOf("a.js", m),
	};
};
