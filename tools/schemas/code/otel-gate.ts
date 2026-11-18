// A span whose creating function returns at once through a gate that is constant false never reaches an exporter,
// so the schema leaves it out. In 2.1.327 the gate XXe() is `function XXe(){return!1}` (the program,
// chunk-epqcnh2q.js:8867), and both the span wrapper O8r() (chunk-epqcnh2q.js:20551) and the subagent span lFa()
// (chunk-epqcnh2q.js:21142) start with `if(!XXe())return`.
import { isFn, type Node } from "../../../inspect/mcp/src/ast.ts";
import type { Src } from "./ctx.ts";

/** The name of the gate a function body starts with, as in `{if(!G())return;...}`, or undefined. */
export const gateOf = (body: string): string | undefined =>
	/^\{if\(!([\w$]+)\(\)\)return[;}]/u.exec(body)?.[1];

/** Whether the module text declares `name` as a function that always returns false. */
export const isFalseFn = (text: string, name: string): boolean =>
	text.includes(`function ${name}(){return!1}`);

/** The constant-false gate of the innermost function around index `pos` of `m`, or undefined. */
export const deadGate = (m: Src, pos: number): string | undefined => {
	let n: Node | undefined = m.nodeAt(pos);
	while (n !== undefined && !isFn(n)) {
		n = m.parent(n);
	}
	if (n?.body?.type !== "BlockStatement") {
		return undefined;
	}
	const gate = gateOf(m.src(n.body));
	return gate !== undefined && isFalseFn(m.text, gate) ? gate : undefined;
};
