// The program marks a managed file that a mod adds "not verified" unless it vouches for the mod,
// and it vouches for a plugin that trusted managed settings enable from a marketplace that they declare (chunk-bs3kcdf7.js@17287).
import {
	ADDED,
	enableSettings,
	marketplaceFiles,
	MKT,
} from "../marketplace.ts";
import { type Def, userCfg } from "./util.ts";

const label = (name: string, c: Def["c"]): Def => ({
	name,
	c,
	data: (r, x) => {
		// mainText is the request body as JSON, so its line breaks are the two characters `\n`.
		const line =
			x.mainText.split(String.raw`\n`).find((l) => l.includes(ADDED)) ?? null;
		return {
			data: {
				mod_ran: line !== null,
				not_verified: line?.includes("not verified") ?? false,
				label: line,
			},
			samples: { stderr: r.stderr.trim().slice(0, 600) },
		};
	},
});

/** The control: user settings enable the plugin from a marketplace in the home folder, which the program does not vouch for. */
export const vouchUserDef: Def = label("mod-vouch-user", {
	homeFiles: Object.fromEntries(
		Object.entries(marketplaceFiles()).map(([k, v]) => [`${MKT}/${k}`, v]),
	),
	cfgFiles: { "settings.json": userCfg(enableSettings(`{HOME}/${MKT}`)) },
});

/** Managed settings of the `vouch` variant enable the plugin from the marketplace in the managed folder. */
export const vouchManagedDef: Def = label("mod-vouch-managed", {});
