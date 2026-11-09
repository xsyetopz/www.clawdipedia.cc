// Design D9 of release-2-1-309-full-surface: when a plugin `bin/` program runs from the Bash tool, is
// CLAUDE_PLUGIN_DATA set? Decides which cache folder the clawdipedia CLI uses there.
import { chmod, mkdir } from "node:fs/promises";

import {
	baseResult,
	dispose,
	oneCase,
	readIf,
	runCase,
	toolResults,
} from "./run.ts";
import type { PrintGroup } from "./types.ts";

const ID = "print.plugindata.bash-bin";
// Writes the two plugin variables of its own environment to the file named by $1.
const PROBE = `#!/bin/sh
printf 'CLAUDE_PLUGIN_DATA=%s\\nCLAUDE_PLUGIN_ROOT=%s\\n' "\${CLAUDE_PLUGIN_DATA-<unset>}" "\${CLAUDE_PLUGIN_ROOT-<unset>}" > "$1"
`;

/** The value of NAME in a NAME=value file, or null when the file or the line is missing. */
const value = (text: string, name: string): string | null =>
	new RegExp(`^${name}=(.*)$`, "mu").exec(text)?.[1] ?? null;

export const plugindata: PrintGroup = {
	id: "plugindata",
	title: "CLAUDE_PLUGIN_DATA for a plugin bin/ program run from Bash",
	run: (ctx) =>
		oneCase(ctx, ID, async () => {
			const r = await runCase(ctx.bin, {
				tool: "Bash",
				toolInput: {
					command:
						"cc-probe {CFG}/by-name.log; {HOME}/plug/bin/cc-probe {CFG}/by-path.log; " +
						`printf 'CLAUDE_PLUGIN_DATA=%s\\n' "\${CLAUDE_PLUGIN_DATA-<unset>}" > {CFG}/bash.log`,
				},
				args: ["--plugin-dir", "{HOME}/plug", "--allowedTools", "Bash"],
				setup: async ({ home }) => {
					const pl = `${home}/plug`;
					await mkdir(`${pl}/.claude-plugin`, { recursive: true });
					await mkdir(`${pl}/bin`, { recursive: true });
					await Bun.write(
						`${pl}/.claude-plugin/plugin.json`,
						JSON.stringify({ name: "pdprobe", version: "1.0.0" }),
					);
					await Bun.write(`${pl}/bin/cc-probe`, PROBE);
					await chmod(`${pl}/bin/cc-probe`, 0o755);
				},
			});
			try {
				const byName = await readIf(`${r.sb.cfg}/by-name.log`);
				const byPath = await readIf(`${r.sb.cfg}/by-path.log`);
				const bash = await readIf(`${r.sb.cfg}/bash.log`);
				const data = value(byPath, "CLAUDE_PLUGIN_DATA");
				return baseResult(ctx, ID, r, {
					data: {
						precondition: r.code === 0 && toolResults(r) >= 1 && byPath !== "",
						"bin.onPath": byName !== "",
						"bin.pluginDataSet": data !== null && data !== "<unset>",
						"bin.pluginRootSet":
							(value(byPath, "CLAUDE_PLUGIN_ROOT") ?? "<unset>") !== "<unset>",
						"bash.pluginDataSet":
							(value(bash, "CLAUDE_PLUGIN_DATA") ?? "<unset>") !== "<unset>",
					},
					samples: { byName, byPath, bash },
				});
			} finally {
				await dispose(r);
			}
		}),
};
