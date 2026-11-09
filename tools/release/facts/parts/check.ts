// release:facts --check - the known probe case ids and the map.json checks.
import { readdir } from "node:fs/promises";

import { pathExists } from "../../lib/fs.ts";
import { readRun } from "../../lib/results.ts";
import { LIVE_CASES } from "../../probes/live/cases.ts";
import { CAPTURES } from "../../util.ts";
import type { Fact, FactMap } from "../types.ts";
import { KINDS } from "./kinds.ts";

export interface Known {
	ids: Set<string>;
	/** case id -> `facts` the result files declare */
	facts: Map<string, Set<string>>;
	/** false when no result files exist: print, pty and managed ids cannot be checked then */
	fromDisk: boolean;
}

/**
 * Case ids that exist: result files under captures/* plus the live registry (a static list). The print, pty and
 * managed registries build their cases by running, so for those a result file is the cheap source.
 */
export const knownCases = async (base = CAPTURES): Promise<Known> => {
	const k: Known = {
		ids: new Set(LIVE_CASES.map((c) => `live.${c.id}`)),
		facts: new Map(),
		fromDisk: false,
	};
	if (!(await pathExists(base))) {
		return k;
	}
	// oldest first, so a case's newest capture sets its facts; older ones hold ids since renamed
	const entries = await readdir(base);
	const versions = entries
		.filter((n) => /^\d+\.\d+\.\d+$/u.test(n))
		.toSorted((a, b) => a.localeCompare(b, undefined, { numeric: true }));
	const runs = await Promise.all(versions.map((v) => readRun(v, base)));
	for (const r of runs.flat()) {
		k.fromDisk = true;
		k.ids.add(r.id);
		k.facts.set(r.id, new Set(r.facts));
	}
	return k;
};

export interface Check {
	errors: string[];
	warnings: string[];
}

const checkMap = (
	map: FactMap,
	live: Set<string>,
	known: Known,
	out: Check,
): Set<string> => {
	const used = new Set<string>();
	for (const [id, e] of Object.entries(map)) {
		if (!KINDS.some((k) => k === e.kind)) {
			out.errors.push(`map.json: unknown kind "${e.kind}" for ${id}`);
		}
		if (!live.has(id)) {
			out.warnings.push(`map.json entry has no fact: ${id}`);
		}
		for (const p of e.probes) {
			used.add(p);
			if (!known.ids.has(p) && (known.fromDisk || p.startsWith("live."))) {
				out.warnings.push(
					`map.json probe not found in any result: ${p} (${id})`,
				);
			}
			if (known.facts.get(p)?.has(id) === false) {
				out.warnings.push(`probe ${p} does not list fact ${id} in its facts`);
			}
		}
	}
	return used;
};

// probe-declared facts: ids (they contain `#`) must be current facts that map.json maps back to the case
const checkDeclared = (
	map: FactMap,
	live: Set<string>,
	known: Known,
	out: Check,
): void => {
	for (const [caseId, set] of known.facts) {
		for (const c of [...set].filter((s) => s.includes("#"))) {
			if (!live.has(c)) {
				out.warnings.push(
					`probe ${caseId} lists a fact id that no longer exists: ${c}`,
				);
			} else if (map[c]?.probes.includes(caseId) !== true) {
				out.warnings.push(
					`probe ${caseId} lists ${c}, but map.json does not map it to this probe`,
				);
			}
		}
	}
};

export const checkFacts = (
	facts: Fact[],
	map: FactMap,
	known: Known,
	all: Fact[] = facts,
): Check => {
	const out: Check = { errors: [], warnings: [] };
	for (const c of facts) {
		if (c.status === "unmapped") {
			out.errors.push(`unmapped: ${c.id} (${c.file}:${c.line})`);
		}
	}
	if (!known.fromDisk) {
		out.warnings.push(
			"no result files in captures/: only live.* probe ids are checked (from the live registry)",
		);
	}
	const live = new Set(all.map((c) => c.id));
	const used = checkMap(map, live, known, out);
	checkDeclared(map, live, known, out);
	const unused = [...known.ids].filter((p) => !used.has(p));
	if (unused.length > 0) {
		out.warnings.push(
			`${unused.length} probe case(s) no fact uses${unused.length > 8 ? ` (first 8: ${unused.slice(0, 8).join(", ")})` : `: ${unused.join(", ")}`}`,
		);
	}
	return out;
};
