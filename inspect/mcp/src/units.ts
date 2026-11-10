// The code units of one module: a top-level statement or a function, with the functions inside it cut out, so a change shows in one unit.
import { children, isFn, type Module, type Node } from "./ast.ts";
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

const keyName = (k: Node): string => {
	if (k.type === "Identifier") {
		return k.name;
	}
	return k.type === "Literal" &&
		(typeof k.value === "string" || typeof k.value === "number")
		? String(k.value)
		: "";
};

const fnLabel = (n: Node, p: Node | undefined): string => {
	if (p?.type === "Property" || p?.type === "MethodDefinition") {
		return keyName(p.key) || "fn";
	}
	if (p?.type === "VariableDeclarator" || p?.type === "AssignmentExpression") {
		return "fn";
	}
	return n.type === "FunctionDeclaration" ? "function" : "fn";
};

const labelOf = (m: Module, n: Node): string =>
	isFn(n) ? fnLabel(n, m.parent(n)) : n.type;

interface Span {
	start: number;
	end: number;
}
interface Open {
	n: Node;
	holes: Span[];
	f: Set<string>;
}

const fingerprint = (n: Node, here: Open): void => {
	if (n.type === "Literal") {
		if (typeof n.value === "string") {
			here.f.add(JSON.stringify(n.value.slice(0, 80)));
		}
	} else if (n.type === "TemplateElement" && (n.value.cooked ?? "") !== "") {
		here.f.add(JSON.stringify(n.value.cooked?.slice(0, 80)));
	} else if (
		(n.type === "MemberExpression" ||
			n.type === "Property" ||
			n.type === "MethodDefinition") &&
		!n.computed
	) {
		const k = n.type === "MemberExpression" ? n.property : n.key;
		if (k.type === "Identifier") {
			here.f.add(`.${k.name}`);
		}
	}
};

const slice = (
	{ n, holes }: Open,
	render: (from: number, to: number) => string,
): string => {
	let text = "";
	let at = n.start;
	for (const h of holes) {
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
			here = { n, holes: [], f: new Set() };
			cur?.holes.push(n);
			done.push(here);
		}
		fingerprint(n, here);
		for (const c of children(n)) {
			walk(c, here);
		}
	};
	for (const s of children(m.ast)) {
		walk(s);
	}
	return done.map((o) => ({
		m: name,
		s: o.n.start,
		e: o.n.end,
		k: labelOf(m, o.n),
		t: slice(o, render),
		h: "",
		f: [...o.f].toSorted(),
	}));
};
