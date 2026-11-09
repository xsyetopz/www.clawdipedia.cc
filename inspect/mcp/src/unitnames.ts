// The module-level names of a prepared install (`prepare.ts`): what each holds, and how chunks import them.

import type { Index, Unit } from "./prepare.ts";

const encloses = (top: Unit | undefined, u: Unit) =>
	top !== undefined && top.m === u.m && top.s <= u.s && u.e <= top.e;

/** The enclosing unit of each unit. Units come in source order, a parent before its children. */
export const parentsOf = (us: Unit[]) => {
	const p = new Int32Array(us.length).fill(-1);
	const stack: number[] = [];
	for (const [i, u] of us.entries()) {
		while (stack.length > 0 && !encloses(us[stack.at(-1) ?? -1], u)) {
			stack.pop();
		}
		p[i] = stack.at(-1) ?? -1;
		stack.push(i);
	}
	return p;
};

export const NAME = /\$[0-9a-f]{6}(?:_\d+)?/gu;

/** Adds `v` to the list under `k`. */
export const addTo = <K, V>(map: Map<K, V[]>, k: K, v: V): void => {
	const list = map.get(k);
	if (list) {
		list.push(v);
	} else {
		map.set(k, [v]);
	}
};

const multi = <K, V>(pairs: Iterable<[K, V]>) => {
	const r = new Map<K, V[]>();
	for (const [k, v] of pairs) {
		addTo(r, k, v);
	}
	return r;
};

interface Tables {
	val: Map<string, string>;
	fn: Map<string, Unit>;
	exp: Map<string, string>;
	imp: Map<string, string>;
}

const scanExport = (ix: Index, u: Unit, t: Tables): void => {
	if (u.t.includes("from")) {
		return;
	}
	for (const [, h = "", name = ""] of u.t.matchAll(
		/(\$[0-9a-f]{6}(?:_\d+)?) as ([\w$]+)/gu,
	)) {
		t.exp.set(`${ix.chunks[u.m] ?? u.m}|${name}`, `${u.m}|${h}`);
	}
};

const scanImport = (u: Unit, t: Tables): void => {
	const from = /from"\/\$bunfs\/root\/([^"]+)"/u.exec(u.t)?.[1];
	if (from === undefined) {
		return;
	}
	for (const [, name = "", h = ""] of u.t.matchAll(
		/([\w$]+) as (\$[0-9a-f]{6}(?:_\d+)?)/gu,
	)) {
		t.imp.set(`${u.m}|${h}`, `${from}|${name}`);
	}
};

const scanUnit = (ix: Index, u: Unit, t: Tables): void => {
	if (u.k === "VariableDeclaration") {
		for (const [, h = "", v = ""] of u.t.matchAll(
			/(\$[0-9a-f]{6}(?:_\d+)?)="((?:[^"\\]|\\.)*)"/gu,
		)) {
			t.val.set(`${u.m}|${h}`, v);
		}
	} else if (u.k === "function") {
		const h = /^(?:async )?function\*? ?(\$[0-9a-f]{6}(?:_\d+)?)\(/u.exec(
			u.t,
		)?.[1];
		if (h !== undefined) {
			t.fn.set(`${u.m}|${h}`, u);
		}
	} else if (u.k === "ExportNamedDeclaration") {
		scanExport(ix, u, t);
	} else if (u.k === "ImportDeclaration") {
		scanImport(u, t);
	}
};

/** What a module-level name holds, a string or a function, followed through one import and export across chunks. */
export const namesOf = (ix: Index) => {
	const t: Tables = {
		val: new Map(),
		fn: new Map(),
		exp: new Map(),
		imp: new Map(),
	};
	for (const u of ix.units) {
		scanUnit(ix, u, t);
	}
	const { val, fn, exp, imp } = t;
	const key = (m: string, h: string) => {
		const k = `${m}|${h}`;
		return val.has(k) || fn.has(k) ? k : (exp.get(imp.get(k) ?? "") ?? "");
	};
	const exported = multi([...exp].map(([x, k]) => [k, x]));
	const imported = multi([...imp].map(([k, x]) => [x, k]));
	const byValue = multi([...val].map(([k, v]) => [v, k]));
	/** `module|name` and the `module|local` names that import it. */
	const aliases = (k: string) => [
		k,
		...(exported.get(k) ?? []).flatMap((x) => imported.get(x) ?? []),
	];
	return {
		constant: (m: string, h: string) => val.get(key(m, h)),
		fn: (m: string, h: string) => fn.get(key(m, h)),
		aliases,
		/** the module-level names that hold the string `v`, with their aliases */
		holding: (v: string) => (byValue.get(v) ?? []).flatMap((k) => aliases(k)),
	};
};
