import { mapSeq } from "../seq.ts";
// A module parses when a reader first asks for it, and the bundle keeps it. Parsing a whole program at
// once holds several GB of syntax trees.
import { Module } from "./module.ts";
import type { NodeOf } from "./node.ts";
import type { Variable } from "./variables.ts";

const ROOT = "/$bunfs/root/";

/** The name an import specifier takes from its module. */
const importedName = (sp: NodeOf<"ImportSpecifier">): string =>
	sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;

// One import specifier of a module: its place among the imports of the same source module, in bundle order.
interface Import {
	at: number;
	module: Module;
	local: string;
}

/** The modules of one program, by file name (`chunk-abc.js`). Each module parses on first use. */
export class Bundle {
	/** The text of each file, by file name, in bundle order. */
	readonly texts = new Map<string, string>();
	readonly #parsed = new Map<string, Promise<Module | undefined>>();

	constructor(files: { name: string; text: string }[]) {
		for (const f of files) {
			this.texts.set(f.name.split("/").pop() ?? f.name, f.text);
		}
	}

	/** The parsed module of a file name or `/$bunfs/root/` path. Undefined when there is none, or when its text is not JavaScript. */
	get(name: string): Promise<Module | undefined> {
		const key = name.startsWith(ROOT) ? name.slice(ROOT.length) : name;
		let parsed = this.#parsed.get(key);
		if (!parsed) {
			parsed = this.#parse(key);
			this.#parsed.set(key, parsed);
		}
		return parsed;
	}

	/**
	 * Lets go of each parsed module; a module parses again on its next use. Call it only when no reader
	 * holds a module, node, or variable of this bundle: one from before the call does not match one from after it.
	 */
	release(): void {
		this.#parsed.clear();
		this.#imports.clear();
	}

	async #parse(name: string): Promise<Module | undefined> {
		const text = this.texts.get(name);
		if (text === undefined) {
			return undefined;
		}
		try {
			return await Module.parse(name, text, this);
		} catch (error) {
			if (error instanceof SyntaxError) {
				return undefined;
			}
			throw error;
		}
	}

	/** The file names whose text names `needle`, in bundle order. */
	namesWith(needles: string[]): string[] {
		return [...this.texts]
			.filter(([, t]) => needles.some((s) => t.includes(s)))
			.map(([n]) => n);
	}

	/** The parsed modules whose text names `needle`, in bundle order. */
	async withText(needle: string): Promise<Module[]> {
		const found = await mapSeq(this.namesWith([needle]), (n) => this.get(n));
		return found.filter((m) => m !== undefined);
	}

	/**
	 * Where an imported binding comes from: the module that exports it and that module's variable.
	 * It follows re-exports. Undefined for anything else.
	 */
	async origin(
		m: Module,
		v: Variable,
		seen = 0,
	): Promise<{ module: Module; variable: Variable } | undefined> {
		const def = v.defs[0];
		if (def?.type !== "ImportBinding") {
			return { module: m, variable: v };
		}
		if (seen > 8 || def.node.type !== "ImportSpecifier") {
			return undefined;
		}
		const from = await this.get(def.parent.source.value);
		const local = from?.exports.get(importedName(def.node));
		const target = local === undefined ? undefined : from?.topLevel(local);
		return from && target ? this.origin(from, target, seen + 1) : undefined;
	}

	#importers?: Map<string, string[]>;

	/** The file names whose text names the chunk `name` as `"/$bunfs/root/<name>"`, indexed on first use. */
	importersOf(name: string): string[] {
		if (!this.#importers) {
			const index = new Map<string, string[]>();
			const re = /"\/\$bunfs\/root\/([^"]+)"/gu;
			for (const [file, text] of this.texts) {
				const chunks = new Set<string>();
				for (const x of text.matchAll(re)) {
					if (x[1] !== undefined) {
						chunks.add(x[1]);
					}
				}
				for (const n of chunks) {
					const files = index.get(n) ?? [];
					files.push(file);
					index.set(n, files);
				}
			}
			this.#importers = index;
		}
		return this.#importers.get(name) ?? [];
	}

	readonly #imports = new Map<Module, Promise<Map<string, Import[]>>>();

	// Each import of a name from `m` in the other modules, by that name. A resolver asks for the importers
	// of many variables of one module, and a shared chunk has thousands of importers.
	async #importsOf(m: Module): Promise<Map<string, Import[]>> {
		const others = await mapSeq(
			this.importersOf(m.name).filter((n) => n !== m.name),
			(n) => this.get(n),
		);
		const out = new Map<string, Import[]>();
		let at = 0;
		for (const module of others.filter((x) => x !== undefined)) {
			for (const s of module.importsFrom(ROOT + m.name)) {
				for (const sp of s.specifiers) {
					if (sp.type === "ImportSpecifier") {
						const found = out.get(importedName(sp)) ?? [];
						found.push({ at, module, local: sp.local.name });
						out.set(importedName(sp), found);
						at += 1;
					}
				}
			}
		}
		return out;
	}

	/** The local variables in other modules that import the top-level `v` of `m`. Empty when `v` is not top-level. */
	async importers(
		m: Module,
		v: Variable,
	): Promise<{ module: Module; variable: Variable }[]> {
		const names = m.topLevel(v.name) === v ? m.exportedAs(v.name) : [];
		if (names.length === 0) {
			return [];
		}
		const imports = this.#imports.get(m) ?? this.#importsOf(m);
		this.#imports.set(m, imports);
		const byName = await imports;
		return names
			.flatMap((n) => byName.get(n) ?? [])
			.toSorted((a, b) => a.at - b.at)
			.flatMap(({ module, local }) => {
				const variable = module.topLevel(local);
				return variable ? [{ module, variable }] : [];
			});
	}
}
