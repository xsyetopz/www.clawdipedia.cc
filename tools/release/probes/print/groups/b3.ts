// Print probe groups owned by chunk B3, third part. groups/b.ts joins all parts.
import { cli321 } from "../cli321.ts";
import { cli322 } from "../cli322.ts";
import { modcontext } from "../modcontext.ts";
import type { PrintGroup } from "../types.ts";

export const groupsB3: PrintGroup[] = [cli321, cli322, modcontext];
