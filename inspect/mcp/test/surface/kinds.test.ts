import { describe, expect, test } from "bun:test";
import { Bundle } from "../../src/ast.ts";
import { surface } from "../../src/surface/index.ts";
import { bundle, items, names } from "./util.ts";

describe("gate", () => {
  test("readers give names and literal defaults", () => {
    const src = `
F.read("tengu_a_bool",!1);
F.read("tengu_b_num",5);
F.read("tengu_c_str","x");
F.read("tengu_d_none");
F.read("tengu_e_computed",f());
F.read("tengu_f_cfg",{a:1});
F.read("tengu_y",!1);
`;
    const by = new Map(items("gate", src).map((i) => [i.name, i]));
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

  test("event-logger calls are not gates", () => {
    const src = `
a("tengu_x",{feature_name:1});
a("tengu_x2",{feature_name:2,b:3});
a("tengu_x3",{k:1});
F.read("tengu_real",!0);
`;
    expect(names("gate", src)).toEqual(["tengu_real"]);
  });

  test("a wrapper that passes its parameter to a logger is a logger", () => {
    const src = `
function a(e,t){}
a("tengu_log1",{feature_name:1});
a("tengu_log2",{feature_name:2});
function fo(e){a(e,{feature_name:3})}
fo("tengu_wrapped");
fo("tengu_wrapped2");
Jr("tengu_safe",{safe:!0});
`;
    const n = names("gate", src);
    expect(n).not.toContain("tengu_wrapped");
    expect(n).not.toContain("tengu_wrapped2");
    expect(n).not.toContain("tengu_log1");
    expect(n).toContain("tengu_safe");
  });

  test("a bare prefix and a trailing underscore are dropped", () => {
    const src = `
F.read("tengu_",!1);
F.read("tengu_bad_",!1);
F.read("tengu_Upper",!1);
F.read("tengu_ok1",!1);
`;
    expect(names("gate", src)).toEqual(["tengu_ok1"]);
  });
});

describe("tool", () => {
  test("the tools getAllBaseTools returns, with their gates", () => {
    const t = items(
      "tool",
      'const B=(d)=>({isEnabled:()=>!0,...d});const S=B({name:"Shell"}),G=B({name:"Glob",isEnabled(){return process.env.G==="1"}}),C=B({name:"CronCreate"});function L(){return process.env.L==="1"}function A(){return[S,G,...L()?[C]:[]]}globalThis.api={getAllBaseTools:A};',
    );
    expect(t.map((i) => i.name)).toEqual(["CronCreate", "Glob", "Shell"]);
    expect(t.find((i) => i.name === "CronCreate")?.gate).toContain("L()");
    expect(t.find((i) => i.name === "Glob")?.detail).toContain("process.env.G");
    expect(t.every((i) => i.module === "a.js" && i.offset === null)).toBe(true);
  });

  test("a tool read from a chunk held in a local gets its name, not the local's", () => {
    const a =
      'function N(){let c=import.meta.require("/$bunfs/root/b.js");return c.reg(),c.EvalTool}function A(){let r=N();return[...(r?[r]:[])]}globalThis.api={getAllBaseTools:A};';
    const b =
      'const B=(d)=>({isEnabled:()=>!0,...d});const K="REPL";const E=B({name:K,aliases:["Eval"]});export{E as EvalTool};';
    const t = surface(
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
  test("the emitter's event names with their call site counts", () => {
    const e = items(
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
  const files = [
    {
      name: "/$bunfs/root/claude-code.d.ts-abc.zst",
      bytes: Buffer.from(Bun.zstdCompressSync(DTS)),
    },
  ];
  test("$ calls through nested types, event map keys, and classic events", () => {
    const m = surface(bundle("var a=1"), "mod-api", files);
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
    expect(DTS.slice(log?.offset ?? 0).trimStart()).toStartWith("log(");
  });
  test("throws without the embedded files", () => {
    expect(() => surface(bundle("var a=1"), "mod-api")).toThrow(/embedded/);
  });
});

describe("keybinding", () => {
  test("actions and contexts from their two arrays", () => {
    const src = `
var c=["Global","Chat","Help"];
var a=["app:exit","chat:cancel","chat:submit"];
var short=["Global","Chat"];
var other=["chat:cancel"];
`;
    const by = new Map(items("keybinding", src).map((i) => [i.name, i]));
    expect(by.get("chat:cancel")?.detail).toBe("action");
    expect(by.get("app:exit")?.detail).toBe("action");
    expect(by.get("Global")?.detail).toBe("context");
    expect(by.get("Help")?.detail).toBe("context");
  });

  test("an array that is not all strings gives nothing", () => {
    expect(names("keybinding", 'var a=["Global","Chat",f()];')).toEqual([]);
  });
});

describe("model", () => {
  test("ids and aliases", () => {
    const src = `
var t=[["claude-sonnet-4-5","R1"],["claude-3-5-haiku-20241022","R2"],["claude-opus-4-1@20250805","R3"]];
var al=["sonnet","opus","opusplan"];
`;
    const by = new Map(items("model", src).map((i) => [i.name, i]));
    expect(by.get("claude-sonnet-4-5")?.detail).toBe("id");
    expect(by.get("claude-3-5-haiku-20241022")?.detail).toBe("id");
    expect(by.get("claude-opus-4-1@20250805")?.detail).toBe("id");
    expect(by.get("opusplan")?.detail).toBe("alias");
  });

  test("text that holds an id, a prefix, and other claude names are not ids", () => {
    const src = `
var a="use claude-opus-4-6 here",b="claude-3-",c="claude-code",d="claude-ai-oauth";
var e=["sonnet","opus"];
`;
    expect(names("model", src)).toEqual([]);
  });
});

describe("beta", () => {
  test("dated names, with the registry key as the detail", () => {
    const src = `
v("long_context","context-1m-2025-08-07");
v("claude_code","claude-code-20250219");
var o="oauth-2025-04-20";
`;
    const by = new Map(items("beta", src).map((i) => [i.name, i]));
    expect(by.get("context-1m-2025-08-07")?.detail).toBe("long_context");
    expect(by.get("claude-code-20250219")?.detail).toBe("claude_code");
    expect(by.get("oauth-2025-04-20")?.detail).toBeUndefined();
  });

  test("API versions, dated model ids, and plain dates are not betas", () => {
    const src = `
var a="bedrock-2023-05-31",b="vertex-2023-10-16",c="2023-06-01";
var d="claude-opus-4-5-20251101";
f("model","claude-opus-4-5-20251101");
`;
    expect(names("beta", src)).toEqual([]);
  });
});

describe("endpoint", () => {
  test("Anthropic URLs and BASE_API_URL paths", () => {
    const src = `
var u={BASE_API_URL:"https://api.anthropic.com",X:"https://platform.claude.com/v1/oauth/token"};
f(\`\${an().BASE_API_URL}/api/oauth/profile\`);
f(\`\${an().BASE_API_URL}/v1/code/sessions/\${e}/events\`);
`;
    const by = new Map(items("endpoint", src).map((i) => [i.name, i]));
    expect(by.get("https://api.anthropic.com")?.detail).toBe("url");
    expect(by.get("https://platform.claude.com/v1/oauth/token")?.detail).toBe(
      "url",
    );
    expect(by.get("/api/oauth/profile")?.detail).toBe("path");
    expect(by.has(`/v1/code/sessions/\${…}/events`)).toBe(true);
    expect(by.get("/v1/oauth/token")?.detail).toBe("path");
  });

  test("path literals and templates with an API prefix", () => {
    const src = `
var d="/v1/messages/count_tokens";
f(\`\${base}/v1/traces\`);
f(\`/model/\${m}/invoke\`);
`;
    expect(names("endpoint", src)).toEqual([
      `/model/\${…}/invoke`,
      "/v1/messages/count_tokens",
      "/v1/traces",
    ]);
  });

  test("third-party URLs, other paths, and variable paths are dropped", () => {
    const src = `
var a="https://login.microsoftonline.com/common",b="https://example.com";
var c="http://api.anthropic.com",d="/usr/v1/x",e="/v1/has space";
f(\`\${an().BASE_API_URL}\${h}\`);
f(\`\${an().OTHER}/x\`);
`;
    expect(names("endpoint", src)).toEqual([]);
  });
});

describe("file", () => {
  test("names joined to the config folder, found by the two anchors", () => {
    const src = `
var Le=memo(()=>home());
join(Le(),"history.jsonl");
join(Le(),"keybindings.json");
join(Le(),"settings.json");
join(other(),"nope.json");
join(proj,"project.json");
`;
    expect(names("file", src)).toEqual([
      "history.jsonl",
      "keybindings.json",
      "settings.json",
    ]);
  });

  test("a base without both anchors gives nothing", () => {
    expect(
      names("file", 'var B=f();join(B(),"history.jsonl");join(B(),"a.json");'),
    ).toEqual([]);
  });
});

describe("permission-rule", () => {
  test("the modes of the described enum", () => {
    const src = `
var m=f(()=>z(Iy,B(["default","plan","auto"])).describe("Permission mode for controlling how tool executions are handled. 'default' - x"));
var o=["other","list"];
`;
    const out = items("permission-rule", src);
    expect(out.map((i) => i.name)).toEqual(["auto", "default", "plan"]);
    expect(out.every((i) => i.detail === "mode")).toBe(true);
  });

  test("an enum with another description gives nothing", () => {
    expect(
      names("permission-rule", 'z(B(["default","plan"])).describe("Other");'),
    ).toEqual([]);
  });
});

describe("error", () => {
  test("a throw inside a CommonJS library wrapper is left out", () => {
    const src = `
var L=x((e,n)=>{function f(){throw Error("library text inside")}n.exports=f});
var M=x((e,n)=>{function g(){throw Error("wrapper with no exports")}g()});
function h(){throw Error("app text outside")}
`;
    expect(names("error", src)).toEqual([
      "app text outside",
      "wrapper with no exports",
    ]);
  });

  test("throws of Error types and subclasses, and stderr writes", () => {
    const src = `
class A extends Error{}
class B extends A{}
var C=class extends TypeError{};
throw Error("Not connected to server");
throw new TypeError("Invalid mode value");
throw new B("Subclass of subclass fails");
throw new C("Class expression fails");
throw new RangeError(\`Out of range: \${x}\`);
throw new SyntaxError("Bad " + name + " syntax");
process.stderr.write("Cloud gateway session expired\\n");
process.stderr.write(\`Cloud gateway \${n} is not trusted\`);
`;
    const by = new Map(items("error", src).map((i) => [i.name, i]));
    expect([...by.keys()].sort()).toEqual([
      `Bad \${…} syntax`,
      "Class expression fails",
      `Cloud gateway \${…} is not trusted`,
      "Cloud gateway session expired",
      "Invalid mode value",
      "Not connected to server",
      `Out of range: \${…}`,
      "Subclass of subclass fails",
    ]);
    expect(by.get("Not connected to server")?.detail).toBe("throw Error");
    expect(by.get("Subclass of subclass fails")?.detail).toBe("throw Error");
    expect(by.get("Class expression fails")?.detail).toBe("throw TypeError");
    expect(by.get("Cloud gateway session expired")?.detail).toBe("stderr");
  });

  test("each branch of a conditional throw gives its own text", () => {
    const src = `
class R extends Error{}
function f(a,p){throw a.some(g)?new R(\`read not allowed under --restricted: \${p}\`,"x"):new R(\`read not allowed under the read block: \${p}\`,"y")}
throw ok?Error("First branch message"):dyn("Factory branch text");
`;
    expect(names("error", src).sort()).toEqual([
      "First branch message",
      `read not allowed under --restricted: \${…}`,
      `read not allowed under the read block: \${…}`,
    ]);
  });

  test("factory throws, other classes, short texts, and codes are dropped", () => {
    const src = `
throw dyn("Cloud gateway failed here");
class Own{}
throw new Own("Not an error class");
throw new Error("aborted");
throw new Error("not JSON");
throw new Error("unreachable_state_code");
throw new Error("12345 67890 - 12");
console.error("Printed by a library only");
function f(Error){throw new Error("Shadowed Error is local")}
`;
    expect(names("error", src)).toEqual([]);
  });
});
