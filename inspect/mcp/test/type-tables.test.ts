import { describe, expect, test } from "bun:test";

import {
	aliasOf,
	checkTables,
	newWords,
	normalizeType,
	typeFields,
	typeFile,
} from "../src/type-tables.ts";

// A small type file in the shape the program writes: two-space declarations inside a module block.
const SRC = `declare module 'claude-code' {
  /**
   * Options of the ask call.
   */
  export type AskOptions = {
      /**
       * The labels.
       */
      options?: readonly string[];
      /** A chip. */
      header: string;
  };

  export type Result = {
      isSent: true;
  } | {
      isSent: false;
      reason?: string;
  };

  type CancelArgs = {
      key: string;
  };

  export type Table<P extends Surface = Surface> = Elements[P];

  export type RenderPropsOf = {
      Spinner: Base & {
          /** The word. */
          word: string;
      };
  };

  export type Base = {
      /** Shared. */
      id: string;
  };

  export interface CoreEngineInterface {
      ui: {
          /** Shows a line. */
          notice: (id: string, text: string | undefined) => void;
          last: () => void;
      };
  }

  export type EngineEventOf = {
      /** Fires on a cancel. */
      'ui.cancel': CancelArgs;
  };

  export type OpValueOf = {
      'ui.cancel': void;
  };
}
`;
const F = typeFile(SRC);

const table = (heading: string, rows: string[]) =>
	[
		heading,
		"",
		"| Field | Status | What it is for | Type and limits |",
		"| --- | --- | --- | --- |",
		...rows,
		"",
	].join("\n");

describe("typeFields", () => {
	test("members with their type, `?`, and doc comment", () => {
		expect(
			typeFields(F, "AskOptions")?.map((m) => [
				m.name,
				m.type,
				m.optional,
				m.doc,
			]),
		).toEqual([
			["options", "readonly string[]", true, "The labels."],
			["header", "string", false, "A chip."],
		]);
	});
	test("every variant of a union", () => {
		expect(typeFields(F, "Result")?.map((m) => `${m.name}:${m.type}`)).toEqual([
			"isSent:true",
			"isSent:false",
			"reason:string",
		]);
	});
	test("undefined for a name the file does not declare", () => {
		expect(typeFields(F, "Nope")).toBeUndefined();
	});
});

describe("normalizeType and aliasOf", () => {
	test("commas between object members become semicolons, but not in parameters", () => {
		expect(
			normalizeType("{ a: string, b?: (x: number, y: number) => void }"),
		).toBe("{a: string; b?: (x: number, y: number) => void}");
	});
	test("the text after the type parameters and `=`", () => {
		expect(aliasOf(F, "Table")).toBe("Elements[P]");
	});
});

describe("checkTables", () => {
	test("a table that matches the type", () => {
		const md = table("### `AskOptions`", [
			"| `options` | <Documented /> | The labels. | Type: `readonly string[]`. Optional. |",
			"| `header` | <Documented /> | A chip. | Type: `string`. |",
		]);
		const r = checkTables(md, F);
		expect(r.mismatches).toEqual([]);
		expect(r.checked.map((c) => c.name)).toEqual([
			"AskOptions.options",
			"AskOptions.header",
		]);
	});
	test("a wrong type, a wrong optional mark, a member with no row, and an unknown row", () => {
		const md = table("### `AskOptions`", [
			"| `options` | <Documented /> | x | Type: `string[]`. Optional. |",
			"| `extra` | <Documented /> | x | Type: `string`. |",
		]);
		expect(checkTables(md, F).mismatches.map((m) => m.text)).toEqual([
			"AskOptions.options: type `string[]`, file has `readonly string[]`",
			"AskOptions.extra: no such member",
			"AskOptions: no row for member `header`",
		]);
		const opt = table("### `AskOptions`", [
			"| `options` | <Documented /> | x | Type: `readonly string[]`. |",
			"| `header` | <Documented /> | x | Type: `string`. Optional. |",
		]);
		expect(checkTables(opt, F).mismatches.map((m) => m.text)).toEqual([
			"AskOptions.options: member is optional",
			"AskOptions.header: member is required",
		]);
	});
	test("a union row matches any variant", () => {
		const md = table("### `Result`", [
			"| `isSent` | <Documented /> | x | Type: `false`. |",
			"| `reason` | <Documented /> | x | Type: `string`. Optional. |",
		]);
		expect(checkTables(md, F).mismatches).toEqual([]);
	});
	test("a render component: its props, with base members optional to list", () => {
		const md = table("### Spinner", [
			"| `word` | <Documented /> | x | `string`. Read-only. |",
		]);
		const r = checkTables(md, F);
		expect(r.mismatches).toEqual([]);
		expect(r.checked.map((c) => c.name)).toEqual(["Spinner.word"]);
	});
	test("calls, events, and aliases", () => {
		const md = [
			"## Calls",
			"",
			"| Item | Status | What it does | How it works |",
			"| --- | --- | --- | --- |",
			"| `$.ui.notice` | <Documented /> | x | y |",
			"| `$.ui.last` | <Documented /> | x | y |",
			"| `$.ui.gone` | <Documented /> | x | y |",
			"| `ui.cancel` | <Documented /> | x | Input `{ key: string }`. Result `void`. |",
			"| `ui.other` | <Documented /> | x | Input `X`. |",
			"| `Table` | <Documented /> | x | Generic alias of `Elements[P]`. |",
			"| `Missing` | <Documented /> | x | Alias of `string`. |",
		].join("\n");
		expect(checkTables(md, F).mismatches.map((m) => m.text)).toEqual([
			"`$.ui.gone` is not a member of the engine",
			"event `ui.other` is in no event map",
			"`Missing`: the type file declares no such alias",
		]);
	});
});

describe("newWords", () => {
	test("page words the doc comment lacks, ignoring plurals, footnotes, and plain words", () => {
		expect(
			newWords(
				"Shows the lines on a surface.[^x] <Documented />",
				"Shows a line.",
			),
		).toEqual(["surface"]);
	});
});
