// The first half of the extractors by kind. index.ts joins it with registry-b.ts into `KINDS`.
import { extractFlags, extractSubcommands } from "./commander.ts";
import type { Extractor } from "./common.ts";
import { extractEnv } from "./env.ts";
import { extractGates } from "./gate.ts";
import { extractHookEvents } from "./hook-event.ts";
import { extractSettingKeys, extractSettings } from "./setting.ts";
import { extractSlashCommands } from "./slash-command.ts";
import { extractTools } from "./tool.ts";

export const KINDS_A: Record<string, Extractor> = {
	env: extractEnv,
	"hook-event": extractHookEvents,
	flag: extractFlags,
	subcommand: extractSubcommands,
	"slash-command": extractSlashCommands,
	setting: extractSettings,
	"setting-key": extractSettingKeys,
	gate: extractGates,
	tool: extractTools,
};
