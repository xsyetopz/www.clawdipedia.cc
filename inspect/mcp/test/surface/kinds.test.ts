import { describe, expect, test } from "bun:test";

import { Bundle } from "../../src/ast.ts";
import { surface } from "../../src/surface/index.ts";
import { bundle, byName, items, names } from "./util.ts";

describe("gate", () => {
	test("readers give names and literal defaults", async () => {
		const src = `
F.read("tengu_a_bool",!1);
F.read("tengu_b_num",5);
F.read("tengu_c_str","x");
F.read("tengu_d_none");
F.read("tengu_e_computed",f());
F.read("tengu_f_cfg",{a:1});
F.read("tengu_y",!1);
`;
		const by = await byName("gate", src);
		expect(by.get("tengu_a_bool")?.default).toBe("false");
		expect(by.get("tengu_y")?.default).toBe("false");
		expect(by.get("tengu_b_num")?.default).toBe("5");
		expect(by.get("tengu_c_str")?.default).toBe('"x"');
		// Spec inspect-surface-lookup: a computed value is shown as `unknown`.
		expect(by.get("tengu_e_computed")?.default).toBe("unknown");
		for (const n of ["tengu_d_none", "tengu_f_cfg"]) {
			expect(by.has(n)).toBe(true);
			expect(by.get(n)?.default).toBeUndefined();
		}
	});

	test("event-logger calls are not gates", async () => {
		const src = `
a("tengu_x",{feature_name:1});
a("tengu_x2",{feature_name:2,b:3});
a("tengu_x3",{k:1});
F.read("tengu_real",!0);
`;
		expect(await names("gate", src)).toEqual(["tengu_real"]);
	});

	test("a wrapper that passes its parameter to a logger is a logger", async () => {
		const src = `
function a(e,t){}
a("tengu_log1",{feature_name:1});
a("tengu_log2",{feature_name:2});
function fo(e){a(e,{feature_name:3})}
fo("tengu_wrapped");
fo("tengu_wrapped2");
Jr("tengu_safe",{safe:!0});
`;
		const n = await names("gate", src);
		expect(n).not.toContain("tengu_wrapped");
		expect(n).not.toContain("tengu_wrapped2");
		expect(n).not.toContain("tengu_log1");
		expect(n).toContain("tengu_safe");
	});

	test("a bare prefix and a trailing underscore are dropped", async () => {
		const src = `
F.read("tengu_",!1);
F.read("tengu_bad_",!1);
F.read("tengu_Upper",!1);
F.read("tengu_ok1",!1);
`;
		expect(await names("gate", src)).toEqual(["tengu_ok1"]);
	});
});

describe("tool", () => {
	test("the tools getAllBaseTools returns, with their gates", async () => {
		const t = await items(
			"tool",
			'const B=(d)=>({isEnabled:()=>!0,...d});const S=B({name:"Shell"}),G=B({name:"Glob",isEnabled(){return process.env.G==="1"}}),C=B({name:"CronCreate"});function L(){return process.env.L==="1"}function A(){return[S,G,...L()?[C]:[]]}globalThis.api={getAllBaseTools:A};',
		);
		expect(t.map((i) => i.name)).toEqual(["CronCreate", "Glob", "Shell"]);
		expect(t.find((i) => i.name === "CronCreate")?.gate).toContain("L()");
		expect(t.find((i) => i.name === "Glob")?.detail).toContain("process.env.G");
		expect(t.map((i) => [i.module, i.offset])).toEqual(
			t.map(() => ["a.js", null]),
		);
	});

	test("a tool read from a chunk held in a local gets its name, not the local's", async () => {
		const a =
			'function N(){let c=import.meta.require("/$bunfs/root/b.js");return c.reg(),c.EvalTool}function A(){let r=N();return[...(r?[r]:[])]}globalThis.api={getAllBaseTools:A};';
		const b =
			'const B=(d)=>({isEnabled:()=>!0,...d});const K="REPL";const E=B({name:K,aliases:["Eval"]});export{E as EvalTool};';
		const t = await surface(
			new Bundle([
				{ name: "/$bunfs/root/a.js", text: a },
				{ name: "/$bunfs/root/b.js", text: b },
			]),
			"tool",
		);
		expect(t.map((i) => i.name)).toEqual(["REPL"]);
	});
});

describe("otel-event", () => {
	test("the emitter's event names with their call site counts", async () => {
		const e = await items(
			"otel-event",
			'const b=()=>({"session.id":"s"});async function e(n,a){globalThis.o={...b(),"event.name":n,"event.sequence":1,...a}}e("tool_result",{tool_name:"Bash"});e("tool_result",{x:1});e("api_error",{status:500});',
		);
		expect(e.map((i) => [i.name, i.detail])).toEqual([
			["api_error", "1 call sites"],
			["tool_result", "2 call sites"],
		]);
	});
});

describe("mod-api", () => {
	const DTS = `declare module 'claude-code' {
  export interface CoreEngineInterface {
      /**
       * Doc with a key: like this.
       */
      plugin: {
          name: string;
      };
      ui: {
          /** Logs. */
          log(text: string): void;
          ring?: (n: number) => void;
      };
      version: string;
  }
  export type EngineEventOf = {
      'tool.check': ToolCheckInput;
  };
  export type OpEventOf = {
      'model.complete': X;
  };
  type HookInput = { hook_event_name: 'PreToolUse' } | { hook_event_name: 'Stop' };
}
`;
	const embedded = async () => [
		{
			name: "/$bunfs/root/claude-code.d.ts-abc.zst",
			bytes: Buffer.from(await Bun.zstdCompress(DTS)),
		},
	];
	test("$ calls through nested types, event map keys, and classic events", async () => {
		const m = await surface(bundle("var a=1"), "mod-api", await embedded());
		expect(m.map((i) => [i.name, i.detail])).toEqual([
			["$.plugin.name", "property"],
			["$.ui.log", "call"],
			["$.ui.ring", "call"],
			["$.version", "property"],
			["classic.PreToolUse", "event"],
			["classic.Stop", "event"],
			["model.complete", "event"],
			["tool.check", "event"],
		]);
		const log = m.find((i) => i.name === "$.ui.log");
		expect(log).toBeDefined();
		expect(DTS.slice(Number(log?.offset)).trimStart()).toStartWith("log(");
	});
	test("throws without the embedded files", async () => {
		const error = await surface(bundle("var a=1"), "mod-api").catch(
			(error_: unknown) => error_,
		);
		expect(error).toHaveProperty("message", expect.stringMatching(/embedded/u));
	});
});

describe("keybinding", () => {
	test("actions and contexts from their two arrays", async () => {
		const src = `
var c=["Global","Chat","Help"];
var a=["app:exit","chat:cancel","chat:submit"];
var short=["Global","Chat"];
var other=["chat:cancel"];
`;
		const by = await byName("keybinding", src);
		expect(by.get("chat:cancel")?.detail).toBe("action");
		expect(by.get("app:exit")?.detail).toBe("action");
		expect(by.get("Global")?.detail).toBe("context");
		expect(by.get("Help")?.detail).toBe("context");
	});

	test("an array that is not all strings gives nothing", async () => {
		expect(await names("keybinding", 'var a=["Global","Chat",f()];')).toEqual(
			[],
		);
	});
});
