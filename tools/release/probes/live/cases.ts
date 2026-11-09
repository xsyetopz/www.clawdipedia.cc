// The live case list, in plan order (cold-sensitive first, via planLive).
import { planLive } from "../../lib/cache.ts";
import { api319Cases } from "./api319.ts";
import { artifactsCase } from "./artifacts.ts";
import { cli319Cases } from "./cli319.ts";
import { codeModeCase } from "./code-mode.ts";
import { contextBudget } from "./context-budget.ts";
import { err319Live } from "./err319.ts";
import type { LiveCase } from "./harness.ts";
import { oauthParity } from "./oauth-parity.ts";
import { usageCases } from "./usage.ts";

export const LIVE_CASES: LiveCase[] = planLive([
	oauthParity,
	...usageCases,
	...api319Cases,
	artifactsCase,
	contextBudget,
	err319Live,
	...cli319Cases,
	codeModeCase,
]);

/** --only: exact id, prefix on dotted segments (usage matches usage.429), with or without the `live.` prefix. */
export const pick = (only: string[] | null): LiveCase[] =>
	LIVE_CASES.filter(
		(c) =>
			only === null ||
			only.some((raw) => {
				const o = raw.replace(/^live\./u, "");
				return c.id === o || c.id.startsWith(`${o}.`);
			}),
	);
