import { describe, expect, test } from "bun:test";
import { Bundle, children, type Node } from "../src/ast.ts";
import { literal, short, unique } from "../src/surface/common.ts";
import { KINDS, surface } from "../src/surface/index.ts";
import { bundle, items, names } from "./surface/util.ts";

describe("registry", () => {
  test("lists the kinds", () => {
    expect(Object.keys(KINDS).sort()).toEqual([
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

  test("throws on an unknown kind", () => {
    expect(() => surface(bundle("var a=1"), "nope")).toThrow(/unknown kind/);
  });

  test("computes a kind once per bundle", () => {
    const b = bundle('var a=["PreToolUse","PostToolUse"]');
    expect(surface(b, "hook-event")).toBe(surface(b, "hook-event"));
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

  test("a repeated name keeps its first module and its last offset in it", () => {
    const a = "var x=process.env.AAA_ONE;var y=process.env.AAA_ONE;";
    const b = new Bundle([
      { name: "/$bunfs/root/a.js", text: a },
      { name: "/$bunfs/root/b.js", text: a },
    ]);
    const hit = surface(b, "env").find((i) => i.name === "AAA_ONE");
    expect([hit?.module, hit?.offset]).toEqual([
      "a.js",
      a.lastIndexOf("process"),
    ]);
  });

  test("short blanks placeholders and cuts long text", () => {
    expect(short("a $" + "{x}  b")).toBe("a $" + "{…} b");
    expect(short("x".repeat(10), 4)).toBe("xxxx…");
  });

  test("literal reads short literals", () => {
    const m = bundle("var a=[!0,!1,-1,void 0,'s',f(),[1,2]]").get("a.js");
    const elements: Node[] = [];
    const stack: Node[] = m ? [m.ast] : [];
    while (stack.length) {
      const n = stack.pop() as Node;
      if (n.type === "ArrayExpression" && !elements.length)
        elements.push(...(n.elements as Node[]));
      else stack.push(...children(n));
    }
    const out = elements.map((e) => (m ? literal(m, e) : ""));
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
  test("reads of process.env and of the typed registry", () => {
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
    const out = items("env", src);
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
    ])
      expect(by.has(n)).toBe(true);
    expect(by.get("REG_BOOL")?.detail).toBe("bool");
    expect(by.get("REG_ENUM")?.values).toEqual(["a", "b"]);
    expect(by.get("REG_INT")?.detail).toBe("int{min:0}");
  });

  test("names set for a child process", () => {
    const src = `
spawn("x",[],{env:{...process.env,CHILD_SET:1}});
var a=["--setenv","SANDBOX_VAR","1"];
`;
    const by = new Map(items("env", src).map((i) => [i.name, i]));
    expect(by.get("CHILD_SET")?.detail).toBe("set for a child process");
    expect(by.get("SANDBOX_VAR")?.detail).toBe("set for a child process");
  });

  test("a helper that passes its parameter on to another helper", () => {
    const src = `
function Su(e){return process.env[e]}
function wt(e){let n=Su(e);return Number(n)}
var a=wt("VIA_TWO_HELPERS"),b=Su("VIA_ONE_HELPER");
`;
    const n = names("env", src);
    expect(n).toContain("VIA_TWO_HELPERS");
    expect(n).toContain("VIA_ONE_HELPER");
  });

  // Claude Code 2.1.319 `plugin eval`: `ll.flatMap(Ct)` and `["KRB5CCNAME",...].flatMap((j)=>Ul(ce(j)))`.
  test("a helper called on each name of a constant list", () => {
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
    const n = names("env", src);
    for (const x of ["VIA_LIST_A", "VIA_LIST_B", "VIA_INLINE", "VIA_ANY_CASE"])
      expect(n).toContain(x);
    expect(n).not.toContain("NOT_READ");
  });

  test("a lowercase read of another object is not an env name", () => {
    const n = names("env", "var o={a:1};var x=o.FOO_BAR,y=o.low;");
    expect(n).not.toContain("FOO_BAR");
    expect(n).not.toContain("low");
  });

  test("a child env key whose value reads a build-constant object is an env name, the constant's own keys are not", () => {
    const src = `
var i=process.env;
function b(){let e={USER_TYPE:"external",NODE_ENV:"production",VITALS_CLI_VERSION:{PACKAGE_URL:"p",VERSION:"1",GIT_SHA:"s"}.VERSION};return e}
var u=i.USER_TYPE,n=i.NODE_ENV;
`;
    const n = names("env", src);
    expect(n).toContain("VITALS_CLI_VERSION");
    for (const k of ["PACKAGE_URL", "VERSION", "GIT_SHA"])
      expect(n).not.toContain(k);
  });
});

describe("flag", () => {
  test("option, requiredOption, and addOption with hideHelp", () => {
    const src = `
var p=new C();
p.option("-d, --debug [filter]","Enable debug");
p.requiredOption("--issuer <url>","Issuer");
p.addOption(new O("--init","Run init").hideHelp());
p.addOption(new O("--shown","Shown"));
`;
    const by = new Map(items("flag", src).map((i) => [i.name, i]));
    expect([...by.keys()].sort()).toEqual([
      "--debug",
      "--init",
      "--issuer",
      "--shown",
    ]);
    expect(by.get("--debug")?.detail).toBe(
      "-d, --debug [filter] | Enable debug",
    );
    expect(by.get("--init")?.gate).toBe("hidden");
    expect(by.get("--shown")?.gate).toBeUndefined();
  });

  test("a flag on a subcommand gets the command path", () => {
    const src = `
var p=new C();
var m=p.command("mcp");
m.command("add <name>").option("--transport <t>","Transport");
`;
    expect(names("flag", src)).toEqual(["mcp add --transport"]);
  });

  test("an option in a variable and a conditional one", () => {
    const src = `
var p=new C();
let h=new O("--var-opt","V");
p.addOption(h);
var h2=new O("--cond-opt","C");
p.addOption(k?h2:h2.hideHelp());
`;
    const by = new Map(items("flag", src).map((i) => [i.name, i]));
    expect(by.has("--var-opt")).toBe(true);
    expect(by.get("--cond-opt")?.gate).toBe("hidden unless k");
  });

  test("a non-flag first argument is dropped", () => {
    expect(names("flag", 'o.option("plain","x");o.option(1,"y");')).toEqual([]);
  });
});

describe("subcommand", () => {
  test("paths, args, and hidden", () => {
    const src = `
var p=new C();
var m=p.command("mcp");
m.command("add <name> [args...]");
p.command("secret",{hidden:!0});
p.command("auth").command("login");
`;
    const by = new Map(items("subcommand", src).map((i) => [i.name, i]));
    expect([...by.keys()].sort()).toEqual([
      "auth",
      "auth login",
      "mcp",
      "mcp add",
      "secret",
    ]);
    expect(by.get("mcp add")?.detail).toBe("<name> [args...]");
    expect(by.get("secret")?.gate).toBe("hidden");
    expect(by.get("mcp")?.gate).toBeUndefined();
  });

  test("a name that starts with a dash or is not constant is dropped", () => {
    expect(names("subcommand", 'p.command("-x");p.command(f());')).toEqual([]);
  });
});

describe("slash-command", () => {
  test("local, local-jsx, and prompt objects", () => {
    const src = `
var a={type:"local",name:"compact",description:"Free up context",aliases:["c","sq"],isEnabled:()=>!0};
var b={type:"local-jsx",name:"hid",description:"H",isHidden:!0};
var c={type:"prompt",name:"avail",description:"A",availability:["claude-ai","console"]};
`;
    const by = new Map(items("slash-command", src).map((i) => [i.name, i]));
    expect([...by.keys()].sort()).toEqual(["/avail", "/compact", "/hid"]);
    expect(by.get("/compact")?.detail).toBe(
      "local (aliases c, sq) | Free up context",
    );
    expect(by.get("/compact")?.gate).toBe("isEnabled ()=>!0");
    expect(by.get("/hid")?.gate).toBe("hidden");
    expect(by.get("/avail")?.gate).toBe("availability claude-ai, console");
  });

  test("a builder that makes a prompt command from its name", () => {
    const src = `
function build({name:e}){return{type:"prompt",name:e,description:"d"}}
build({name:"security-review",description:"Review"});
`;
    expect(names("slash-command", src)).toContain("/security-review");
  });

  // Claude Code 2.1.311 registers `/claude-api` as `reg(make(o))`, with the object returned by `make`.
  test("a factory whose returned object a builder registers", () => {
    const src = `
function reg(p){return{type:"prompt",name:p.name,description:p.description}}
function make({disabled:a=!1}={}){let m=new Map();return(m.clear(),{name:"claude-api",description:"d",isEnabled:()=>!a})}
function register(o){reg(make(o))}
`;
    const by = new Map(items("slash-command", src).map((i) => [i.name, i]));
    expect([...by.keys()]).toEqual(["/claude-api"]);
    expect(by.get("/claude-api")?.detail).toBe("prompt | d");
  });

  test("negatives: other types, run-time names, and bad names", () => {
    const src = `
var a={type:"tool",name:"bash"};
var b={type:"local",name:e.name};
var c={type:"local",name:"Bad Name"};
var d={name:"notype"};
`;
    expect(names("slash-command", src)).toEqual([]);
  });
});

describe("setting", () => {
  test("keys of the schema object, details, and conditional spread", () => {
    const src = `
function s(){return{
$schema:()=>z.string().describe("JSON Schema reference for Claude Code settings").optional(),
apiKeyHelper:()=>z.string().describe("Script that prints a key").optional(),
permissions:()=>z.object({}),
...i.CLAUDE_CODE_ENABLE_XAA&&{xaaIdp:()=>z.string().describe("XAA")}
}}
`;
    const by = new Map(items("setting", src).map((i) => [i.name, i]));
    expect([...by.keys()].sort()).toEqual([
      "$schema",
      "apiKeyHelper",
      "permissions",
      "xaaIdp",
    ]);
    expect(by.get("apiKeyHelper")?.detail).toBe("Script that prints a key");
    expect(by.get("permissions")?.detail).toBeUndefined();
    expect(by.get("xaaIdp")?.gate).toBe("i.CLAUDE_CODE_ENABLE_XAA");
  });

  test("gated tables give buildGate as the gate", () => {
    const src = `var t={tbl:{buildGate:()=>!0,shape:()=>({gatedKey:z.string()})}};`;
    const [it] = items("setting", src);
    expect(it?.name).toBe("gatedKey");
    expect(it?.gate).toBe("buildGate ()=>!0");
  });

  test("an object with no anchor gives no settings", () => {
    expect(names("setting", "var o={apiKeyHelper:()=>z.string()};")).toEqual(
      [],
    );
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
    new Bundle([
      { name: "/$bunfs/root/a.js", text: src },
      { name: "/$bunfs/root/lib.js", text: lib },
    ]);

  test("gives the leaf keys through helpers, records, memoized schemas, and keys built from a list", () => {
    expect(surface(b(), "setting-key").map((i) => i.name)).toEqual([
      "gated.on",
      "helpers.default",
      "helpers.linux.path",
      "helpers.macos.path",
      "known.*.source.repo",
      "permissions.allow",
    ]);
  });

  test("keeps the describe text and the gate of the top-level key", () => {
    const by = new Map(surface(b(), "setting-key").map((i) => [i.name, i]));
    expect(by.get("permissions.allow")?.detail).toBe("Allowed rules");
    expect(by.get("gated.on")?.gate).toBe("i.X");
  });
});

describe("hook-event", () => {
  test("takes the longest PascalCase list with PreToolUse and PostToolUse", () => {
    const src = `
var a=["PreToolUse","PostToolUse"];
var b=["PreToolUse","PostToolUse","SessionStart","Stop"];
var c=["PreToolUse","PostToolUse","not_pascal","Another","Yet","More","Names"];
var d=["SessionStart","Stop","Other","More","Names"];
`;
    expect(names("hook-event", src)).toEqual([
      "PostToolUse",
      "PreToolUse",
      "SessionStart",
      "Stop",
    ]);
  });

  test("no list gives no events", () => {
    expect(names("hook-event", 'var a=["PreToolUse","Stop"];')).toEqual([]);
  });
});
