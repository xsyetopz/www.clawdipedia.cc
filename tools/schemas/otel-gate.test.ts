import { expect, test } from "bun:test";

import { gateOf, isFalseFn } from "./code/otel-gate.ts";

test("gateOf reads the gate at the start of a function body", () => {
	// Arrange
	const gated = "{if(!XXe())return;return A().startSpan(n)}";
	const open = "{let e=y();if(!XXe())return;}";

	// Act
	const found = [gateOf(gated), gateOf(open)];

	// Assert
	expect(found).toEqual(["XXe", undefined]);
});

test("isFalseFn accepts only a function that returns false and nothing else", () => {
	// Arrange
	const text = "function XXe(){return!1}function lI(){return Re(x)}";

	// Act
	const found = [isFalseFn(text, "XXe"), isFalseFn(text, "lI")];

	// Assert
	expect(found).toEqual([true, false]);
});
