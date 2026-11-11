import { Bundle } from "../../src/ast.ts";
import { surface } from "../../src/surface/index.ts";

export const bundle = (text: string) =>
	new Bundle([{ name: "/$bunfs/root/a.js", text }]);
export const items = (kind: string, text: string) =>
	surface(bundle(text), kind);
export const names = async (kind: string, text: string) => {
	const found = await items(kind, text);
	return found.map((i) => i.name);
};
export const byName = async (kind: string, text: string) => {
	const found = await items(kind, text);
	return new Map(found.map((i) => [i.name, i]));
};

/** Code-unit order, the order `Array#sort()` gives with no compare function. */
export const byCode = (a: string, b: string): number =>
	Number(a > b) - Number(a < b);
