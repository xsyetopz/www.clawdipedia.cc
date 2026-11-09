// The Chicago Title Case rule of check:docs. Chicago lowercases a preposition
// whatever its length, so a heading may write "Behind" or "behind".
import { expect, test } from "bun:test";

import { titleCaseProblems } from "./title-case.ts";

test("accepts a capitalized heading", () => {
	expect(titleCaseProblems("Pin the Models Behind an Alias")).toEqual([]);
	expect(titleCaseProblems("Skill Discovery After a Bash `cd`")).toEqual([]);
});

test("accepts a lowercase preposition inside a heading", () => {
	expect(titleCaseProblems("Pin the Models behind an Alias")).toEqual([]);
	expect(titleCaseProblems("Skill Discovery after a Bash `cd`")).toEqual([]);
	expect(titleCaseProblems("What Runs between Two Turns")).toEqual([]);
	expect(titleCaseProblems("Keys You Cannot Rebind during a Turn")).toEqual([]);
});

test("accepts a lowercase article and conjunction", () => {
	expect(titleCaseProblems("Hooks and the Order of a Turn")).toEqual([]);
});

test("flags a lowercase word that is not small", () => {
	expect(titleCaseProblems("Pin the models Behind an Alias")).toEqual([
		"models",
	]);
});

test("accepts a capitalized small word", () => {
	expect(titleCaseProblems("Run Claude Code With a Plugin")).toEqual([]);
	expect(titleCaseProblems("Get the API Key From a Script")).toEqual([]);
});

test("needs the first and the last word capitalized", () => {
	expect(titleCaseProblems("The Order of a Turn")).toEqual([]);
	expect(titleCaseProblems("a Hook Reads the Input")).toEqual(["a"]);
	expect(titleCaseProblems("What a Hook Reads from")).toEqual(["from"]);
});

test("ignores a code span and a link", () => {
	expect(titleCaseProblems("Set `autoCompactWindow` for a Subagent")).toEqual(
		[],
	);
	expect(titleCaseProblems("[Read the Hooks Page](hooks.md)")).toEqual([]);
});
