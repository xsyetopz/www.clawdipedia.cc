import { expect, test } from "bun:test";

import { explain, howOf } from "../src/explain.ts";
import { indexOf } from "./bundle-index.ts";

const APP = [
	'var loops={type:"local-jsx",name:"loops",isEnabled:()=>!1};',
	'var off={name:"stubbed",call(){if(gate("tengu_off"))throw new Error("not here");return null}};',
	'var on={name:"handled",isEnabled(){return gate("tengu_on")&&process.env.MY_FLAG!=="0"},call(a){let b=a+1;return run(b)}};',
	"function gate(k){return k.length>0}function run(x){return x}",
	"export const all=[loops,off,on];",
].join("\n");

test("how: no-op, stub, and handled", () => {
	expect(howOf("()=>!1")).toEqual({ how: "no-op", value: "false" });
	expect(howOf("(){}")).toEqual({ how: "no-op", value: "undefined" });
	expect(howOf("()=>{}")).toEqual({ how: "no-op", value: "undefined" });
	expect(howOf("()=>({})")).toEqual({ how: "no-op", value: "{}" });
	expect(howOf('(){throw new Error("x")}')).toEqual({ how: "stub" });
	expect(howOf('(){if($a1b2c3("tengu_x"))return!1;return null}')).toEqual({
		how: "stub",
		value: "null",
	});
	expect(howOf("(a1){let a2=a1+1;return $a1b2c3(a2)}")).toEqual({
		how: "handled",
	});
});

test("explains a command, a stubbed call, and a gated handled tool", async () => {
	const ix = await indexOf(APP);
	const loops = explain(ix, "/loops");
	expect(loops?.holder.t).toContain('name:"loops"');
	expect(loops?.how).toEqual([
		expect.objectContaining({
			label: "isEnabled",
			how: "no-op",
			value: "false",
		}),
	]);
	expect(loops?.who).toEqual([
		expect.stringMatching(/^ExportNamedDeclaration a\.js:\d+$/u),
	]);
	expect(explain(ix, "stubbed")?.how).toEqual([
		expect.objectContaining({ label: "call", how: "stub", value: "null" }),
	]);
	const on = explain(ix, "handled");
	expect(on?.when?.isEnabled).toContain('"tengu_on"');
	expect({ ...on?.when, isEnabled: undefined }).toEqual({
		gates: ['"tengu_on"'],
		env: ["MY_FLAG"],
		isEnabled: undefined,
	});
	expect(on?.how.map((h) => [h.label, h.how])).toEqual([
		["isEnabled", "handled"],
		["call", "handled"],
	]);
});

test("an unknown name explains nothing", async () => {
	expect(explain(await indexOf(APP), "no-such-name")).toBeUndefined();
});

// The shapes the program uses: a pass-through list of env names, an export map whose keys are the names,
// the function that reads one, and CLI flags whose literal carries `--` and an argument placeholder.
const ENV = [
	'var pass=new Set(["A_ONE","MY_SETTING","B_TWO","C_THREE","LISTED_ONLY"]);',
	"var exp={MY_SETTING:()=>x,KEY_ONLY:()=>y,OTHER:()=>z};",
	"function reads(i){return!i.MY_SETTING&&!i.READ_ONLY}",
	'var cli=[new Opt("--began-as-copy <value>","Sent by the server."),new Opt("--gateway-json","For a program.")];',
	"var re=/ZETA_NAME/;",
	"var x=1,y=2,z=3;function Opt(a,b){return[a,b]}",
].join("\n");

test("an env name: the unit that reads it is the holder, the lists are 'also in'", async () => {
	const ix = await indexOf(ENV);
	const e = explain(ix, "MY_SETTING");
	expect(e?.holder.t).toContain(".MY_SETTING");
	expect(e?.holder.t).not.toContain('"A_ONE"');
	expect(e?.others).toHaveLength(2);
	expect(e?.via).toBe("unit");
	expect(explain(ix, "READ_ONLY")?.holder.t).toContain(".READ_ONLY");
	expect(explain(ix, "KEY_ONLY")?.holder.t).toContain("KEY_ONLY:");
});

test("a flag is found with or without its leading dashes and placeholder", async () => {
	const ix = await indexOf(ENV);
	for (const n of [
		"began-as-copy",
		"--began-as-copy",
		"gateway-json",
		"--gateway-json",
	]) {
		expect(explain(ix, n)?.holder.t).toContain(`"--${n.replace(/^--/u, "")}`);
	}
	expect(explain(ix, "began-as")).toBeUndefined();
});

test("a name only in code text is found by text search and says so", async () => {
	const e = explain(await indexOf(ENV), "ZETA_NAME");
	expect(e?.via).toBe("text");
	expect(e?.holder.t).toContain("ZETA_NAME");
});
