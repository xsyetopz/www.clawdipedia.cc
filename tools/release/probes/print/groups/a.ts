// Print probe groups owned by chunk B2. index.ts runs these before groups/b.ts.
import { controlGroup } from "../control.ts";
import { env319a } from "../env319a.ts";
import { ptuGroup } from "../hooks/posttooluse.ts";
import { scriptGroup } from "../hooks/script.ts";
import { perfettoGroup } from "../perfetto.ts";
import { requestGroup } from "../request.ts";
import { sweepGroup } from "../sweep.ts";
import { transcriptsGroup } from "../transcripts.ts";
import type { PrintGroup } from "../types.ts";

// Named probes first (fast), then the sweep (long).
export const groupsA: PrintGroup[] = [
  requestGroup,
  controlGroup,
  ptuGroup,
  scriptGroup,
  perfettoGroup,
  transcriptsGroup,
  env319a,
  sweepGroup,
];
