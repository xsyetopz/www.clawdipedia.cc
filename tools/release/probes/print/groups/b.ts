// Print probe groups owned by chunk B3. index.ts (B2) concatenates this with groupsA.
import type { PrintGroup } from "../types.ts";
import { groupsB1 } from "./b1.ts";
import { groupsB2 } from "./b2.ts";
import { groupsB3 } from "./b3.ts";

export const groupsB: PrintGroup[] = [...groupsB1, ...groupsB2, ...groupsB3];
