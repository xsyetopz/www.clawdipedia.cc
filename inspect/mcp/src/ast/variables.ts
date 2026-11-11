// Scope analysis of one module: where each name is declared and where it is read or written (eslint-scope).
import {
	analyze,
	type Definition,
	type Reference,
	type Scope,
	type Variable as Declared,
} from "eslint-scope";

import { asNode, type Node, type NodeOf } from "./node.ts";

/** Where a name is declared: the declarator, function, class, specifier, or catch clause. */
export type Def = {
	/** The identifier that declares the name. */
	name: Node;
} & (
	| {
			type: "Variable";
			node: NodeOf<"VariableDeclarator">;
			parent: NodeOf<"VariableDeclaration">;
	  }
	| {
			type: "ImportBinding";
			node: Node;
			parent: NodeOf<"ImportDeclaration">;
	  }
	| {
			type: "Parameter" | "FunctionName" | "ClassName" | "CatchClause";
			node: Node;
			parent: null;
	  }
);
/** A read or a write of a name; `init` marks the write that comes with the declaration. */
export interface Ref {
	identifier: Node;
	write: boolean;
	init: boolean;
	writeExpr: Node | null;
}
/**
 * The scope that declares a name; two variables of one scope share one object. `depth` is 0 for the
 * module scope, and for another scope it counts that scope and each scope around it inside the module scope.
 * It stands for the scope of eslint-scope, which holds the whole scope tree of the module in memory.
 */
export interface VarScope {
	depth: number;
}
export interface Variable {
	name: string;
	/** The scope that declares the name. */
	scope: VarScope;
	defs: Def[];
	identifiers: Node[];
	references: Ref[];
}
/** The variables of one module. */
export interface Variables {
	/** Each declared variable, by every identifier that declares or uses it. */
	byId: Map<Node, Variable>;
	/** The module-scope variables, by name. */
	top: Map<string, Variable>;
	/** The identifiers that read a name the module does not declare. */
	globals: Set<Node>;
}

// eslint-scope types its input as `estree`; the oxc tree has that shape.
const isEstree = (n: unknown): n is Parameters<typeof analyze>[0] =>
	asNode(n)?.type === "Program";

const defOf = (d: Definition): Def | undefined => {
	const name = asNode(d.name);
	const node = asNode(d.node);
	const parent = asNode(d.parent);
	if (!name || !node || d.type === "ImplicitGlobalVariable") {
		return undefined;
	}
	if (d.type === "Variable") {
		return node.type === "VariableDeclarator" &&
			parent?.type === "VariableDeclaration"
			? { type: d.type, name, node, parent }
			: undefined;
	}
	if (d.type === "ImportBinding") {
		return parent?.type === "ImportDeclaration"
			? { type: d.type, name, node, parent }
			: undefined;
	}
	return { type: d.type, name, node, parent: null };
};

const refOf = (r: Reference): Ref | undefined => {
	const identifier = asNode(r.identifier);
	return (
		identifier && {
			identifier,
			write: r.isWrite(),
			init: r.init === true,
			writeExpr: asNode(r.writeExpr) ?? null,
		}
	);
};

// `class A {}` declares `A` in the scope around it and again in the class scope, on one node.
const outerOf = (d: Declared, s: Scope): Declared | undefined => {
	const id = d.identifiers[0];
	const o = s.type === "class" ? s.upper?.set.get(d.name) : undefined;
	return id !== undefined && o?.identifiers.includes(id) === true
		? o
		: undefined;
};

const depthOf = (s: Scope): number => {
	let d = 0;
	for (
		let x: Scope | null = s;
		x && x.type !== "module" && x.type !== "global";
		x = x.upper
	) {
		d++;
	}
	return d;
};

const variableOf = (
	d: Declared,
	s: Scope,
	scope: VarScope,
	made: Map<Declared, Variable>,
): Variable => {
	const outer = outerOf(d, s);
	const v = (outer && made.get(outer)) ?? {
		name: d.name,
		scope,
		defs: d.defs.flatMap((x) => defOf(x) ?? []),
		identifiers: d.identifiers.flatMap((x) => asNode(x) ?? []),
		references: [],
	};
	made.set(d, v);
	// A name with a default and a value gets two writes on one identifier; the value comes first.
	v.references.push(
		...d.references.toReversed().flatMap((r) => refOf(r) ?? []),
	);
	return v;
};

/** Analyzes the scopes of a module's tree. A class declaration's name is one variable, inside the class and outside. */
export const variablesOf = (ast: unknown): Variables => {
	const out: Variables = {
		byId: new Map(),
		top: new Map(),
		globals: new Set(),
	};
	if (!isEstree(ast)) {
		return out;
	}
	const made = new Map<Declared, Variable>();
	// `optimistic` keeps each name on its declaration in a scope that calls `eval`.
	const options = {
		ecmaVersion: 2026,
		sourceType: "module",
		optimistic: true,
	} as const;
	for (const s of analyze(ast, options).scopes) {
		const scope = { depth: depthOf(s) };
		for (const d of s.variables.filter((x) => x.defs.length > 0)) {
			const v = variableOf(d, s, scope, made);
			if (s.type === "module") {
				out.top.set(v.name, v);
			}
		}
		for (const r of s.references) {
			const id = asNode(r.identifier);
			if (id && r.isRead() && (r.resolved?.defs.length ?? 0) === 0) {
				out.globals.add(id);
			}
		}
	}
	for (const v of new Set(made.values())) {
		v.references.sort((a, b) => a.identifier.start - b.identifier.start);
		for (const id of v.identifiers) {
			out.byId.set(id, v);
		}
		for (const r of v.references) {
			out.byId.set(r.identifier, v);
		}
	}
	return out;
};
