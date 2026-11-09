// The code units of one module: a top-level statement or a function, with the functions inside it cut out, so a change shows in one unit.
import type * as t from "@babel/types";

import {
	children,
	isFn,
	isMethod,
	type Module,
	type Node,
	valueStart,
} from "./ast.ts";
import { renamer } from "./clean.ts";

export interface Unit {
	/** module file name, as in the binary (`chunk-abc.js`) */
	m: string;
	/** start and end offset in the module's original text */
	s: number;
	e: number;
	/** a label: the property, method, or variable name that holds it, or the statement type */
	k: string;
	/** the cleaned text with inner functions cut out (`ƒ`) */
	t: string;
	/** hash of `t` */
	h: string;
	/** fingerprint: sorted string literals (quoted) and property names (after a dot) */
	f: string[];
}

const keyName = (k: t.Node | null | undefined): string => {
	if (k?.type === "Identifier") {
		return k.name;
	}
	return k?.type === "StringLiteral" || k?.type === "NumericLiteral"
		? String(k.value)
		: "";
};

const fnLabel = (n: Node, p: Node | undefined): string => {
	if (isMethod(n)) {
		return keyName(n.key) || "fn";
	}
	if (p?.type === "ObjectProperty") {
		return keyName(p.key) || "fn";
	}
	if (p?.type === "VariableDeclarator" || p?.type === "AssignmentExpression") {
		return "fn";
	}
	return n.type === "FunctionDeclaration" ? "function" : "fn";
};

const labelOf = (m: Module, n: Node): string => {
	if (isFn(n)) {
		return fnLabel(n, m.parent(n));
	}
	return n.type === "Directive" ? "ExpressionStatement" : n.type;
};

interface Span {
	start: number;
	end: number;
}
interface Open {
	n: Node;
	start: number;
	holes: Span[];
	f: Set<string>;
}

const fingerprint = (n: Node, here: Open, cur: Open | undefined): void => {
	if (n.type === "StringLiteral" || n.type === "DirectiveLiteral") {
		here.f.add(JSON.stringify(n.value.slice(0, 80)));
	} else if (n.type === "TemplateElement" && (n.value.cooked ?? "") !== "") {
		here.f.add(JSON.stringify(n.value.cooked?.slice(0, 80)));
	} else if (
		(n.type === "MemberExpression" ||
			n.type === "ObjectProperty" ||
			isMethod(n)) &&
		!n.computed
	) {
		const k = n.type === "MemberExpression" ? n.property : n.key;
		if (k.type === "Identifier") {
			(isMethod(n) ? cur : here)?.f.add(`.${k.name}`);
		}
	}
};

const slice = (
	{ n, start, holes }: Open,
	render: (from: number, to: number) => string,
): string => {
	let text = "";
	let at = start;
	// A function in a method key is found after the method, though it comes first in the text.
	for (const h of holes.toSorted((a, b) => a.start - b.start)) {
		text += `${render(at, h.start)}ƒ`;
		at = h.end;
	}
	return text + render(at, n.end);
};

/** The units of one module, before chunk names are made stable. */
export const unitsOf = (
	name: string,
	m: Module,
	render = renamer(m),
): Unit[] => {
	const done: Open[] = [];
	const walk = (n: Node, cur?: Open): void => {
		let here = cur;
		if (here === undefined || isFn(n)) {
			// A method's unit starts at its parameters, so the key stays in the unit around it.
			const start = isMethod(n) ? valueStart(m.text, n) : n.start;
			here = { n, start, holes: [], f: new Set() };
			cur?.holes.push({ start, end: n.end });
			done.push(here);
		}
		fingerprint(n, here, cur);
		for (const c of children(n)) {
			walk(c, isMethod(n) && c === n.key ? cur : here);
		}
	};
	for (const s of children(m.ast)) {
		walk(s);
	}
	return done.map((o) => ({
		m: name,
		s: o.start,
		e: o.n.end,
		k: labelOf(m, o.n),
		t: slice(o, render),
		h: "",
		f: [...o.f].toSorted(),
	}));
};
