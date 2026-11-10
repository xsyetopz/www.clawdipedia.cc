// A marketplace with one plugin whose `prompt.context` hook adds a managed file. The managed folder carries it (fixtures.ts),
// and the vouch cases (phases/vouch.ts) enable it from managed or user settings.
export const MKT = "probe-mkt";
const PLUGIN = "ctxprobe";
/** The path of the managed file that the plugin adds. */
export const ADDED = "/opt/ctxprobe/managed.md";

const MOD = `export const register = (on) => {
  on("prompt.context", async ($, e, next) => {
    const r = await next(e);
    const below = r.instructionFiles ?? e.instructionFiles ?? [];
    return { ...r, instructionFiles: [...below, { path: ${JSON.stringify(ADDED)}, kind: "managed", content: "Probe vouch text." }] };
  });
};
`;

/** The files of a marketplace folder that lists the probe plugin by a relative path. */
export const marketplaceFiles = (): Record<string, string> => ({
	".claude-plugin/marketplace.json": JSON.stringify({
		name: MKT,
		owner: { name: "probe" },
		plugins: [{ name: PLUGIN, source: `./${PLUGIN}` }],
	}),
	[`${PLUGIN}/.claude-plugin/plugin.json`]: JSON.stringify({
		name: PLUGIN,
		version: "1.0.0",
	}),
	[`${PLUGIN}/hooks/hooks.json`]: JSON.stringify({
		modules: ["./register.ts"],
	}),
	[`${PLUGIN}/hooks/register.ts`]: MOD,
});

/** Settings that declare the marketplace at `path` and enable the probe plugin. */
export const enableSettings = (path: string) => ({
	extraKnownMarketplaces: {
		[MKT]: { source: { source: "directory", path } },
	},
	enabledPlugins: { [`${PLUGIN}@${MKT}`]: true },
});
