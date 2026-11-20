import type { Source } from "./relocate.ts";

const LITERAL = /"[^"\\\n]{20,}"/gu;

/** Maps an old module to the new module that shares the most long string literals with it, once for each old module. */
export const moduleMapper = (
	oldByName: Map<string, Source>,
	newSources: Source[]
): ((chunk: string) => Source | undefined) => {
	const literals = newSources.map((source) => ({
		source,
		literals: new Set(source.text.match(LITERAL))
	}));
	const mapped = new Map<string, Source | undefined>();
	return (chunk) => {
		if (!mapped.has(chunk)) {
			const old = new Set(oldByName.get(chunk)?.text.match(LITERAL));
			const [best] = literals
				.map((n) => ({
					source: n.source,
					shared: [...old].filter((l) => n.literals.has(l)).length
				}))
				.toSorted((a, b) => b.shared - a.shared);
			mapped.set(chunk, best && best.shared > 0 ? best.source : undefined);
		}
		return mapped.get(chunk);
	};
};
