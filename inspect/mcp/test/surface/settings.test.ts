import { describe, expect, test } from "bun:test";

import { Bundle } from "../../src/ast.ts";
import { surface } from "../../src/surface/index.ts";
import { byName, items, names } from "./util.ts";

describe("setting", () => {
	test("keys of the schema object, details, and conditional spread", async () => {
		const src = `
function s(){return{
$schema:()=>z.string().describe("JSON Schema reference for Claude Code settings").optional(),
apiKeyHelper:()=>z.string().describe("Script that prints a key").optional(),
permissions:()=>z.object({}),
...i.CLAUDE_CODE_ENABLE_XAA&&{xaaIdp:()=>z.string().describe("XAA")}
}}
`;
		const by = await byName("setting", src);
		expect([...by.keys()].toSorted((a, b) => a.localeCompare(b))).toEqual([
			"$schema",
			"apiKeyHelper",
			"permissions",
			"xaaIdp",
		]);
		expect(by.get("apiKeyHelper")?.detail).toBe("Script that prints a key");
		expect(by.get("permissions")?.detail).toBeUndefined();
		expect(by.get("xaaIdp")?.gate).toBe("i.CLAUDE_CODE_ENABLE_XAA");
	});

	test("gated tables give buildGate as the gate", async () => {
		const src = `var t={tbl:{buildGate:()=>!0,shape:()=>({gatedKey:z.string()})}};`;
		const [it] = await items("setting", src);
		expect(it?.name).toBe("gatedKey");
		expect(it?.gate).toBe("buildGate ()=>!0");
	});

	test("an object with no anchor gives no settings", async () => {
		expect(
			await names("setting", "var o={apiKeyHelper:()=>z.string()};"),
		).toEqual([]);
	});
});

describe("setting-key", () => {
	const src = `
import{lib}from"/$bunfs/root/lib.js";
function obj(e){return new O({type:"object",shape:e})}
function rec(e,t){return new R({type:"record",keyType:e,valueType:t})}
function arr(e){return new A({type:"array",element:e})}
function str(){return new S({type:"string"})}
function memo(e){return lib.lazy(e)}
var OS=["macos","linux"],ALL=[...OS,"default"];
function entry(k){return k==="default"?str():obj({path:str()})}
var helpers=memo(()=>obj(Object.fromEntries(ALL.map((k)=>[k,entry(k).optional()]))));
function perms(e){return obj({allow:arr(obj({hidden:str()})).describe("Allowed rules")})}
function s(){let wrap=(b)=>b.catch(void 0);return{
$schema:()=>str().describe("JSON Schema reference for Claude Code settings").optional(),
permissions:()=>perms(1).optional(),
env:()=>rec(str(),str()),
known:()=>rec(str(),obj({source:obj({repo:str()})})),
helpers:()=>wrap(helpers().optional()),
...i.X&&{gated:()=>obj({on:str()})}
}}
`;
	const lib = "export{l as lib};var l={lazy:(e)=>e};";
	const b = () =>
		Bundle.parse([
			{ name: "/$bunfs/root/a.js", text: src },
			{ name: "/$bunfs/root/lib.js", text: lib },
		]);

	test("gives the leaf keys through helpers, records, memoized schemas, and keys built from a list", async () => {
		const found = await surface(await b(), "setting-key");
		expect(found.map((i) => i.name)).toEqual([
			"gated.on",
			"helpers.default",
			"helpers.linux.path",
			"helpers.macos.path",
			"known.*.source.repo",
			"permissions.allow",
		]);
	});

	test("keeps the describe text and the gate of the top-level key", async () => {
		const found = await surface(await b(), "setting-key");
		const by = new Map(found.map((i) => [i.name, i]));
		expect(by.get("permissions.allow")?.detail).toBe("Allowed rules");
		expect(by.get("gated.on")?.gate).toBe("i.X");
	});
});

describe("hook-event", () => {
	test("takes the longest PascalCase list with PreToolUse and PostToolUse", async () => {
		const src = `
var a=["PreToolUse","PostToolUse"];
var b=["PreToolUse","PostToolUse","SessionStart","Stop"];
var c=["PreToolUse","PostToolUse","not_pascal","Another","Yet","More","Names"];
var d=["SessionStart","Stop","Other","More","Names"];
`;
		expect(await names("hook-event", src)).toEqual([
			"PostToolUse",
			"PreToolUse",
			"SessionStart",
			"Stop",
		]);
	});

	test("no list gives no events", async () => {
		expect(await names("hook-event", 'var a=["PreToolUse","Stop"];')).toEqual(
			[],
		);
	});
});
