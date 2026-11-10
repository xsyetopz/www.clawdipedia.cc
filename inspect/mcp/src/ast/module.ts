import { parse } from "oxc-parser";

import type { Bundle } from "./bundle.ts";
import { children, isNode, type Node, type NodeOf } from "./node.ts";
import { type Variable, type Variables, variablesOf } from "./variables.ts";

// The parser's `Severity` is an ambient const enum, which `verbatimModuleSyntax` cannot import.
const isError = (severity: string): boolean => severity === "Error";

/** One parsed module of a bundle, with its parents, optional chains, scopes, exports, and imports. */
export class Module {
	readonly name: string;
	readonly text: string;
	readonly bundle: Bundle | undefined;
	/** The module's syntax tree, with each `ChainExpression` taken out. */
	readonly ast: NodeOf<"Program">;
	readonly #parents = new WeakMap<Node, Node>();
	#vars?: Variables;
	readonly #chains = new WeakSet<Node>();
	#exports?: Map<string, string>;
	#imports?: Map<string, NodeOf<"ImportDeclaration">[]>;

	private constructor(
		name: string,
		text: string,
		ast: NodeOf<"Program">,
		bundle?: Bundle,
	) {
		this.name = name;
		this.text = text;
		this.ast = ast;
		this.bundle = bundle;
		const stack: Node[] = [];
		for (let n: Node | undefined = ast; n; n = stack.pop()) {
			this.#unwrapChains(n);
			for (const c of children(n)) {
				this.#parents.set(c, n);
				stack.push(c);
			}
		}
	}

	/** Parses `text` on a thread of the parser. It rejects with a `SyntaxError` when the text is not JavaScript. */
	static async parse(
		name: string,
		text: string,
		bundle?: Bundle,
	): Promise<Module> {
		const { program, errors } = await parse(name, text, {
			lang: "js",
			sourceType: "module",
			range: true,
			preserveParens: false,
		});
		const error = errors.find((e) => isError(e.severity));
		if (error) {
			throw new SyntaxError(error.message);
		}
		return new Module(name, text, program, bundle);
	}

	/**
	 * Puts the outermost link of each optional chain in the place of its `ChainExpression`, so `a?.b`
	 * is a member expression with `optional` set wherever it stands, and one type check finds it.
	 */
	#unwrapChains(n: Node): void {
		const link = (x: unknown): Node | undefined => {
			if (!isNode(x) || x.type !== "ChainExpression") {
				return undefined;
			}
			this.#chains.add(x.expression);
			return x.expression;
		};
		for (const [k, v] of Object.entries(n)) {
			if (Array.isArray(v)) {
				for (const [i, x] of v.entries()) {
					const to = link(x);
					if (to) {
						v[i] = to;
					}
				}
				continue;
			}
			const to = link(v);
			if (to) {
				Reflect.set(n, k, to);
			}
		}
	}

	#analyze(): Variables {
		this.#vars ??= variablesOf(this.ast);
		return this.#vars;
	}

	/** Each declared variable, by every identifier that declares or uses it. */
	get variables(): Map<Node, Variable> {
		return this.#analyze().byId;
	}

	parent(n: Node): Node | undefined {
		return this.#parents.get(n);
	}

	/** Whether `n` is the outermost link of an optional chain (`a?.b.c`). */
	isChain(n: Node): boolean {
		return this.#chains.has(n);
	}

	/** The source text of a node. */
	src(n: Node): string {
		return this.text.slice(n.start, n.end);
	}

	/** The innermost node that holds index `pos`. */
	nodeAt(pos: number): Node {
		let n: Node = this.ast;
		for (;;) {
			const next: Node | undefined = children(n).find(
				(c) => c.start <= pos && pos < c.end,
			);
			if (!next) {
				return n;
			}
			n = next;
		}
	}

	/** The outermost node of `type` that starts at index `pos`, or undefined. */
	at<T extends Node["type"]>(pos: number, type: T): NodeOf<T> | undefined {
		const isType = (n: Node): n is NodeOf<T> => n.type === type;
		let found: NodeOf<T> | undefined;
		for (let n: Node | undefined = this.nodeAt(pos); n; n = this.parent(n)) {
			if (n.start === pos && isType(n)) {
				found = n;
			} else if (n.start !== pos) {
				break;
			}
		}
		return found;
	}

	/** The variable an identifier names: the one it refers to, or the one it declares. */
	variable(id: Node): Variable | undefined {
		return this.variables.get(id);
	}

	/** Whether `id` reads a name that the module does not declare. */
	isGlobal(id: Node): boolean {
		return this.#analyze().globals.has(id);
	}

	/** Module-scope variable named `name`. */
	topLevel(name: string): Variable | undefined {
		return this.#analyze().top.get(name);
	}

	/** Exported name to local name, from `export{a as b}` and `export function`/`export const`. */
	get exports(): Map<string, string> {
		if (this.#exports) {
			return this.#exports;
		}
		const out = new Map<string, string>();
		this.#exports = out;
		for (const s of this.ast.body) {
			if (s.type !== "ExportNamedDeclaration") {
				continue;
			}
			for (const sp of s.specifiers) {
				if (
					sp.local.type === "Identifier" &&
					sp.exported.type === "Identifier"
				) {
					out.set(sp.exported.name, sp.local.name);
				}
			}
			const d = s.declaration;
			if (d?.type === "FunctionDeclaration" && d.id) {
				out.set(d.id.name, d.id.name);
			}
			if (d?.type === "VariableDeclaration") {
				for (const x of d.declarations) {
					if (x.id.type === "Identifier") {
						out.set(x.id.name, x.id.name);
					}
				}
			}
		}
		return out;
	}

	/** The import declarations of this module from the module path `source`. */
	importsFrom(source: string): NodeOf<"ImportDeclaration">[] {
		if (!this.#imports) {
			const imports = new Map<string, NodeOf<"ImportDeclaration">[]>();
			for (const s of this.ast.body) {
				if (s.type === "ImportDeclaration") {
					const k = s.source.value;
					imports.set(k, [...(imports.get(k) ?? []), s]);
				}
			}
			this.#imports = imports;
		}
		return this.#imports.get(source) ?? [];
	}
}
