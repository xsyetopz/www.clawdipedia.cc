import type { Module, Node } from "../ast.ts";
import { asNode } from "../ast/node.ts";
import type { Entry } from "./types.ts";

// Steps a program-wide write lookup may take: a write such as `x.usage=u` where `u=f(u,...)` repeats
// can open a search that does not end in practice, so such a write counts as one that does not resolve.
const WRITE_STEPS = 20_000;

/** The node at `at` when it is the property of a member expression that a plain `=` writes. */
const writtenValue = (mod: Module, at: number): Node | undefined => {
	const prop = mod.nodeAt(at);
	const member = mod.parent(prop);
	const write = member && mod.parent(member);
	if (
		member?.type !== "MemberExpression" ||
		member.property !== prop ||
		write?.type !== "AssignmentExpression" ||
		write.operator !== "=" ||
		write.left !== member
	) {
		return undefined;
	}
	return asNode(write.right);
};

/** The value at `at` when it is the key of a `{key:value}` property in an object literal. */
const literalValue = (
	mod: Module,
	at: number,
	name: string,
): Node | undefined => {
	const key = mod.nodeAt(at);
	const prop = mod.parent(key);
	return prop?.type === "ObjectProperty" &&
		prop.key === key &&
		key.type === "Identifier" &&
		key.name === name &&
		!prop.computed &&
		mod.parent(prop)?.type === "ObjectExpression"
		? asNode(prop.value)
		: undefined;
};

/**
 * The value of each `x.key=value` in the program, with its module, and when there is one, the value of
 * each `{key:value}` literal too: a name an object literal builds with a scalar value must not take the
 * object type of an unrelated `.key=` write.
 */
export const propertyWrites = (
	m: Module,
	key: string,
): { mod: Module; value: Node }[] => {
	const out: { mod: Module; value: Node }[] = [];
	for (const [needle, skip, find] of [
		[`.${key}=`, 1, writtenValue],
		[`${key}:`, 0, literalValue],
	] as const) {
		for (const mod of m.bundle?.withText(needle) ?? [m]) {
			for (
				let at = mod.text.indexOf(needle);
				at !== -1;
				at = mod.text.indexOf(needle, at + 1)
			) {
				const value = find(mod, at + skip, key);
				if (value) {
					out.push({ mod, value });
				}
			}
		}
		if (out.length === 0) {
			return out;
		}
	}
	return out;
};

/** The entries of `o.key` from every write of `.key`, kept per key, with a step limit per lookup. */
export class Writes {
	readonly #byKey = new Map<string, Entry[] | undefined>();
	#steps: number | undefined;

	/** Takes one step; false when the lookup in progress has used all of its steps. */
	step(): boolean {
		return this.#steps === undefined || --this.#steps >= 0;
	}

	/**
	 * The merged entries of each write of `.key`. One write that does not resolve makes the whole read
	 * unknown, so a common name with unrelated writes stays unknown.
	 */
	entries(
		m: Module,
		key: string,
		read: (mod: Module, value: Node) => Entry[] | undefined,
		merge: (lists: Entry[][]) => Entry[],
	): Entry[] | undefined {
		if (this.#byKey.has(key)) {
			return this.#byKey.get(key);
		}
		this.#byKey.set(key, undefined);
		const outer = this.#steps;
		this.#steps ??= WRITE_STEPS;
		try {
			const lists: Entry[][] = [];
			for (const w of propertyWrites(m, key)) {
				const got = read(w.mod, w.value);
				if (!got) {
					return undefined;
				}
				lists.push(got);
			}
			if (this.#steps < 0) {
				return undefined;
			}
			const out = lists.length > 0 ? merge(lists) : undefined;
			this.#byKey.set(key, out);
			return out;
		} finally {
			if (outer === undefined) {
				this.#steps = undefined;
			}
		}
	}
}
