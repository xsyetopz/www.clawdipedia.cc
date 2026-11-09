import { describe, expect, test } from "bun:test";

import type { Entry } from "../src/resolve.ts";
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
	test("different string literals at two sites give an enum", () => {
		expect(mergedVal([[str("subtype", "a")], [str("subtype", "b")]])).toEqual({
			k: "enum",
			v: ["a", "b"],
		});
	});
	test("a literal at one site and a computed value at another is not a const", () => {
		for (const lists of [
			[[str("level", "info")], [unk("level", "n")]],
			[[unk("level", "n")], [str("level", "info")]],
		]) {
			expect(mergedVal(lists)?.k).toBe("unk");
		}
	});
});

describe("mergeEntries with an unknown value", () => {
	test("an object keeps its keys, its leaves become unknown, and it may be no object", () => {
		const lit: Entry = {
			key: "message",
			opt: false,
			val: { k: "obj", e: [str("stop_reason", "stop_sequence")] },
		};
		for (const lists of [
			[[lit], [unk("message", "n")]],
			[[unk("message", "n")], [lit]],
		]) {
			expect(mergedVal(lists)).toEqual({
				k: "obj",
				e: [{ key: "stop_reason", opt: false, val: { k: "unk", text: "" } }],
				open: true,
			});
		}
	});
	test("a number at one site and an unknown value at another is unknown", () => {
		const num: Entry = { key: "n", opt: false, val: { k: "num", v: 0 } };
		expect(mergedVal([[num], [unk("n", "x")]])?.k).toBe("unk");
	});
});

describe("names", () => {
	test("a declaration in scope, also in a comma list", () => {
		expect(spreadKeys("function f(){let x={a:1};g({...x})}", "x")).toEqual([
			"a",
		]);
		expect(spreadKeys("let a=1,x={b:2};g({...x})", "x")).toEqual(["b"]);
	});
	test("a later write and a `name.key=` add keys; writes after the use do not", () => {
		expect(
			spreadKeys("let x={a:1};if(c)x={b:1};x.k=2;g({...x});x={z:1}", "x"),
		).toEqual(["a?", "b?", "k?"]);
	});
	test("a parameter shadows an outer declaration only inside its function", () => {
		expect(
			spreadKeys(
				"let x={o:1};function g(x){h({...x})}g({p:1});g({p:2,q:3})",
				"x",
			),
		).toEqual(["p", "q?"]);
		expect(spreadKeys("let x={a:1};function g(x){}h({...x})", "x")).toEqual([
			"a",
		]);
	});
	test("a parameter of a named arrow, from each call", () => {
		expect(spreadKeys('let D=(n,J)=>o({...J});D("a",{b:1})', "J")).toEqual([
			"b",
		]);
	});
	test("a function used as a value hides its calls", () => {
		expect(
			spreadKeys("function g(x){h({...x})}g({p:1});k(g)", "x"),
		).toBeUndefined();
	});
	test("a destructured name, a catch parameter, or a loop variable is not followed", () => {
		for (const src of [
			"let x={};function f({x}){g({...x})}f({x:{a:1}})",
			"let x={};{let{x:y,x}=z;g({...x})}",
			"let x={};try{}catch(x){g({...x})}",
			"let x={};for(const x of y){g({...x})}",
		]) {
			expect(spreadKeys(src, "x")).toBeUndefined();
		}
	});
	test("the parameter of a `.then` callback is what the call returns", () => {
		expect(
			spreadKeys("function f(){return{a:1}}f().then((v)=>g({...v}))", "v"),
		).toEqual(["a"]);
	});
	test("`o.key` of an object that cannot be followed is what the program assigns to `.key`", () => {
		const src = "function g(s){h({...s.cutErr})}k(g)";
		expect(
			spreadKeys(src, "s.cutErr", {
				"b.js": "let o={};if(o.cutErr==null)o.cutErr={a:1,...{b:2}};",
			}),
		).toEqual(["a", "b"]);
		expect(
			spreadKeys(src, "s.cutErr", {
				"b.js": "let o={};o.cutErr={a:1};p.cutErr=q();",
			}),
		).toBeUndefined();
	});
});

describe("calls", () => {
	test("a nested function, not only a top-level one", () => {
		expect(
			spreadKeys(
				"function outer(){function Cui(e){return{...e,k:1}}return{...Cui({a:1})}}",
				"Cui",
			),
		).toEqual(["a", "k"]);
	});
	test("a returned parameter is the argument of this call, not of every call", () => {
		const src =
			"function p(e){return e}let u=p({a:1}),w=p({b:1});g({...p({c:1})})";
		expect(spreadKeys(src, "p")).toEqual(["c"]);
	});
	test("a parameter the call leaves out drops the key it sets", () => {
		expect(spreadKeys("function f(a,b){return{a,b}}g({...f(1)})", "f")).toEqual(
			["a"],
		);
	});
	test("a function imported from another chunk", () => {
		expect(
			spreadKeys('import{f as q}from"/$bunfs/root/b.js";g({...q()})', "q", {
				"b.js": "function f(){return{z:1}}export{f};",
			}),
		).toEqual(["z"]);
	});
	test("a function a setter stores, when the setter has one known call", () => {
		const use = "function f(){let y=G();g({...y.c})}";
		expect(
			spreadKeys(`var G;function S(e){G=e}${use}export{S};`, "y.c", {
				"b.js":
					'import{S as T}from"/$bunfs/root/a.js";function W(){return{c:{k:1}}}T(W);',
			}),
		).toEqual(["k"]);
		expect(
			spreadKeys(
				`var G;function S(e){G=e}function W(){return{c:{k:1}}}S(W);${use}`,
				"y.c",
			),
		).toEqual(["k"]);
		expect(
			spreadKeys(
				`var G;function S(e){G=e}function W(){return{c:{k:1}}}S(W);S(h);${use}`,
				"y.c",
			),
		).toBeUndefined();
	});
	test("`a ?? {...}` spreads give the keys of both sides, optional", () => {
		expect(coalesceKeys("let a={x:1};g({...a??{y:2}})")).toEqual(["x?", "y?"]);
	});
});

describe("computed keys", () => {
	test("a key from a constant in the same chunk or an imported one", () => {
		expect(
			computedKeys({
				"a.js":
					'import{K as k}from"/$bunfs/root/b.js";var J="git.branch";let o={[k]:1,[J]:2,[u]:3}',
				"b.js": 'var K="git.commit";export{K};',
			}),
		).toEqual(["git.commit", "git.branch"]);
	});
	test("a name written twice is no constant", () => {
		expect(lastConst('var J="a";J="b";J')).toBeUndefined();
	});
});

describe("values", () => {
	test("a ternary of string literals is an enum; any other branch is unknown", () => {
		expect(
			valsOf(
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
