// Facts part of the selftest: classes, ids, stability, diff names, --check, and the cli args.
import { join } from "node:path";

import { applyMap, isFactMap, loadDiffNames } from "../apply.ts";
import { normaliseArgs } from "../args.ts";
import { checkFacts } from "../parts/check.ts";
import { classify, factsFromFile } from "../scan.ts";
import { DOC, type Step } from "./fixture.ts";

const LINES = DOC.split("\n").flatMap((l, i) =>
	/2\.1\.\d+/u.test(l) ? [i + 1] : [],
);
const CS = factsFromFile("docs/x.md", DOC, LINES);

const classChecks = (step: Step): void => {
	step(
		"facts: 6 candidates, frontmatter and fences skipped",
		CS.length === 6,
		String(CS.length),
	);
	step(
		"facts: classes",
		CS.map((c) => c.class).join(",") === "change,change,info,gap,change,change",
		CS.map((c) => c.class).join(","),
	);
	step(
		"facts: heading in id (one hyphen per space)",
		CS.slice(0, 5).every((c) => c.id.startsWith("docs/x.md#some-heading:")) &&
			CS[5]?.id.startsWith("docs/x.md#another--heading:") === true,
		CS[5]?.id,
	);
	step(
		"classify: removed in, before, from, or later",
		[
			"Removed in 2.1.3.",
			"Dropped in 2.1.3.",
			"Before 2.1.3 it was.",
			"Older than 2.1.3.",
			"Works from 2.1.3 on.",
			"Needs `2.1.3` or later.",
			"Needs 2.1.3 and newer.",
		].every((t) => classify(t.replace("2.1.3", "2.1.30")) === "change") &&
			classify("A line about 2.1.305 from the log.") === "info",
	);
	step(
		"classify: bare version is info",
		classify("It ran on 2.1.305.") === "info",
	);
};

const idChecks = (step: Step): void => {
	const moved = factsFromFile(
		"docs/x.md",
		`\n\n\n${DOC}`,
		LINES.map((n) => n + 3),
	);
	step(
		"facts: ids survive a line move",
		moved.map((c) => c.id).join(",") === CS.map((c) => c.id).join(","),
	);
	const edited = factsFromFile(
		"docs/x.md",
		DOC.replace("it is faster", "it is slower"),
		LINES,
	);
	step(
		"facts: id changes with the text",
		edited[0]?.id !== CS[0]?.id && edited[1]?.id === CS[1]?.id,
	);
	const ws = factsFromFile(
		"docs/x.md",
		DOC.replace("Does a thing.", "Does   a  THING."),
		LINES,
	);
	step("facts: id ignores case and spacing", ws[0]?.id === CS[0]?.id);
};

/** Writes two diff files, then checks the automatic kinds. Returns the names it loaded. */
const diffChecks = async (step: Step, root: string) => {
	await Bun.write(
		join(root, "2.1.2", "diff", "flags.json"),
		JSON.stringify({
			kind: "flags",
			added: ["--baz"],
			items: { "--baz": "x" },
		}),
	);
	await Bun.write(
		join(root, "2.1.2", "diff", "strings-env.json"),
		JSON.stringify({ kind: "env", added: [], items: { FOO_BAR: "" } }),
	);
	const names = await loadDiffNames("2.1.2", root);
	const mapped = applyMap(CS, {}, names);
	step(
		"facts: auto kind from the row subject",
		mapped[0]?.kind === "env" && mapped[0].status === "mapped",
	);
	step("facts: prose is not auto-mapped", mapped[1]?.status === "unmapped");
	const none = await loadDiffNames("9.9.9", join(root, "none"));
	step(
		"facts: no diff dir means no auto kinds",
		applyMap(CS, {}, none)[0]?.status === "unmapped",
	);
	return { names, mapped };
};

const checkChecks = (
	step: Step,
	names: Awaited<ReturnType<typeof loadDiffNames>>,
	mapped: ReturnType<typeof applyMap>,
): void => {
	const withMap = applyMap(
		CS,
		{ [CS[1]?.id ?? ""]: { kind: "behaviour", probes: ["print.a"] } },
		names,
	);
	const stale = "docs/x.md#stale:11111111";
	const raw: unknown = {
		[CS[1]?.id ?? ""]: { kind: "behaviour", probes: ["print.a", "print.gone"] },
		"docs/x.md#gone:00000000": { kind: "static", probes: [] },
		"docs/x.md#bad:00000000": { kind: "bogus", probes: [] },
	};
	const chk = checkFacts(
		withMap.filter((c) => c.class === "change").slice(0, 2),
		isFactMap(raw) ? raw : {},
		{
			ids: new Set(["print.a", "print.unused"]),
			facts: new Map([["print.a", new Set([stale])]]),
			fromDisk: true,
		},
		withMap,
	);
	step(
		"facts --check: errors and warnings",
		chk.errors.length === 1 &&
			chk.errors[0]?.includes("bogus") === true &&
			chk.warnings.length === 6,
		`${chk.errors.length} errors, ${chk.warnings.length} warnings`,
	);
	step(
		"facts --check: unmapped fails",
		checkFacts(
			mapped.filter((c) => c.class === "change").slice(0, 2),
			{},
			{ ids: new Set(), facts: new Map(), fromDisk: true },
		).errors.length === 1,
	);
};

const noDiskChecks = (step: Step): void => {
	const nodisk = checkFacts(
		[],
		{
			a: { kind: "behaviour", probes: ["print.x", "live.gone"] },
		},
		{ ids: new Set(), facts: new Map(), fromDisk: false },
	);
	step(
		"facts --check: without results only live.* ids are checked",
		nodisk.warnings.some((w) => w.includes("live.gone")) &&
			!nodisk.warnings.some((w) => w.includes("print.x (")),
	);
};

const args = (n: string, ...a: string[]) => normaliseArgs(n, a);

const argChecks = (step: Step): void => {
	step(
		"cli: compare <from> <to> becomes --from/--to",
		args("compare", "2.1.304", "2.1.305", "--samples").args.join(" ") ===
			"--from 2.1.304 --to 2.1.305 --samples" &&
			args("compare", "--from", "2.1.304", "--to", "2.1.305").error ===
				undefined,
	);
	step(
		"cli: leftover positionals are an error",
		args("compare", "2.1.305").error !== undefined &&
			args("compare", "2.1.305", "../../etc").error !== undefined &&
			args("compare", "--to", "2.1.304", "2.1.305").error !== undefined &&
			args("facts", "x").error !== undefined &&
			args("facts", "--check").error === undefined,
	);
};

export const runFactsChecks = async (
	step: Step,
	root: string,
): Promise<void> => {
	classChecks(step);
	idChecks(step);
	const { names, mapped } = await diffChecks(step, root);
	checkChecks(step, names, mapped);
	noDiskChecks(step);
	argChecks(step);
};
