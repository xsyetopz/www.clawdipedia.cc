// Reads the modules of a bundled program with a real parser and scope analysis (Babel).
// Each module parses on first use. Bun chunks import each other as `/$bunfs/root/<chunk>`; a `Bundle`
// follows those imports, so a name resolves to its declaration in any chunk.
import { parse } from "@babel/parser";
import traverse, { type Binding, type NodePath } from "@babel/traverse";
import * as t from "@babel/types";

import { children, type Node } from "./ast/node.ts";

export {
  type Call,
  type CallNode,
  callsOf,
  constString,
  functionOf,
  nameOf,
  returnsOf,
} from "./ast/calls.ts";
export {
  children,
  type Fn,
  isFn,
  isLit,
  isMethod,
  litValue,
  type Node,
  valueStart,
} from "./ast/node.ts";

/** Where a name is declared: the declarator, function, class, specifier, or catch clause. */
export type Def = {
  /** The identifier that declares the name. */
  name: Node;
  /** The declaration, import, or function around `node`. */
  parent: Node;
} & (
  | { type: "Variable"; node: t.VariableDeclarator & Node }
  | {
      type:
        | "Parameter"
        | "FunctionName"
        | "ClassName"
        | "ImportBinding"
        | "CatchClause";
      node: Node;
    }
);
/** A read or a write of a name; `init` marks the write that comes with the declaration. */
export type Ref = {
  identifier: Node;
  write: boolean;
  init: boolean;
  writeExpr: Node | null;
};
export type Variable = {
  name: string;
  binding: Binding;
  defs: Def[];
  identifiers: Node[];
  references: Ref[];
};

const PATTERN = new Set([
  "ObjectPattern",
  "ArrayPattern",
  "ObjectProperty",
  "RestElement",
  "AssignmentPattern",
]);

const DEF = {
  FunctionDeclaration: "FunctionName",
  FunctionExpression: "FunctionName",
  ClassDeclaration: "ClassName",
  ClassExpression: "ClassName",
  CatchClause: "CatchClause",
} as const;

/** The value a declarator starts with; a `for (x of y)` declarator starts with `y`. */
const initOf = (p: NodePath): Node | null => {
  const loop = p.parentPath?.parent;
  return ((p.node as t.VariableDeclarator).init ??
    ((loop?.type === "ForOfStatement" || loop?.type === "ForInStatement") &&
    loop.left === p.parent
      ? loop.right
      : null)) as Node | null;
};

const variableOf = (
  b: Binding,
  parents: WeakMap<Node, Node>,
): Variable | undefined => {
  const name = b.identifier as Node;
  const n = b.path.node as Node;
  const parent = b.path.parent as Node;
  const at = (type: string, node: Node) =>
    ({ type, node, name, parent }) as Def;
  const def =
    b.kind === "param"
      ? at("Parameter", b.scope.path.node as Node)
      : b.kind === "module"
        ? at("ImportBinding", n)
        : n.type === "VariableDeclarator"
          ? at("Variable", n)
          : n.type in DEF
            ? at(DEF[n.type as keyof typeof DEF], n)
            : undefined;
  if (!def) return undefined;
  const v: Variable = {
    name: (name as t.Identifier).name,
    binding: b,
    defs: [def],
    identifiers: [name],
    references: [],
  };
  const write = (identifier: Node, writeExpr: Node | null, init: boolean) =>
    v.references.push({ identifier, write: true, init, writeExpr });
  const init = def.type === "Variable" ? initOf(b.path) : null;
  if (init) write(name, init, true);
  // A default anywhere above the name in its pattern: `{now:s=f}`.
  for (let c = name, p = parents.get(c); p; c = p, p = parents.get(c)) {
    if (p.type === "AssignmentPattern" && p.left === c)
      write(name, p.right as Node, true);
    else if (!PATTERN.has(p.type)) break;
  }
  for (const p of b.referencePaths)
    if (p.isIdentifier())
      v.references.push({
        identifier: p.node as Node,
        write: false,
        init: false,
        writeExpr: null,
      });
  for (const c of b.constantViolations) {
    const id = c.getBindingIdentifiers()[v.name] as Node | undefined;
    if (!id) continue;
    if (c.isVariableDeclarator()) {
      v.defs.push({ ...def, node: c.node, name: id } as Def);
      v.identifiers.push(id);
      const i = initOf(c);
      if (i) write(id, i, true);
    } else
      write(
        id,
        c.isUpdateExpression()
          ? null
          : ((c.node as t.AssignmentExpression).right as Node),
        false,
      );
  }
  v.references.sort((a, b) => a.identifier.start - b.identifier.start);
  return v;
};

export class Module {
  readonly name: string;
  readonly text: string;
  readonly bundle: Bundle | undefined;
  #file?: t.File;
  #ast?: Node;
  #parents = new WeakMap<Node, Node>();
  #vars?: Map<Node, Variable>;
  #top = new Map<string, Variable>();
  #chains = new WeakSet<Node>();

  constructor(name: string, text: string, bundle?: Bundle) {
    this.name = name;
    this.text = text;
    this.bundle = bundle;
  }

  /** The module's syntax tree; it throws when the text is not JavaScript. */
  get ast(): Node {
    if (!this.#ast) {
      this.#file = parse(this.text, {
        sourceType: "module",
        attachComment: false,
      });
      this.#ast = this.#file.program as Node;
      const stack: Node[] = [this.#ast];
      const optional = new WeakSet<Node>();
      while (stack.length) {
        const n = stack.pop() as Node;
        // `a?.b` stays a member expression with `optional` set, as in ESTree, so one type check finds both.
        // The outermost link of a chain is what ESTree wraps in a `ChainExpression`.
        if (
          n.type === "OptionalMemberExpression" ||
          n.type === "OptionalCallExpression"
        ) {
          const p = this.#parents.get(n) as Node;
          const link =
            optional.has(p) &&
            ((p as t.OptionalMemberExpression).object === n ||
              (p as t.OptionalCallExpression).callee === n);
          if (!link) this.#chains.add(n);
          optional.add(n);
          (n as { type: string }).type =
            n.type === "OptionalMemberExpression"
              ? "MemberExpression"
              : "CallExpression";
        }
        for (const c of children(n)) {
          this.#parents.set(c, n);
          stack.push(c);
        }
      }
    }
    return this.#ast;
  }

  /** Each declared variable, by every identifier that declares or uses it. */
  get variables(): Map<Node, Variable> {
    if (!this.#vars) {
      this.ast;
      const vars = new Map<Node, Variable>();
      traverse(this.#file as t.File, {
        Scope: (p) => {
          for (const b of Object.values(p.scope.bindings)) {
            const v = variableOf(b, this.#parents);
            if (!v) continue;
            for (const id of v.identifiers) vars.set(id, v);
            for (const r of v.references) vars.set(r.identifier, v);
            if (p.isProgram()) this.#top.set(v.name, v);
          }
        },
      });
      this.#vars = vars;
    }
    return this.#vars;
  }

  parent(n: Node): Node | undefined {
    this.ast;
    return this.#parents.get(n);
  }

  /** Whether `n` is the outermost link of an optional chain (`a?.b.c`). */
  isChain(n: Node): boolean {
    this.ast;
    return this.#chains.has(n);
  }

  /** The source text of a node. */
  src(n: Node): string {
    return this.text.slice(n.start, n.end);
  }

  /** The innermost node that holds index `pos`. */
  nodeAt(pos: number): Node {
    let n = this.ast;
    for (;;) {
      const next = children(n).find((c) => c.start <= pos && pos < c.end);
      if (!next) return n;
      n = next;
    }
  }

  /** The outermost node of `type` that starts at index `pos`, or undefined. */
  at<T extends Node["type"]>(
    pos: number,
    type: T,
  ): Extract<Node, { type: T }> | undefined {
    let found: Node | undefined;
    for (let n: Node | undefined = this.nodeAt(pos); n; n = this.parent(n))
      if (n.start === pos && n.type === type) found = n;
      else if (n.start !== pos) break;
    return found as Extract<Node, { type: T }> | undefined;
  }

  /** The variable an identifier names: the one it refers to, or the one it declares. */
  variable(id: Node): Variable | undefined {
    return this.variables.get(id);
  }

  /** Whether `id` reads a name that the module does not declare. */
  isGlobal(id: Node): boolean {
    const p = this.parent(id);
    return !!p && !this.variable(id) && t.isReferenced(id, p, this.parent(p));
  }

  /** Module-scope variable named `name`. */
  topLevel(name: string): Variable | undefined {
    this.variables;
    return this.#top.get(name);
  }

  /** Exported name to local name, from `export{a as b}` and `export function`/`export const`. */
  get exports(): Map<string, string> {
    if (this.#exports) return this.#exports;
    const out = new Map<string, string>();
    this.#exports = out;
    for (const s of (this.ast as t.Program).body) {
      if (s.type !== "ExportNamedDeclaration") continue;
      for (const sp of s.specifiers)
        if (
          sp.type === "ExportSpecifier" &&
          sp.local.type === "Identifier" &&
          sp.exported.type === "Identifier"
        )
          out.set(sp.exported.name, sp.local.name);
      const d = s.declaration;
      if (d?.type === "FunctionDeclaration" && d.id)
        out.set(d.id.name, d.id.name);
      if (d?.type === "VariableDeclaration")
        for (const x of d.declarations)
          if (x.id.type === "Identifier") out.set(x.id.name, x.id.name);
    }
    return out;
  }

  #exports?: Map<string, string>;
  #imports?: Map<string, t.ImportDeclaration[]>;

  /** The import declarations of this module from the module path `source`. */
  importsFrom(source: string): t.ImportDeclaration[] {
    if (!this.#imports) {
      this.#imports = new Map();
      for (const s of (this.ast as t.Program).body)
        if (s.type === "ImportDeclaration") {
          const k = String(s.source.value);
          this.#imports.set(k, [...(this.#imports.get(k) ?? []), s]);
        }
    }
    return this.#imports.get(source) ?? [];
  }
}

const ROOT = "/$bunfs/root/";

/** The modules of one program, by file name (`chunk-abc.js`). */
export class Bundle {
  readonly modules = new Map<string, Module>();

  constructor(files: { name: string; text: string }[]) {
    for (const f of files) {
      const name = f.name.split("/").pop() as string;
      this.modules.set(name, new Module(name, f.text, this));
    }
  }

  get(name: string): Module | undefined {
    return this.modules.get(
      name.startsWith(ROOT) ? name.slice(ROOT.length) : name,
    );
  }

  /** Modules whose text names `needle`. */
  withText(needle: string): Module[] {
    return [...this.modules.values()].filter((m) => m.text.includes(needle));
  }

  /**
   * Where an imported binding comes from: the module that exports it and that module's variable.
   * It follows re-exports. Undefined for anything else.
   */
  origin(
    m: Module,
    v: Variable,
    seen = 0,
  ): { module: Module; variable: Variable } | undefined {
    const def = v.defs[0];
    if (def?.type !== "ImportBinding") return { module: m, variable: v };
    if (seen > 8 || def.node.type !== "ImportSpecifier") return undefined;
    const from = this.get(
      String((def.parent as t.ImportDeclaration).source.value),
    );
    const imported =
      def.node.imported.type === "Identifier"
        ? def.node.imported.name
        : String(def.node.imported.value);
    const local = from?.exports.get(imported);
    const target = local ? from?.topLevel(local) : undefined;
    return from && target ? this.origin(from, target, seen + 1) : undefined;
  }

  #importers?: Map<string, Module[]>;

  /** The modules whose text names the chunk `name` as `"/$bunfs/root/<name>"`, indexed on first use. */
  importersOf(name: string): Module[] {
    if (!this.#importers) {
      this.#importers = new Map();
      const re = /"\/\$bunfs\/root\/([^"]+)"/g;
      for (const m of this.modules.values())
        for (const n of new Set(
          Array.from(m.text.matchAll(re), (x) => x[1] as string),
        ))
          this.#importers.set(n, [...(this.#importers.get(n) ?? []), m]);
    }
    return this.#importers.get(name) ?? [];
  }

  /** The local variables in other modules that import the top-level `v` of `m`. */
  importers(m: Module, v: Variable): { module: Module; variable: Variable }[] {
    const names = [...m.exports]
      .filter(([, l]) => l === v.name)
      .map(([e]) => e);
    if (names.length === 0) return [];
    const out: { module: Module; variable: Variable }[] = [];
    for (const other of this.importersOf(m.name)) {
      if (other === m) continue;
      for (const s of other.importsFrom(ROOT + m.name)) {
        for (const sp of s.specifiers) {
          if (sp.type !== "ImportSpecifier") continue;
          const imported =
            sp.imported.type === "Identifier"
              ? sp.imported.name
              : String(sp.imported.value);
          if (!names.includes(imported)) continue;
          const local = other.topLevel(sp.local.name);
          if (local) out.push({ module: other, variable: local });
        }
      }
    }
    return out;
  }
}
