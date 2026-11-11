// Reads the modules of a bundled program with a real parser (oxc-parser) and scope analysis (eslint-scope).
// A `Bundle` parses its modules at once, on the parser's threads. Bun chunks import each other as `/$bunfs/root/<chunk>`; a `Bundle`
// follows those imports, so a name resolves to its declaration in any chunk.
export { Bundle } from "./ast/bundle.ts";
export {
	type Call,
	type CallNode,
	callsOf,
	constString,
	functionOf,
	nameOf,
	returnsOf,
} from "./ast/calls.ts";
export { Module } from "./ast/module.ts";
export {
	children,
	type Fn,
	isFn,
	isLit,
	litValue,
	type Node,
	type NodeOf,
	strLit,
} from "./ast/node.ts";
export type { Def, Ref, Variable } from "./ast/variables.ts";
export { mapSeq } from "./seq.ts";
