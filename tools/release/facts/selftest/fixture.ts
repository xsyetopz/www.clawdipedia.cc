// Shared fixtures for the facts selftest parts.
import type { CaseResult } from "../../lib/results.ts";
import type { FactRow } from "../compare/types.ts";

export type Step = (name: string, ok: boolean, detail?: string) => void;

export const DOC = [
	"---",
	"title: T",
	"---",
	"## Some Heading",
	"",
	"Intro line.",
	"| `FOO_BAR` | Does a thing. Since `2.1.304` it is faster. |",
	"Plain sentence. Added in 2.1.305 the `--baz` flag exists. Another one.",
	"Tested on 2.1.305 only.",
	"Not checked on 2.1.306.",
	"````md",
	"```",
	"Since 2.1.399 inside a fence.",
	"```",
	"Since 2.1.398 still inside a longer fence.",
	"````",
	"Removed in 2.1.307 the thing; works on 2.1.300 or later.",
	"## Another — Heading",
	"Before 2.1.301 it differed.",
].join("\n");

export const kase = (
	version: string,
	id: string,
	data: CaseResult["data"],
	samples?: Record<string, string>,
): CaseResult => ({
	schema: 1,
	id,
	group: "print",
	version,
	prompt: "p",
	args: [],
	envSet: [],
	exit: 0,
	timedOut: false,
	data,
	...(samples ? { samples } : {}),
	facts: [],
});

export const factRow = (
	id: string,
	probes: string[],
	kind: string,
	extra: Partial<FactRow> = {},
): FactRow => ({
	id,
	file: "docs/x.md",
	line: 1,
	text: id,
	kind,
	probes,
	status: "mapped",
	...extra,
});
