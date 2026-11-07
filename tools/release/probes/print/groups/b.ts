// Print probe groups owned by chunk B3. index.ts (B2) concatenates this with groupsA.
import { api319 } from "../api319.ts";
import { automode } from "../automode.ts";
import { briefResume } from "../brief.ts";
import { cacerts319 } from "../cacerts319.ts";
import { cachetouch } from "../cachetouch.ts";
import { cli319 } from "../cli319.ts";
import { configmem } from "../configmem.ts";
import { dsc } from "../dsc.ts";
import { env319b } from "../env319b.ts";
import { err319 } from "../err319.ts";
import { evalcreds } from "../evalcreds.ts";
import { fork319 } from "../fork319.ts";
import { misc } from "../misc.ts";
import { models } from "../models.ts";
import { notes319 } from "../notes319.ts";
import { plugindata } from "../plugindata.ts";
import { subagents } from "../subagents.ts";
import type { PrintGroup } from "../types.ts";
import { workflow } from "../workflow.ts";

export const groupsB: PrintGroup[] = [
  automode,
  subagents,
  workflow,
  configmem,
  dsc,
  briefResume,
  cachetouch,
  models,
  misc,
  plugindata,
  api319,
  env319b,
  err319,
  cli319,
  evalcreds,
  fork319,
  notes319,
  cacerts319,
];
