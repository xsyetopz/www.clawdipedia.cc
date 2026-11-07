// The surface extractors by kind (design D1). The `surface` tool and tools/surface/snapshot.ts both use them.
// Run: bun inspect/mcp/src/surface/index.ts [--binary <version|path>] [--kind <kind>] [--names | --json]
import type { Bundle } from "../ast.ts";
import { extractBetas } from "./beta.ts";
import { extractFlags, extractSubcommands } from "./commander.ts";
import type { Extractor, SurfaceItem } from "./common.ts";
import { extractEndpoints } from "./endpoint.ts";
import { extractEnv } from "./env.ts";
import { extractErrors } from "./error.ts";
import { extractFiles } from "./file.ts";
import { extractGates } from "./gate.ts";
import { extractHookEvents } from "./hook-event.ts";
import { extractKeybindings } from "./keybinding.ts";
import { extractModApi } from "./mod-api.ts";
import { extractModels } from "./model.ts";
import { extractOtelEvents } from "./otel-event.ts";
import { extractPermissionRules } from "./permission-rule.ts";
import { extractSettingKeys, extractSettings } from "./setting.ts";
import { extractSlashCommands } from "./slash-command.ts";
import { extractTools } from "./tool.ts";

export type { SurfaceItem } from "./common.ts";

export const KINDS: Record<string, Extractor> = {
  env: extractEnv,
  "hook-event": extractHookEvents,
  flag: extractFlags,
  subcommand: extractSubcommands,
  "slash-command": extractSlashCommands,
  setting: extractSettings,
  "setting-key": extractSettingKeys,
  gate: extractGates,
  tool: extractTools,
  "otel-event": extractOtelEvents,
  "mod-api": extractModApi,
  keybinding: extractKeybindings,
  model: extractModels,
  beta: extractBetas,
  endpoint: extractEndpoints,
  file: extractFiles,
  "permission-rule": extractPermissionRules,
  error: extractErrors,
};

const cache = new WeakMap<Bundle, Map<string, SurfaceItem[]>>();

/** The items of one kind in a bundle, computed once per bundle. */
export const surface = (
  bundle: Bundle,
  kind: string,
  files?: Parameters<Extractor>[1],
): SurfaceItem[] => {
  const f = KINDS[kind];
  if (!f)
    throw new Error(
      `unknown kind "${kind}"; kinds: ${Object.keys(KINDS).join(", ")}`,
    );
  const byKind = cache.get(bundle) ?? new Map<string, SurfaceItem[]>();
  cache.set(bundle, byKind);
  const items = byKind.get(kind) ?? f(bundle, files);
  byKind.set(kind, items);
  return items;
};

if (import.meta.main) {
  const { parseArgs } = await import("node:util");
  const { program } = await import("../binary.ts");
  const { values: a } = parseArgs({
    options: {
      binary: { type: "string" },
      kind: { type: "string" },
      names: { type: "boolean" },
      json: { type: "boolean" },
    },
  });
  const { bundle, modules } = program(a.binary);
  for (const kind of a.kind ? [a.kind] : Object.keys(KINDS)) {
    const t = performance.now();
    const items = surface(bundle, kind, modules);
    if (a.names) console.log(items.map((i) => i.name).join("\n"));
    else if (a.json) console.log(JSON.stringify(items, null, 1));
    else
      console.error(
        `${kind}: ${items.length} items, ${Math.round(performance.now() - t)} ms`,
      );
  }
}
