import { describe, expect, test } from "bun:test";
import {
  Bundle,
  constString,
  type Fn,
  type Node,
  returnsOf,
} from "../src/ast.ts";
import { type Entry, mergeEntries, Resolver } from "../src/resolve.ts";

const str = (key: string, v: string): Entry => ({
  key,
  opt: false,
  val: { k: "str", v },
});
const unk = (key: string, text: string): Entry => ({
  key,
  opt: false,
  val: { k: "unk", text },
});

/** The bundle of one or more chunks, and a resolver for it. */
const load = (files: Record<string, string>) => {
  const b = new Bundle(
    Object.entries(files).map(([name, text]) => ({
      name: `/$bunfs/root/${name}`,
      text,
    })),
  );
  return { b, r: new Resolver() };
};
/** Keys (with `?` when optional) of the object at the last `...id` spread in `src`. */
const spreadKeys = (
  src: string,
  id: string,
  extra: Record<string, string> = {},
) => {
  const { b, r } = load({ "a.js": src, ...extra });
  const m = b.get("a.js");
  if (!m) throw new Error("no module");
  const spread = m.at(src.lastIndexOf(`...${id}`), "SpreadElement");
  const got = spread && r.expr(m, spread.argument as Node);
  return got?.flatMap((e) => ("key" in e ? [e.key + (e.opt ? "?" : "")] : []));
};

describe("mergeEntries", () => {
  test("different string literals at two sites give an enum", () => {
    const [e] = mergeEntries([[str("subtype", "a")], [str("subtype", "b")]]);
    expect(e && "key" in e && e.val).toEqual({ k: "enum", v: ["a", "b"] });
  });
  test("a literal at one site and a computed value at another is not a const", () => {
    for (const lists of [
      [[str("level", "info")], [unk("level", "n")]],
      [[unk("level", "n")], [str("level", "info")]],
    ]) {
      const [e] = mergeEntries(lists);
      expect(e && "key" in e && e.val.k).toBe("unk");
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
      const [e] = mergeEntries(lists);
      expect(e && "key" in e && e.val).toEqual({
        k: "obj",
        e: [{ key: "stop_reason", opt: false, val: { k: "unk", text: "" } }],
        open: true,
      });
    }
  });
  test("a number at one site and an unknown value at another is unknown", () => {
    const num: Entry = { key: "n", opt: false, val: { k: "num", v: 0 } };
    const [e] = mergeEntries([[num], [unk("n", "x")]]);
    expect(e && "key" in e && e.val.k).toBe("unk");
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
    ])
      expect(spreadKeys(src, "x")).toBeUndefined();
  });
  test("the parameter of a `.then` callback is what the call returns", () => {
    expect(
      spreadKeys("function f(){return{a:1}}f().then((v)=>g({...v}))", "v"),
    ).toEqual(["a"]);
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
  test("`a ?? {...}` spreads give the keys of both sides, optional", () => {
    const { b, r } = load({ "a.js": "let a={x:1};g({...a??{y:2}})" });
    const m = b.get("a.js");
    const o = m?.at(m.text.indexOf("{..."), "ObjectExpression");
    expect(
      m &&
        o &&
        r
          .spreads(r.entries(m, o))
          .map((e) => ("key" in e ? `${e.key}${e.opt ? "?" : ""}` : "")),
    ).toEqual(["x?", "y?"]);
  });
});

describe("computed keys", () => {
  test("a key from a constant in the same chunk or an imported one", () => {
    const { b, r } = load({
      "a.js":
        'import{K as k}from"/$bunfs/root/b.js";var J="git.branch";let o={[k]:1,[J]:2,[u]:3}',
      "b.js": 'var K="git.commit";export{K};',
    });
    const m = b.get("a.js");
    if (!m) throw new Error("no module");
    expect(
      r.objectAt(m, m.text.indexOf("{[")).map((e) => ("key" in e ? e.key : "")),
    ).toEqual(["git.commit", "git.branch"]);
  });
  test("a name written twice is no constant", () => {
    const { b } = load({ "a.js": 'var J="a";J="b";J' });
    const m = b.get("a.js");
    expect(m && constString(m, m.nodeAt(m.text.length - 1))).toBeUndefined();
  });
});

describe("values", () => {
  test("a ternary of string literals is an enum; any other branch is unknown", () => {
    const { b, r } = load({
      "a.js":
        'let o={a:x?"a":"b",b:x?"a":y?"b":"c",c:x?"a":"a",d:x?"a":n,e:x?1:2}',
    });
    const m = b.get("a.js");
    if (!m) throw new Error("no module");
    const vals = r
      .objectAt(m, m.text.indexOf("{"))
      .map((e) =>
        "key" in e ? [e.key, e.val.k, "v" in e.val && e.val.v] : [],
      );
    expect(vals).toEqual([
      ["a", "enum", ["a", "b"]],
      ["b", "enum", ["a", "b", "c"]],
      ["c", "str", "a"],
      ["d", "unk", false],
      ["e", "unk", false],
    ]);
  });
});

describe("types", () => {
  /** The JSON type of each key of the object literal `o={...}`. */
  const types = (src: string, extra: Record<string, string> = {}) => {
    const { b, r } = load({ "a.js": src, ...extra });
    const m = b.get("a.js");
    if (!m) throw new Error("no module");
    return Object.fromEntries(
      r
        .objectAt(m, src.lastIndexOf("o={") + 2)
        .flatMap((e) => ("key" in e ? [[e.key, r.typeOfVal(e.val)]] : [])),
    );
  };
  test("built-ins, operators, and template strings", () => {
    expect(
      types(
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
  test("a name: every write, and undefined for none", () => {
    expect(
      types(
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
  test("a call: the types of its returns, with its parameters bound", () => {
    expect(
      types(
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
  test("a method name that Object.prototype has is no known built-in", () => {
    expect(
      types("let o={a:x.toString(),b:x.constructor(),c:Date.valueOf()}"),
    ).toEqual({ a: undefined, b: undefined, c: undefined });
  });
  test("a key a call returns as null is kept, as JSON keeps it", () => {
    expect(
      types(
        "function f(e){if(!e)return{u:null,v:void 0};return{u:1,v:2}}let o={a:f(x).u,b:f(x).v}",
      ),
    ).toEqual({ a: ["null", "number"], b: ["number"] });
  });
  test("a member of an object the code builds, and `??`, `?:`, `?.`", () => {
    expect(
      types(
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
  test("a name bound in another chunk, and a parameter from every call", () => {
    expect(
      types(
        'import{K}from"/$bunfs/root/b.js";function p(v){return{v}}p(1);p(2);let o={a:K,b:p(3).v}',
        { "b.js": "var K=Date.now();export{K};" },
      ),
    ).toEqual({ a: ["number"], b: ["number"] });
  });
  test("merging sites of different kinds keeps both types", () => {
    const [e] = mergeEntries([
      [str("level", "info")],
      [{ key: "level", opt: false, val: { k: "num", v: 1 } }],
    ]);
    expect(e && "key" in e && new Resolver().typeOfVal(e.val)).toEqual([
      "number",
      "string",
    ]);
  });
});

describe("returnsOf", () => {
  test("skips the returns of nested functions and keeps an arrow's body", () => {
    const { b } = load({
      "a.js":
        "function f(t){function g(){return 9}if(!t)return;return{a:1}};let h=()=>({b:2})",
    });
    const m = b.get("a.js");
    if (!m) throw new Error("no module");
    const f = m.at(0, "FunctionDeclaration") as Fn;
    expect(returnsOf(f).map((n) => (n ? m.src(n) : null))).toEqual([
      null,
      "{a:1}",
    ]);
    const arrow = m.at(m.text.indexOf("()=>"), "ArrowFunctionExpression") as Fn;
    expect(returnsOf(arrow).map((n) => (n ? m.src(n) : null))).toEqual([
      "{b:2}",
    ]);
  });
});
