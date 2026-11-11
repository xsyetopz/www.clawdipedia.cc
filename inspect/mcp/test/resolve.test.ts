import { describe, expect, test } from "bun:test";

import type { Entry, Val } from "../src/resolve.ts";
import { mapSeq } from "../src/seq.ts";
import {
	coalesceKeys,
	computedKeys,
	lastConst,
	mergedVal,
	spreadKeys,
	str,
	unk,
	valsOf,
} from "./resolve-helpers.ts";

describe("mergeEntries", () => {
	test("different string literals at two sites give an enum", async () => {
		expect(
			await mergedVal([[str("subtype", "a")], [str("subtype", "b")]]),
		).toEqual({
			k: "enum",
			v: ["a", "b"],
		});
	});
	test("a literal at one site and a computed value at another is not a const", async () => {
		const vals = await mapSeq(
			[
				[[str("level", "info")], [unk("level", "n")]],
				[[unk("level", "n")], [str("level", "info")]],
			],
			mergedVal,
		);
		expect(vals.map((v) => v?.k)).toEqual(["unk", "unk"]);
	});
});

describe("mergeEntries with an unknown value", () => {
	test("an object keeps its keys, its leaves become unknown, and it may be no object", async () => {
		const lit: Entry = {
			key: "message",
			opt: false,
			val: { k: "obj", e: [str("stop_reason", "stop_sequence")] },
		};
		const vals = await mapSeq(
			[
				[[lit], [unk("message", "n")]],
				[[unk("message", "n")], [lit]],
			],
			mergedVal,
		);
		const want: Val = {
			k: "obj",
			e: [{ key: "stop_reason", opt: false, val: { k: "unk", text: "" } }],
			open: true,
		};
		expect(vals).toEqual([want, want]);
	});
	test("a number at one site and an unknown value at another is unknown", async () => {
		const num: Entry = { key: "n", opt: false, val: { k: "num", v: 0 } };
		const val = await mergedVal([[num], [unk("n", "x")]]);
		expect(val?.k).toBe("unk");
	});
});

describe("names", () => {
	test("a declaration in scope, also in a comma list", async () => {
		expect(
			await spreadKeys("function f(){let x={a:1};g({...x})}", "x"),
		).toEqual(["a"]);
		expect(await spreadKeys("let a=1,x={b:2};g({...x})", "x")).toEqual(["b"]);
	});
	test("a later write and a `name.key=` add keys; writes after the use do not", async () => {
		expect(
			await spreadKeys("let x={a:1};if(c)x={b:1};x.k=2;g({...x});x={z:1}", "x"),
		).toEqual(["a?", "b?", "k?"]);
	});
	test("a parameter shadows an outer declaration only inside its function", async () => {
		expect(
			await spreadKeys(
				"let x={o:1};function g(x){h({...x})}g({p:1});g({p:2,q:3})",
				"x",
			),
		).toEqual(["p", "q?"]);
		expect(
			await spreadKeys("let x={a:1};function g(x){}h({...x})", "x"),
		).toEqual(["a"]);
	});
	test("a parameter of a named arrow, from each call", async () => {
		expect(
			await spreadKeys('let D=(n,J)=>o({...J});D("a",{b:1})', "J"),
		).toEqual(["b"]);
	});
	test("a function used as a value hides its calls", async () => {
		expect(
			await spreadKeys("function g(x){h({...x})}g({p:1});k(g)", "x"),
		).toBeUndefined();
	});
	test("a destructured name, a catch parameter, or a loop variable is not followed", async () => {
		const found = await Promise.all(
			[
				"let x={};function f({x}){g({...x})}f({x:{a:1}})",
				"let x={};{let{x:y,x}=z;g({...x})}",
				"let x={};try{}catch(x){g({...x})}",
				"let x={};for(const x of y){g({...x})}",
			].map((src) => spreadKeys(src, "x")),
		);
		expect(found).toEqual([undefined, undefined, undefined, undefined]);
	});
	test("the parameter of a `.then` callback is what the call returns", async () => {
		expect(
			await spreadKeys(
				"function f(){return{a:1}}f().then((v)=>g({...v}))",
				"v",
			),
		).toEqual(["a"]);
	});
	test("`o.key` of an object that cannot be followed is what the program assigns to `.key`", async () => {
		const src = "function g(s){h({...s.cutErr})}k(g)";
		expect(
			await spreadKeys(src, "s.cutErr", {
				"b.js": "let o={};if(o.cutErr==null)o.cutErr={a:1,...{b:2}};",
			}),
		).toEqual(["a", "b"]);
		expect(
			await spreadKeys(src, "s.cutErr", {
				"b.js": "let o={};o.cutErr={a:1};p.cutErr=q();",
			}),
		).toBeUndefined();
		expect(
			await spreadKeys(src, "s.cutErr", {
				"b.js": "o.cutErr={a:1};let p={cutErr:n};",
			}),
		).toBeUndefined();
		expect(
			await spreadKeys(src, "s.cutErr", {
				"b.js": "o.cutErr={a:1};let p={cutErr:{b:1}};",
			}),
		).toEqual(["a?", "b?"]);
	});
	test("a `.key` lookup that takes more steps than its cap stays unknown", async () => {
		// 2^15 - 1 expressions, more than the cap of 20,000 steps.
		let tree = "{a:1}";
		for (let k = 0; k < 14; k++) {
			tree = `(c?${tree}:${tree})`;
		}
		expect(
			await spreadKeys("function g(s){h({...s.cutErr})}k(g)", "s.cutErr", {
				"b.js": `o.cutErr=${tree};`,
			}),
		).toBeUndefined();
	});
});

describe("calls", () => {
	test("a nested function, not only a top-level one", async () => {
		expect(
			await spreadKeys(
				"function outer(){function Cui(e){return{...e,k:1}}return{...Cui({a:1})}}",
				"Cui",
			),
		).toEqual(["a", "k"]);
	});
	test("a returned parameter is the argument of this call, not of every call", async () => {
		const src =
			"function p(e){return e}let u=p({a:1}),w=p({b:1});g({...p({c:1})})";
		expect(await spreadKeys(src, "p")).toEqual(["c"]);
	});
	test("a parameter the call leaves out drops the key it sets", async () => {
		expect(
			await spreadKeys("function f(a,b){return{a,b}}g({...f(1)})", "f"),
		).toEqual(["a"]);
	});
	test("a function imported from another chunk", async () => {
		expect(
			await spreadKeys(
				'import{f as q}from"/$bunfs/root/b.js";g({...q()})',
				"q",
				{
					"b.js": "function f(){return{z:1}}export{f};",
				},
			),
		).toEqual(["z"]);
	});
	test("a function a setter stores, when the setter has one known call", async () => {
		const use = "function f(){let y=G();g({...y.c})}";
		expect(
			await spreadKeys(`var G;function S(e){G=e}${use}export{S};`, "y.c", {
				"b.js":
					'import{S as T}from"/$bunfs/root/a.js";function W(){return{c:{k:1}}}T(W);',
			}),
		).toEqual(["k"]);
		expect(
			await spreadKeys(
				`var G;function S(e){G=e}function W(){return{c:{k:1}}}S(W);${use}`,
				"y.c",
			),
		).toEqual(["k"]);
		expect(
			await spreadKeys(
				`var G;function S(e){G=e}function W(){return{c:{k:1}}}S(W);S(h);${use}`,
				"y.c",
			),
		).toBeUndefined();
	});
	test("`a ?? {...}` spreads give the keys of both sides, optional", async () => {
		expect(await coalesceKeys("let a={x:1};g({...a??{y:2}})")).toEqual([
			"x?",
			"y?",
		]);
	});
});

describe("computed keys", () => {
	test("a key from a constant in the same chunk or an imported one", async () => {
		expect(
			await computedKeys({
				"a.js":
					'import{K as k}from"/$bunfs/root/b.js";var J="git.branch";let o={[k]:1,[J]:2,[u]:3}',
				"b.js": 'var K="git.commit";export{K};',
			}),
		).toEqual(["git.commit", "git.branch"]);
	});
	test("a name written twice is no constant", async () => {
		expect(await lastConst('var J="a";J="b";J')).toBeUndefined();
	});
});

describe("values", () => {
	test("a ternary of string literals is an enum; any other branch is unknown", async () => {
		expect(
			await valsOf(
				'let o={a:x?"a":"b",b:x?"a":y?"b":"c",c:x?"a":"a",d:x?"a":n,e:x?1:2}',
			),
		).toEqual([
			["a", "enum", ["a", "b"]],
			["b", "enum", ["a", "b", "c"]],
			["c", "str", "a"],
			["d", "unk", false],
			["e", "unk", false],
		]);
	});
});
