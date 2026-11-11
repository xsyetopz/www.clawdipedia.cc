// The surface extractors by kind (design D1). The `surface` tool and tools/surface/snapshot.ts both use them.
// Run: bun inspect/mcp/src/surface/index.ts [--binary <version|path>] [--kind <kind>] [--names | --json]
import type { Bundle } from "../ast.ts";
import { mapSeq } from "../seq.ts";
import type { Extractor, SurfaceItem } from "./common.ts";
import { KINDS_A } from "./registry-a.ts";
import { KINDS_B } from "./registry-b.ts";

export type { SurfaceItem } from "./common.ts";

export const KINDS: Record<string, Extractor> = { ...KINDS_A, ...KINDS_B };

const cache = new WeakMap<Bundle, Map<string, Promise<SurfaceItem[]>>>();

const run = async (
	f: Extractor,
	bundle: Bundle,
	files: Parameters<Extractor>[1],
): Promise<SurfaceItem[]> => {
	const items = await f(bundle, files);
	return items;
};

/**
 * The items of one kind in a bundle, computed once per bundle: a call that comes while the kind runs waits
 * for that run. A run that throws is not kept. Async, because `mod-api` reads a compressed file.
 */
export const surface = async (
	bundle: Bundle,
	kind: string,
	files?: Parameters<Extractor>[1],
): Promise<SurfaceItem[]> => {
	const f = KINDS[kind];
	if (!f) {
		throw new Error(
			`unknown kind "${kind}"; kinds: ${Object.keys(KINDS).join(", ")}`,
		);
	}
	const byKind = cache.get(bundle) ?? new Map<string, Promise<SurfaceItem[]>>();
	cache.set(bundle, byKind);
	const items = byKind.get(kind) ?? run(f, bundle, files);
	byKind.set(kind, items);
	try {
		return await items;
	} catch (error) {
		if (byKind.get(kind) === items) {
			byKind.delete(kind);
		}
		throw error;
	}
};

if (import.meta.main) {
	const { parseArgs } = await import("node:util");
	const { program } = await import("../binary.ts");
	const { values: a } = parseArgs({
		options: {
			binary: { type: "string" },
			kind: { type: "string" },
			names: { type: "boolean" },
			json: { type: "boolean" },
		},
	});
	const p = await program(a.binary);
	const bundle = p.bundle();
	const kinds =
		a.kind === undefined || a.kind === "" ? Object.keys(KINDS) : [a.kind];
	// One kind after the other: kinds that run at once hold the garbage of each at once, and share the time.
	const runs = await mapSeq(kinds, async (kind) => {
		const t = performance.now();
		const items = await surface(bundle, kind, p.modules);
		return { kind, items, ms: Math.round(performance.now() - t) };
	});
	for (const { kind, items, ms } of runs) {
		if (a.names === true) {
			console.info(items.map((i) => i.name).join("\n"));
		} else if (a.json === true) {
			console.info(JSON.stringify(items, null, 1));
		} else {
			console.error(`${kind}: ${items.length} items, ${ms} ms`);
		}
	}
}
