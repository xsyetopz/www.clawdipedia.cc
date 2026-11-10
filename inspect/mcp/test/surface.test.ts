import { describe, expect, test } from "bun:test";

import { Bundle, children, type Node } from "../src/ast.ts";
import { isNode } from "../src/ast/node.ts";
import { literal, short, unique } from "../src/surface/common.ts";
import { envPlaces } from "../src/surface/env.ts";
import { KINDS, surface } from "../src/surface/index.ts";
import { bundle, byName, items, names } from "./surface/util.ts";

const firstArray = (n: Node): Node | undefined => {
	if (n.type === "ArrayExpression") {
		return n;
	}
	for (const c of children(n)) {
		const found = firstArray(c);
		if (found !== undefined) {
			return found;
		}
	}
	return undefined;
};

const arrayLiterals = async (src: string): Promise<string[]> => {
	const parsed = await bundle(src);
	const m = parsed.get("a.js");
	if (m === undefined) {
		throw new Error("module a.js missing");
	}
	const array = firstArray(m.ast);
	if (array?.type !== "ArrayExpression") {
		throw new Error("no array in source");
	}
	return array.elements
		.flatMap((e) => (isNode(e) ? [e] : []))
		.map((e) => literal(m, e));
};

describe("registry", () => {
	test("lists the kinds", () => {
		expect(Object.keys(KINDS).toSorted((a, b) => a.localeCompare(b))).toEqual([
			"beta",
			"endpoint",
			"env",
			"error",
			"file",
			"flag",
			"gate",
			"hook-event",
			"keybinding",
			"mod-api",
			"model",
			"otel-event",
			"permission-rule",
			"setting",
			"setting-key",
			"slash-command",
			"subcommand",
			"tool",
		]);
	});

	test("throws on an unknown kind", async () => {
		const error = await surface(await bundle("var a=1"), "nope").catch(
			(error_: unknown) => error_,
		);
		expect(error).toHaveProperty(
			"message",
			expect.stringMatching(/unknown kind/u),
		);
	});

	test("computes a kind once per bundle", async () => {
		const b = await bundle('var a=["PreToolUse","PostToolUse"]');
		expect(await surface(b, "hook-event")).toBe(await surface(b, "hook-event"));
	});
});

describe("common helpers", () => {
	test("unique keeps the first item and fills missing fields", () => {
		const base = { kind: "k", module: null, offset: null };
		const out = unique([
			{ ...base, name: "b" },
			{ ...base, name: "a" },
			{ ...base, name: "b", detail: "d" },
		]);
		expect(out.map((i) => i.name)).toEqual(["a", "b"]);
		expect(out[1]?.detail).toBe("d");
	});

	test("a repeated name keeps its first module and its last offset in it", async () => {
		const a = "var x=process.env.AAA_ONE;var y=process.env.AAA_ONE;";
		const b = await Bundle.parse([
			{ name: "/$bunfs/root/a.js", text: a },
			{ name: "/$bunfs/root/b.js", text: a },
		]);
		const found = await surface(b, "env");
		const hit = found.find((i) => i.name === "AAA_ONE");
		expect([hit?.module, hit?.offset]).toEqual([
			"a.js",
			a.lastIndexOf("process"),
		]);
	});

	test("short blanks placeholders and cuts long text", () => {
		expect(short(["a $", "{x}  b"].join(""))).toBe(["a $", "{…} b"].join(""));
		expect(short("x".repeat(10), 4)).toBe("xxxx…");
	});

	test("literal reads short literals", async () => {
		const out = await arrayLiterals("var a=[!0,!1,-1,void 0,'s',f(),[1,2]]");
		expect(out).toEqual([
			"true",
			"false",
			"-1",
			"undefined",
			'"s"',
			"unknown",
			"[1,2]",
		]);
	});
});

describe("env", () => {
	test("reads of process.env and of the typed registry", async () => {
		const src = `
var H={bool:()=>1,enum:()=>1,int:()=>1};
var v1=H.bool(),v2=H.enum(["a","b"]),v3=H.int({min:0});
var ns=reg("x",{REG_BOOL:()=>v1,REG_ENUM:()=>v2,REG_INT:()=>v3});
var x=process.env.READ_DOT,y=process.env["READ_BRACKET"];
var z="READ_IN" in process.env;
var {READ_DESTRUCT:q}=process.env;
function g(){return process.env}
var w=g().VIA_FN_UPPER;
`;
		const out = await items("env", src);
		const by = new Map(out.map((i) => [i.name, i]));
		for (const n of [
			"REG_BOOL",
			"REG_ENUM",
			"REG_INT",
			"READ_DOT",
			"READ_BRACKET",
			"READ_IN",
			"READ_DESTRUCT",
			"VIA_FN_UPPER",
		]) {
			expect(by.has(n)).toBe(true);
		}
		expect(by.get("REG_BOOL")?.detail).toBe("bool");
		expect(by.get("REG_ENUM")?.values).toEqual(["a", "b"]);
		expect(by.get("REG_INT")?.detail).toBe("int{min:0}");
	});

	test("names set for a child process", async () => {
		const src = `
spawn("x",[],{env:{...process.env,CHILD_SET:1}});
var a=["--setenv","SANDBOX_VAR","1"];
`;
		const by = await byName("env", src);
		expect(by.get("CHILD_SET")?.detail).toBe("set for a child process");
		expect(by.get("SANDBOX_VAR")?.detail).toBe("set for a child process");
	});

	test("a helper that passes its parameter on to another helper", async () => {
		const src = `
function Su(e){return process.env[e]}
function wt(e){let n=Su(e);return Number(n)}
var a=wt("VIA_TWO_HELPERS"),b=Su("VIA_ONE_HELPER");
`;
		const n = await names("env", src);
		expect(n).toContain("VIA_TWO_HELPERS");
		expect(n).toContain("VIA_ONE_HELPER");
	});

	// Claude Code 2.1.319 `plugin eval`: `ll.flatMap(Ct)` and `["KRB5CCNAME",...].flatMap((j)=>Ul(ce(j)))`.
	test("a helper called on each name of a constant list", async () => {
		const src = `
function Pt(j){return process.env[j]}
var ce=(j)=>Pt(j);
var ll=["VIA_LIST_A","VIA_LIST_B"];
var x=ll.flatMap(ce);
var y=["VIA_INLINE"].flatMap((j)=>[ce(j)]);
var z=["NOT_READ"].map((j)=>j);
var Ct=(j)=>Object.entries(process.env).filter(([k])=>k.toUpperCase()===j);
var w=["VIA_ANY_CASE"].flatMap(Ct);
`;
		const n = await names("env", src);
		for (const x of [
			"VIA_LIST_A",
			"VIA_LIST_B",
			"VIA_INLINE",
			"VIA_ANY_CASE",
		]) {
			expect(n).toContain(x);
		}
		expect(n).not.toContain("NOT_READ");
	});

	// Claude Code 2.1.322 bridge inbox: `D.some((n)=>process.env[n]!==e[n])` over a list of registry names.
	test("every place of a name: its registry entry and its read through a list", async () => {
		const src = `
var H={str:()=>1};
var v=H.str();
var ns=reg("x",{VIA_COMPARE_A:()=>v,REG_OTHER_A:()=>v,REG_OTHER_B:()=>v});
var D=["VIA_COMPARE_A","VIA_COMPARE_B"];
function L(e){return D.some((n)=>process.env[n]!==e[n])}
var K=["ONLY_LISTED_A","VIA_COMPARE_A","VIA_COMPARE_B"];
`;
		const places = envPlaces(await bundle(src));
		const of = (name: string) =>
			places.filter((p) => p.name === name).map((p) => p.detail);
		expect(of("VIA_COMPARE_A")).toEqual(["str", undefined]);
		expect(of("VIA_COMPARE_B")).toEqual([undefined]);
		expect(of("ONLY_LISTED_A")).toEqual(["listed"]);
	});

	test("a lowercase read of another object is not an env name", async () => {
		const n = await names("env", "var o={a:1};var x=o.FOO_BAR,y=o.low;");
		expect(n).not.toContain("FOO_BAR");
		expect(n).not.toContain("low");
	});

	test("a child env key whose value reads a build-constant object is an env name, the constant's own keys are not", async () => {
		const src = `
var i=process.env;
function b(){let e={USER_TYPE:"external",NODE_ENV:"production",VITALS_CLI_VERSION:{PACKAGE_URL:"p",VERSION:"1",GIT_SHA:"s"}.VERSION};return e}
var u=i.USER_TYPE,n=i.NODE_ENV;
`;
		const n = await names("env", src);
		expect(n).toContain("VITALS_CLI_VERSION");
		for (const k of ["PACKAGE_URL", "VERSION", "GIT_SHA"]) {
			expect(n).not.toContain(k);
		}
	});
});
