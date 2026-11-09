import type * as t from "@babel/types";

import { Module } from "./module.ts";
import type { Variable } from "./variables.ts";

const ROOT = "/$bunfs/root/";

/** The name an import specifier takes from its module. */
const importedName = (sp: t.ImportSpecifier): string =>
	sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;

/** The modules of one program, by file name (`chunk-abc.js`). */
export class Bundle {
	readonly modules = new Map<string, Module>();

	constructor(files: { name: string; text: string }[]) {
		for (const f of files) {
			const name = f.name.split("/").pop() ?? f.name;
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
		if (def?.type !== "ImportBinding") {
			return { module: m, variable: v };
		}
		if (
			seen > 8 ||
			def.node.type !== "ImportSpecifier" ||
			def.parent.type !== "ImportDeclaration"
		) {
			return undefined;
		}
		const from = this.get(def.parent.source.value);
		const local = from?.exports.get(importedName(def.node));
		const target = local === undefined ? undefined : from?.topLevel(local);
		return from && target ? this.origin(from, target, seen + 1) : undefined;
	}

	#importers?: Map<string, Module[]>;

	/** The modules whose text names the chunk `name` as `"/$bunfs/root/<name>"`, indexed on first use. */
	importersOf(name: string): Module[] {
		if (!this.#importers) {
			const index = new Map<string, Module[]>();
			const re = /"\/\$bunfs\/root\/([^"]+)"/gu;
			for (const m of this.modules.values()) {
				const chunks = new Set<string>();
				for (const x of m.text.matchAll(re)) {
					if (x[1] !== undefined) {
						chunks.add(x[1]);
					}
				}
				for (const n of chunks) {
					index.set(n, [...(index.get(n) ?? []), m]);
				}
			}
			this.#importers = index;
		}
		return this.#importers.get(name) ?? [];
	}

	/** The local variables in other modules that import the top-level `v` of `m`. */
	importers(m: Module, v: Variable): { module: Module; variable: Variable }[] {
		const names = [...m.exports]
			.filter(([, l]) => l === v.name)
			.map(([e]) => e);
		if (names.length === 0) {
			return [];
		}
		const out: { module: Module; variable: Variable }[] = [];
		for (const other of this.importersOf(m.name)) {
			if (other === m) {
				continue;
			}
			for (const s of other.importsFrom(ROOT + m.name)) {
				for (const sp of s.specifiers) {
					if (sp.type !== "ImportSpecifier") {
						continue;
					}
					if (!names.includes(importedName(sp))) {
						continue;
					}
					const local = other.topLevel(sp.local.name);
					if (local) {
						out.push({ module: other, variable: local });
					}
				}
			}
		}
		return out;
	}
}
