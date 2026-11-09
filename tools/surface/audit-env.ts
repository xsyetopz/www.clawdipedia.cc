// The checks of environment variables: the sweep of the captures, and the places where the bundle reads a name.
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import { assertSafeEnv } from "../release/lib/env.ts";
import {
	allText,
	type Ctx,
	type Evidence,
	isStrings,
	reEscape,
	type Verdict,
} from "./audit-types.ts";

const listOf = (v: unknown): string[] | undefined =>
	isStrings(v) ? v : undefined;

/** What the sweep of the captures found for a variable: skipped, not swept, run errored, changed, or unchanged. */
export const sweepOf = (c: Ctx, name: string): Evidence & { state: string } => {
	const skipped = listOf(c.sweep["skipped"]) ?? [];
	const a = listOf(c.sweep[`${name}.A`]);
	const b = listOf(c.sweep[`${name}.B`]);
	if (skipped.includes(name)) {
		return { state: "skipped" };
	}
	if (a === undefined || b === undefined) {
		try {
			assertSafeEnv({ [name]: "1" });
		} catch {
			return { state: "skipped" };
		}
		return { state: "not swept" };
	}
	if ([...a, ...b].some((k) => k.startsWith("error:"))) {
		return { state: "run errored" };
	}
	return [...a, ...b].length > 0
		? { state: "changed", A: a, B: b }
		: { state: "unchanged" };
};

/** Where the bundle reads the variable by name: `.NAME`, `["NAME"]`, or `.get("NAME")`. A name inside a list or a registry is not a read. */
const envReadSites = (c: Ctx, name: string) => {
	const prefix = name.endsWith("*");
	const q = reEscape(prefix ? name.slice(0, -1) : name);
	const end = prefix ? "[A-Z0-9_]*" : String.raw`\b`;
	const re = new RegExp(
		`\\.${q}${end}(?!:)|\\[["'\`]${q}${end}["'\`]\\]|\\.get\\(["'\`]${q}${end}["'\`]\\)`,
		"gu",
	);
	const sites: string[] = [];
	for (const m of allText(c)) {
		if (!m.text.includes(q.replaceAll("\\", ""))) {
			continue;
		}
		for (const h of m.text.matchAll(re)) {
			sites.push(`${m.name}@${h.index}`);
		}
	}
	return sites;
};

/** The reason names the variable only in lists: no read by name, and no change in the sweep. */
export const envListed = (c: Ctx, i: SurfaceItem): Verdict => {
	const s = sweepOf(c, i.name);
	const reads = envReadSites(c, i.name);
	return {
		ok: reads.length === 0 && s.state !== "changed",
		evidence: { detail: i.detail ?? null, reads: reads.slice(0, 3), sweep: s },
	};
};

/** The reason says the program reads the variable but shows no effect: a read by name or a typed read, and no change in the sweep. */
export const envEffect = (c: Ctx, i: SurfaceItem): Verdict => {
	const s = sweepOf(c, i.name);
	const reads = envReadSites(c, i.name);
	return {
		ok:
			(reads.length > 0 || (i.detail !== "listed" && i.module !== null)) &&
			s.state !== "changed",
		evidence: { detail: i.detail ?? null, reads: reads.slice(0, 3), sweep: s },
	};
};
