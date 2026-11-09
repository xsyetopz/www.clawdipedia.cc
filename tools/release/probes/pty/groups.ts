import { agentsGroup } from "./agents.ts";
import { capturesGroup } from "./captures.ts";
import { cli319Group } from "./cli319.ts";
import type { PtyGroup } from "./harness.ts";
import { hooksGroup } from "./hooks.ts";
import { notificationsGroup } from "./notifications.ts";
import { perfettoGroup } from "./perfetto.ts";
import { sizesGroup } from "./sizes.ts";
import { statuslineGroup } from "./statusline.ts";

export const GROUPS: PtyGroup[] = [
	hooksGroup,
	notificationsGroup,
	statuslineGroup,
	sizesGroup,
	agentsGroup,
	capturesGroup,
	perfettoGroup,
	cli319Group,
];
