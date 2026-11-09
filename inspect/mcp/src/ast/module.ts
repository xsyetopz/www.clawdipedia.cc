import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import * as t from "@babel/types";

import type { Bundle } from "./bundle.ts";
import { asNode, children, type Node } from "./node.ts";
import { type Variable, variableOf } from "./variables.ts";

/** One module of a bundle: parsed on first use, with its parents, optional chains, scopes, exports, and imports. */
export class Module {
	readonly name: string;
	readonly text: string;
	readonly bundle: Bundle | undefined;
	#parsed?: { file: t.File; ast: Node };
	readonly #parents = new WeakMap<Node, Node>();
	#vars?: Map<Node, Variable>;
	readonly #top = new Map<string, Variable>();
	readonly #chains = new WeakSet<Node>();
	#exports?: Map<string, string>;
	#imports?: Map<string, t.ImportDeclaration[]>;

	constructor(name: string, text: string, bundle?: Bundle) {
		this.name = name;
		this.text = text;
		this.bundle = bundle;
	}

	/** Parses once, links each node to its parent, and rewrites optional chains the way ESTree has them. */
	#load(): { file: t.File; ast: Node } {
		if (this.#parsed) {
			return this.#parsed;
		}
		const file = parse(this.text, {
			sourceType: "module",
			attachComment: false,
		});
		const ast = asNode(file.program);
		if (!ast) {
			throw new Error(`module ${this.name} has no program position`);
		}
		this.#parsed = { file, ast };
		const optional = new WeakSet<Node>();
		const stack: Node[] = [];
		for (let n: Node | undefined = ast; n; n = stack.pop()) {
			this.#flattenOptional(n, optional);
			for (const c of children(n)) {
				this.#parents.set(c, n);
				stack.push(c);
			}
		}
		return this.#parsed;
	}

	/**
	 * `a?.b` stays a member expression with `optional` set, as in ESTree, so one type check finds both.
	 * The outermost link of a chain is what ESTree wraps in a `ChainExpression`.
	 */
	#flattenOptional(n: Node, optional: WeakSet<Node>): void {
		if (n.type === "OptionalMemberExpression") {
			this.#markChain(n, optional);
			Object.assign(n, { type: "MemberExpression" });
		} else if (n.type === "OptionalCallExpression") {
			this.#markChain(n, optional);
			Object.assign(n, { type: "CallExpression" });
		}
	}

	#markChain(n: Node, optional: WeakSet<Node>): void {
		const p = this.#parents.get(n);
		const link =
			p !== undefined &&
			optional.has(p) &&
			((p.type === "MemberExpression" && p.object === n) ||
				(p.type === "CallExpression" && p.callee === n));
		if (!link) {
			this.#chains.add(n);
		}
		optional.add(n);
	}

	/** The module's syntax tree; it throws when the text is not JavaScript. */
	get ast(): Node {
		return this.#load().ast;
	}

	#analyze(): Map<Node, Variable> {
		if (this.#vars) {
			return this.#vars;
		}
		const vars = new Map<Node, Variable>();
		traverse(this.#load().file, {
			Scope: (p) => {
				for (const b of Object.values(p.scope.bindings)) {
					const v = variableOf(b, this.#parents);
					if (!v) {
						continue;
					}
					for (const id of v.identifiers) {
						vars.set(id, v);
					}
					for (const r of v.references) {
						vars.set(r.identifier, v);
					}
					if (p.isProgram()) {
						this.#top.set(v.name, v);
					}
				}
			},
		});
		this.#vars = vars;
		return vars;
	}

	/** Each declared variable, by every identifier that declares or uses it. */
	get variables(): Map<Node, Variable> {
		return this.#analyze();
	}

	parent(n: Node): Node | undefined {
		this.#load();
		return this.#parents.get(n);
	}

	/** Whether `n` is the outermost link of an optional chain (`a?.b.c`). */
	isChain(n: Node): boolean {
		this.#load();
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
			if (!next) {
				return n;
			}
			n = next;
		}
	}

	/** The outermost node of `type` that starts at index `pos`, or undefined. */
	at<T extends Node["type"]>(
		pos: number,
		type: T,
	): Extract<Node, { type: T }> | undefined {
		const isType = (n: Node): n is Extract<Node, { type: T }> =>
			n.type === type;
		let found: Extract<Node, { type: T }> | undefined;
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
		const p = this.parent(id);
		return (
			p !== undefined &&
			!this.variable(id) &&
			t.isReferenced(id, p, this.parent(p))
		);
	}

	/** Module-scope variable named `name`. */
	topLevel(name: string): Variable | undefined {
		this.#analyze();
		return this.#top.get(name);
	}

	/** The top-level statements of the module. */
	#body(): t.Statement[] {
		const root = this.ast;
		return root.type === "Program" ? root.body : [];
	}

	/** Exported name to local name, from `export{a as b}` and `export function`/`export const`. */
	get exports(): Map<string, string> {
		if (this.#exports) {
			return this.#exports;
		}
		const out = new Map<string, string>();
		this.#exports = out;
		for (const s of this.#body()) {
			if (s.type !== "ExportNamedDeclaration") {
				continue;
			}
			for (const sp of s.specifiers) {
				if (
					sp.type === "ExportSpecifier" &&
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
	importsFrom(source: string): t.ImportDeclaration[] {
		if (!this.#imports) {
			const imports = new Map<string, t.ImportDeclaration[]>();
			for (const s of this.#body()) {
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
