// Scope analysis of one module: where each name is declared and where it is read or written (Babel bindings).
import type { Binding, NodePath } from "@babel/traverse";
import type * as t from "@babel/types";

import { asNode, isNode, type Node } from "./node.ts";

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
export interface Ref {
	identifier: Node;
	write: boolean;
	init: boolean;
	writeExpr: Node | null;
}
export interface Variable {
	name: string;
	binding: Binding;
	defs: Def[];
	identifiers: Node[];
	references: Ref[];
}

const PATTERN = new Set([
	"ObjectPattern",
	"ArrayPattern",
	"ObjectProperty",
	"RestElement",
	"AssignmentPattern",
]);

const DEF = new Map<string, "FunctionName" | "ClassName" | "CatchClause">([
	["FunctionDeclaration", "FunctionName"],
	["FunctionExpression", "FunctionName"],
	["ClassDeclaration", "ClassName"],
	["ClassExpression", "ClassName"],
	["CatchClause", "CatchClause"],
]);

/** The value a declarator starts with; a `for (x of y)` declarator starts with `y`. */
const initOf = (p: NodePath): Node | null => {
	const init = p.isVariableDeclarator() ? p.node.init : undefined;
	if (init) {
		return asNode(init) ?? null;
	}
	const loop = p.parentPath?.parent;
	if (
		(loop?.type === "ForOfStatement" || loop?.type === "ForInStatement") &&
		loop.left === p.parent
	) {
		return asNode(loop.right) ?? null;
	}
	return null;
};

const defOf = (b: Binding, name: Node): Def | undefined => {
	const n = asNode(b.path.node);
	const parent = asNode(b.path.parent);
	if (!n || !parent) {
		return undefined;
	}
	if (b.kind === "param") {
		const node = asNode(b.scope.path.node);
		return node ? { type: "Parameter", node, name, parent } : undefined;
	}
	if (b.kind === "module") {
		return { type: "ImportBinding", node: n, name, parent };
	}
	if (n.type === "VariableDeclarator") {
		return { type: "Variable", node: n, name, parent };
	}
	const type = DEF.get(n.type);
	return type ? { type, node: n, name, parent } : undefined;
};

const writeOf = (
	v: Variable,
	identifier: Node,
	writeExpr: Node | null,
	init: boolean,
): void => {
	v.references.push({ identifier, write: true, init, writeExpr });
};

/** Writes from a default anywhere above the name in its pattern: `{now:s=f}`. */
const addDefaults = (v: Variable, name: Node, parents: WeakMap<Node, Node>) => {
	for (let c = name, p = parents.get(c); p; c = p, p = parents.get(c)) {
		if (p.type === "AssignmentPattern" && p.left === c) {
			const right = asNode(p.right);
			if (right) {
				writeOf(v, name, right, true);
			}
		} else if (!PATTERN.has(p.type)) {
			break;
		}
	}
};

const addViolations = (v: Variable, def: Def, b: Binding) => {
	for (const c of b.constantViolations) {
		const id = asNode(c.getBindingIdentifiers()[v.name]);
		if (!id) {
			continue;
		}
		if (c.isVariableDeclarator()) {
			const node = c.node;
			if (!isNode(node)) {
				continue;
			}
			v.defs.push({ ...def, node, name: id });
			v.identifiers.push(id);
			const i = initOf(c);
			if (i) {
				writeOf(v, id, i, true);
			}
		} else {
			const right = "right" in c.node ? asNode(c.node.right) : undefined;
			writeOf(v, id, right ?? null, false);
		}
	}
};

/** The variable a Babel binding stands for, or undefined for a kind of binding that has no declaration here. */
export const variableOf = (
	b: Binding,
	parents: WeakMap<Node, Node>,
): Variable | undefined => {
	const name = asNode(b.identifier);
	const def = name ? defOf(b, name) : undefined;
	if (!name || !def) {
		return undefined;
	}
	const v: Variable = {
		name: b.identifier.name,
		binding: b,
		defs: [def],
		identifiers: [name],
		references: [],
	};
	const init = def.type === "Variable" ? initOf(b.path) : null;
	if (init) {
		writeOf(v, name, init, true);
	}
	addDefaults(v, name, parents);
	for (const p of b.referencePaths) {
		if (p.isIdentifier() && isNode(p.node)) {
			v.references.push({
				identifier: p.node,
				write: false,
				init: false,
				writeExpr: null,
			});
		}
	}
	addViolations(v, def, b);
	v.references.sort((a, c) => a.identifier.start - c.identifier.start);
	return v;
};
