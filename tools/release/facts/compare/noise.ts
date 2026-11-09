import type { Data } from "../../lib/results.ts";
import { same } from "./data.ts";

/**
 * Known noise by case id: data that differ between two runs of the SAME version, so they are not release changes.
 * `data` matches whole data names and drops them. `items` removes those array elements from the data that
 * `itemData` matches, then drops the data when the two sides are then equal. With `values`, a `data` match is
 * noise only when both sides are in that list, so a value outside the range seen across reruns still shows.
 * With `unordered`, a `data` match is noise only when the two arrays hold the same items.
 * Ignored data is listed under "Noise (ignored)" in compare.md, never dropped silently.
 */
interface Noisy {
	why: string;
	data?: RegExp;
	values?: Data[];
	unordered?: boolean;
	itemData?: RegExp;
	items?: string[];
}
const MCP_ORDER: Noisy[] = [
	{
		why: "the servers start in parallel, so their order varies from run to run (seen on 2.1.306 to 2.1.308)",
		data: /^started$/u,
		unordered: true,
	},
];

export const NOISY: Record<string, Noisy[]> = {
	"managed.baseline.mcp-config-flag": MCP_ORDER,
	"managed.main.mcp-config-flag": MCP_ORDER,
	"print.subagents.observer.on": [
		{
			why: "the background observer sends 3 or 5 requests from run to run (seen on 2.1.306 to 2.1.308)",
			data: /^(observerReportToolIn|observerMessageIn)$/u,
			values: [3, 5],
		},
		{
			why: "the request count follows the observer's 3 or 5 requests",
			data: /^messages$/u,
			values: [10, 12],
		},
	],
	"print.sweep": [
		{
			why: "with Mantle on, the run times out before any stub request, so its stderr varies from run to run",
			itemData: /^CLAUDE_CODE_USE_MANTLE\.[AB]$/u,
			items: ["stderr", "cfgfiles"],
		},
		{
			why: "API_TIMEOUT_MS sets a tiny timeout, so the retry count depends on machine load",
			data: /^API_TIMEOUT_MS\.[AB]$/u,
		},
		{
			why: "cfgfiles flips for a random name on each run",
			itemData: /\.[AB]$/u,
			items: ["cfgfiles"],
		},
		{
			why: "list derived from the NAME.A and NAME.B data, which is compared on their own",
			data: /^changed$/u,
		},
	],
};

/** `old` with every `from` replaced by `to` equals `now`: the only change is the version string. */
const versionOnly = (old: Data, now: Data, v?: [string, string]): boolean =>
	v !== undefined &&
	JSON.stringify(old).includes(v[0]) &&
	JSON.stringify(old).replaceAll(v[0], v[1]) === JSON.stringify(now);

const inRange = (n: Noisy, f: Data): boolean =>
	n.values?.some((x) => same(x, f)) ?? true;

const sorted = (f: Data): string =>
	JSON.stringify(Array.isArray(f) ? [...f].toSorted() : f);

const withoutItems = (a: Data[], items: string[]): string =>
	JSON.stringify(a.filter((x) => !items.includes(String(x))));

/** The reason this rule gives, null when it rules the change a real one, undefined when it does not apply. */
const ruleReason = (
	n: Noisy,
	k: string,
	old: Data,
	now: Data,
): string | null | undefined => {
	const dataHit = n.data?.test(k) === true;
	if (n.unordered === true && dataHit) {
		return sorted(old) === sorted(now) ? n.why : null;
	}
	if (dataHit && inRange(n, old) && inRange(n, now)) {
		return n.why;
	}
	const { items } = n;
	if (
		n.itemData?.test(k) === true &&
		items !== undefined &&
		Array.isArray(old) &&
		Array.isArray(now) &&
		withoutItems(old, items) === withoutItems(now, items)
	) {
		return n.why;
	}
	return undefined;
};

/** Why a changed data is not a release change, or null. */
export const noiseReason = (
	id: string | undefined,
	k: string,
	old: Data,
	now: Data,
	v?: [string, string],
): string | null => {
	if (versionOnly(old, now, v)) {
		return "version string only";
	}
	for (const n of (id === undefined ? undefined : NOISY[id]) ?? []) {
		const reason = ruleReason(n, k, old, now);
		if (reason !== undefined) {
			return reason;
		}
	}
	return null;
};
