import { expect, test } from "bun:test";

import { Module } from "../../inspect/mcp/src/ast/module.ts";
import { Resolver } from "../../inspect/mcp/src/resolve.ts";
import { addedKeys } from "./code/transcript-added.ts";

const rootOf = async (text: string) => {
	const src = await Module.parse("m.js", text);
	const at = text.indexOf('{type:"assistant"');
	const obj = src.nodeAt(at);
	return { src, obj: obj ?? src.ast };
};

const keysOf = async (text: string): Promise<string[]> => {
	const root = await rootOf(text);
	const added = await addedKeys(new Resolver(), [root]);
	return [...added.keys()].toSorted();
};

test("a member assignment on a constructor result reaches the keys", async () => {
	// Arrange
	const text =
		'function mk(e){return{type:"assistant",uuid:e}}function wrap(e,t){let r=mk(e);if(r.cutFlag=!0,t!==void 0)r.refusedIds=t;return r}';

	// Act
	const keys = await keysOf(text);

	// Assert
	expect(keys).toEqual(["cutFlag", "refusedIds"]);
});

test("a spread literal of a constructor call adds its keys, and a function that returns it is a constructor", async () => {
	// Arrange
	const text =
		'function mk(e){return{type:"assistant",uuid:e}}function a(e){return{...mk(e),agentId:e}}function b(e){let r=a(e);r.later=1;return r}';

	// Act
	const keys = await keysOf(text);

	// Assert
	expect(keys).toEqual(["agentId", "later"]);
});

test("an assignment on an object the code does not tie to a constructor is ignored", async () => {
	// Arrange
	const text =
		'function mk(e){return{type:"assistant",uuid:e}}function other(){let o={};o.stray=1;let p=mk(1);return o}';

	// Act
	const keys = await keysOf(text);

	// Assert
	expect(keys).toEqual([]);
});

test("a constructor call returned through a sequence or a condition makes its function a constructor", async () => {
	// Arrange
	const text =
		'function mk(e){return{type:"assistant",uuid:e}}function a(e,t){return t?(log(),mk(e)):void 0}function b(e){let r=a(e,1);r.cut=!0;return r}';

	// Act
	const keys = await keysOf(text);

	// Assert
	expect(keys).toEqual(["cut"]);
});
