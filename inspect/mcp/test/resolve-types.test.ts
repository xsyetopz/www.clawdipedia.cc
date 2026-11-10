import { describe, expect, test } from "bun:test";

import { mergedTypes, returnSources, str, types } from "./resolve-helpers.ts";

describe("types", () => {
	test("built-ins, operators, and template strings", async () => {
		expect(
			await types(
				// The template literal is split so that no "$" and "{" stand together in this file.
				"let o={a:String(x),b:`t$" +
					"{x}`,c:x.length,d:!x,e:x===1,f:x-1,g:Date.now(),h:x.toISOString(),i:Math.round(x),j:typeof x,k:x.map(f),l:x+1}",
			),
		).toEqual({
			a: ["string"],
			b: ["string"],
			c: ["number"],
			d: ["boolean"],
			e: ["boolean"],
			f: ["number"],
			g: ["number"],
			h: ["string"],
			i: ["number"],
			j: ["string"],
			k: ["array"],
			l: undefined,
		});
	});
	test("a name: every write, and undefined for none", async () => {
		expect(
			await types(
				'let a=1,b;b="x";if(y)b="z";let c;if(y)c=2;let d=0;d+=1;let e=0;e+=s;for(const f of y);let o={a,b,c,d,e,f:void 0,g:n}',
			),
		).toEqual({
			a: ["number"],
			b: ["string"],
			c: ["number"],
			d: ["number"],
			e: undefined,
			f: undefined,
			g: undefined,
		});
	});
	test("a call: the types of its returns, with its parameters bound", async () => {
		expect(
			await types(
				"function f(x){if(x)return String(x);return null}const g=(x)=>x;async function h(){return 1}let o={a:f(1),b:g(true),c:g(n),d:await h(),e:h(),f:k(1)}",
			),
		).toEqual({
			a: ["null", "string"],
			b: ["boolean"],
			c: undefined,
			d: ["number"],
			e: undefined,
			f: undefined,
		});
	});
	test("a method name that Object.prototype has is no known built-in", async () => {
		expect(
			await types("let o={a:x.toString(),b:x.constructor(),c:Date.valueOf()}"),
		).toEqual({ a: undefined, b: undefined, c: undefined });
	});
	test("a key a call returns as null is kept, as JSON keeps it", async () => {
		expect(
			await types(
				"function f(e){if(!e)return{u:null,v:void 0};return{u:1,v:2}}let o={a:f(x).u,b:f(x).v}",
			),
		).toEqual({ a: ["null", "number"], b: ["number"] });
	});
	test("a member of an object the code builds, and `??`, `?:`, `?.`", async () => {
		expect(
			await types(
				'let s={n:1,t:"a"};let o={a:s.n,b:s.t,c:s.z,d:x??0,e:s.n??"0",f:y?s.n:null,g:p?.length}',
			),
		).toEqual({
			a: ["number"],
			b: ["string"],
			c: undefined,
			d: undefined,
			e: ["number", "string"],
			f: ["null", "number"],
			g: ["number"],
		});
	});
	test("a name bound in another chunk, and a parameter from every call", async () => {
		expect(
			await types(
				'import{K}from"/$bunfs/root/b.js";function p(v){return{v}}p(1);p(2);let o={a:K,b:p(3).v}',
				{ "b.js": "var K=Date.now();export{K};" },
			),
		).toEqual({ a: ["number"], b: ["number"] });
	});
	test("a function imported from a Node built-in module, and the global `crypto`", async () => {
		expect(
			await types(
				'import{randomUUID as U,createHash as H}from"crypto";import{randomUUID as V}from"node:crypto";import{randomUUID as W}from"/$bunfs/root/b.js";let o={a:U(),b:V(),c:H(x),d:W(),e:crypto.randomUUID()}',
				{ "b.js": "function randomUUID(){return 1}export{randomUUID};" },
			),
		).toEqual({
			a: ["string"],
			b: ["string"],
			c: undefined,
			d: ["number"],
			e: ["string"],
		});
	});
	test("merging sites of different kinds keeps both types", () => {
		expect(
			mergedTypes([
				[str("level", "info")],
				[{ key: "level", opt: false, val: { k: "num", v: 1 } }],
			]),
		).toEqual(["number", "string"]);
	});
});

describe("returnsOf", () => {
	test("skips the returns of nested functions and keeps an arrow's body", async () => {
		const src =
			"function f(t){function g(){return 9}if(!t)return;return{a:1}};let h=()=>({b:2})";
		expect(
			await returnSources(src, "function f", "FunctionDeclaration"),
		).toEqual([null, "{a:1}"]);
		expect(await returnSources(src, "()=>", "ArrowFunctionExpression")).toEqual(
			["{b:2}"],
		);
	});
});
