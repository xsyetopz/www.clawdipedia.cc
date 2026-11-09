// Read side of facts/map.json for probes: which fact ids does a probe case check? Keeps `facts: []` in a probe
// result and the map in one place. (facts.ts has the checks; this file stays light so probes can import it.)
import { join } from "node:path";

const isProbeMap = (v: unknown): v is Record<string, { probes: string[] }> =>
	typeof v === "object" && v !== null;

const data: unknown = await Bun.file(join(import.meta.dir, "map.json")).json();
if (!isProbeMap(data)) {
	throw new Error("facts/map.json is not an object");
}
// Read once at load so `factsForProbe` stays synchronous for the probe results.
const map = data;

/** Fact ids that map.json maps to this case id. */
export const factsForProbe = (caseId: string): string[] =>
	Object.entries(map)
		.filter(([, e]) => e.probes.includes(caseId))
		.map(([id]) => id);
