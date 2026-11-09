import type { CaseResult, Data } from "../../../lib/results.ts";

const strs = (v: Data | undefined): string[] => (Array.isArray(v) ? v : []);

const skippedNames = (
	prev: Record<string, Data>,
	part: Record<string, Data>,
	names: string[],
): string[] =>
	[
		...new Set([
			...strs(prev["skipped"]).filter((n) => !names.includes(n)),
			...strs(part["skipped"]),
		]),
	].toSorted();

const sweptNames = (data: Record<string, Data>): Set<string> =>
	new Set(
		Object.keys(data)
			.filter((k) => /\.[AB]$/u.test(k) && k !== "noise.A" && k !== "noise.B")
			.map((k) => k.slice(0, -2)),
	);

/** A partial sweep over `names` replaces their entries in the full sweep `prev`; every other entry stays. */
export const mergeSweep = (
	prev: Pick<CaseResult, "data" | "samples">,
	part: Record<string, Data>,
	samples: Record<string, string>,
	names: string[],
): { data: Record<string, Data>; samples: Record<string, string> } => {
	const own = (k: string) => names.some((n) => k.startsWith(`${n}.`));
	const data: Record<string, Data> = Object.fromEntries(
		Object.entries(prev.data).filter(([k]) => !own(k)),
	);
	for (const [k, v] of Object.entries(part)) {
		if (own(k)) {
			data[k] = v;
		}
	}
	data["skipped"] = skippedNames(prev.data, part, names);
	const swept = sweptNames(data);
	data["names"] = swept.size;
	data["changed"] = [...swept].filter((n) =>
		[`${n}.A`, `${n}.B`].some((k) => strs(data[k]).length > 0),
	);
	data["errors"] = Object.keys(data).filter((k) =>
		strs(data[k]).some((x) => x.startsWith("error:")),
	);
	return {
		data,
		samples: {
			...Object.fromEntries(
				Object.entries(prev.samples ?? {}).filter(([k]) => !own(k)),
			),
			...samples,
		},
	};
};
