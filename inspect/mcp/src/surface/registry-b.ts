// The second half of the extractors by kind. index.ts joins it with registry-a.ts into `KINDS`.
import { extractBetas } from "./beta.ts";
import type { Extractor } from "./common.ts";
import { extractEndpoints } from "./endpoint.ts";
import { extractErrors } from "./error.ts";
import { extractFiles } from "./file.ts";
import { extractKeybindings } from "./keybinding.ts";
import { extractModApi } from "./mod-api.ts";
import { extractModels } from "./model.ts";
import { extractOtelEvents } from "./otel-event.ts";
import { extractPermissionRules } from "./permission-rule.ts";

export const KINDS_B: Record<string, Extractor> = {
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
