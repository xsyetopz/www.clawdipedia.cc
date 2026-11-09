// Fact-results part of the selftest: facts.json against two compared runs, worklist, diff and schema facts.
import { join } from "node:path";

import { type Compare, compareRuns, renderCompare } from "../compare.ts";
import { factRow, type Step } from "./fixture.ts";

const resultsOf = (c: Compare): Record<string, string | undefined> =>
	Object.fromEntries((c.facts ?? []).map((f) => [f.id, f.result]));

const writeFacts = (b: string): Promise<number> =>
	Bun.write(
		join(b, "facts.json"),
		JSON.stringify([
			factRow("c.changed", ["print.one"], "behaviour"),
			factRow("c.same", ["print.same"], "behaviour"),
			factRow("c.notrun", ["print.same", "print.missing"], "behaviour"),
			factRow("c.sweep", ["print.sweep"], "env", { diffNames: ["FOO_BAR"] }),
			factRow("c.new", ["print.new-only"], "behaviour"),
			factRow("c.manual", [], "manual"),
			factRow("c.nodiff", [], "flag", { diffNames: ["--new-flag"] }),
			factRow("c.prose", [], "setting"),
			factRow("c.schema", [], "schema", { diffNames: ["sandbox.fooKey"] }),
			factRow("c.schema2", [], "schema", { diffNames: ["sandbox.barKey"] }),
			factRow("c.diffhit", [], "flag", { diffNames: ["--new-flag"] }),
			factRow("c.diffmiss", [], "flag", { diffNames: ["--other"] }),
			factRow("c.static", [], "static", { status: "static" }),
		]),
	);

const resultChecks = (step: Step, c2: Compare): void => {
	const res = resultsOf(c2);
	const json = JSON.stringify(res);
	step(
		"compare: fact results",
		res["c.changed"] === "changed" &&
			res["c.same"] === "unchanged" &&
			res["c.notrun"] === "not-run" &&
			res["c.static"] === undefined,
		json,
	);
	step(
		"compare: case only on `to` is changed; manual, no-diff and bare facts are not-run",
		res["c.new"] === "changed" &&
			res["c.manual"] === "not-run" &&
			res["c.nodiff"] === "not-run" &&
			res["c.prose"] === "not-run" &&
			res["c.schema"] === "not-run",
		json,
	);
	step(
		"compare: sweep fact only sees its own names",
		res["c.sweep"] === "unchanged",
	);
	const md = renderCompare(c2);
	step(
		"compare.md: worklist first",
		md.indexOf("## Worklist") < md.indexOf("## Cases") &&
			md.includes("`c.notrun`") &&
			!md.includes("`c.same`"),
	);
};

const writeDiffFiles = async (b: string, docs: string): Promise<void> => {
	await Bun.write(
		join(b, "schemas-diff.json"),
		JSON.stringify({ files: { x: { added: ["sandbox.fooKey"] } } }),
	);
	await Bun.write(
		join(docs, "p.md"),
		"Uses `--seen <v>` and `--new-flag-ish`.\n",
	);
	await Bun.write(
		join(b, "diff", "flags.json"),
		JSON.stringify({
			kind: "flags",
			added: ["--new-flag", "--seen"],
			removed: [],
			changed: [],
		}),
	);
};

const diffChecks = async (
	step: Step,
	base: string,
	b: string,
	docs: string,
): Promise<void> => {
	await writeDiffFiles(b, docs);
	const c3 = await compareRuns("1.0.0", "1.0.1", base, false, docs);
	step(
		"compare: uncovered diff names (whole backtick tokens in docs/)",
		c3.uncoveredNames?.length === 1 &&
			c3.uncoveredNames[0]?.name === "--new-flag",
		JSON.stringify(c3.uncoveredNames),
	);
	const r3 = resultsOf(c3);
	step(
		"compare: diff and schema facts",
		r3["c.diffhit"] === "changed" &&
			r3["c.diffmiss"] === "unchanged" &&
			r3["c.schema"] === "changed" &&
			r3["c.schema2"] === "unchanged" &&
			r3["c.manual"] === "not-run",
		JSON.stringify(r3),
	);
	const facts = await Bun.file(join(b, "facts.json")).text();
	step(
		"compare: json round trip",
		facts.length > 0 && structuredClone(c3).to === "1.0.1",
	);
};

export const runResultsChecks = async (
	step: Step,
	root: string,
	base: string,
	b: string,
): Promise<void> => {
	await writeFacts(b);
	resultChecks(step, await compareRuns("1.0.0", "1.0.1", base, false));
	await diffChecks(step, base, b, join(root, "docs"));
};
