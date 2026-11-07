import type * as t from "@babel/types";

export type Node = t.Node & { start: number; end: number };
export type Fn = Node &
  (
    | t.FunctionDeclaration
    | t.FunctionExpression
    | t.ArrowFunctionExpression
    | t.ObjectMethod
    | t.ClassMethod
    | t.ClassPrivateMethod
  );

export const isNode = (x: unknown): x is Node =>
  typeof x === "object" &&
  x !== null &&
  typeof (x as Node).type === "string" &&
  typeof (x as Node).start === "number";

export const isFn = (n: Node | null | undefined): n is Fn =>
  n?.type === "FunctionDeclaration" ||
  n?.type === "FunctionExpression" ||
  n?.type === "ArrowFunctionExpression" ||
  n?.type === "ObjectMethod" ||
  n?.type === "ClassMethod" ||
  n?.type === "ClassPrivateMethod";

/** A value written in the code: string, number, boolean, null, regex, or bigint. A template is not one. */
export const isLit = (n: Node | null | undefined): boolean =>
  !!n && n.type !== "TemplateLiteral" && n.type.endsWith("Literal");

/** The value of a literal: `null` for `null`, and undefined for a regex. */
export const litValue = (n: Node): unknown =>
  n.type === "NullLiteral" ? null : (n as { value?: unknown }).value;

export type Method = Node &
  (t.ObjectMethod | t.ClassMethod | t.ClassPrivateMethod);
export const isMethod = (n: Node | null | undefined): n is Method =>
  n?.type === "ObjectMethod" ||
  n?.type === "ClassMethod" ||
  n?.type === "ClassPrivateMethod";

/** Where the function of a method starts: at its parameters, as ESTree's `value` did. A Babel method starts at its key. */
export const valueStart = (text: string, n: Method): number =>
  text.indexOf("(", n.key.end as number);

/** The child nodes of `n`, in source order. */
export const children = (n: Node): Node[] => {
  const out: Node[] = [];
  for (const [k, v] of Object.entries(n)) {
    if (k === "loc" || k === "range" || k === "interpreter") continue;
    if (Array.isArray(v)) for (const x of v) isNode(x) && out.push(x);
    else if (isNode(v)) out.push(v);
  }
  return out.sort((a, b) => a.start - b.start);
};
