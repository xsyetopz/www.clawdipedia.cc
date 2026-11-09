// The list of system prompt variants to capture. Each one is one run of the binary against the local stub.
// The parts live in variants/, in the order the index and the pages list them.
import { AGENT_VARIANTS } from "./variants/agents.ts";
import type { Variant } from "./variants/base.ts";
import { COMMAND_VARIANTS } from "./variants/commands.ts";
import { CONTEXT_VARIANTS } from "./variants/context.ts";
import { DEFAULT_VARIANTS } from "./variants/default.ts";
import { HOOK_VARIANTS } from "./variants/hooks.ts";
import { MISC_VARIANTS } from "./variants/misc.ts";
import { STYLE_VARIANTS } from "./variants/style.ts";

export {
	LEAN_MODEL,
	type PromptGroup,
	SUB_MARK,
	type Variant,
} from "./variants/base.ts";

export const VARIANTS: Variant[] = [
	...DEFAULT_VARIANTS,
	...STYLE_VARIANTS,
	...CONTEXT_VARIANTS,
	...AGENT_VARIANTS,
	...COMMAND_VARIANTS,
	...HOOK_VARIANTS,
	...MISC_VARIANTS,
];
