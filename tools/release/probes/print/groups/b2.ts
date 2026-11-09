// Print probe groups owned by chunk B3, second half. groups/b.ts joins both halves.
import { api319 } from "../api319.ts";
import { cacerts319 } from "../cacerts319.ts";
import { cli319 } from "../cli319.ts";
import { env319b } from "../env319b.ts";
import { err319 } from "../err319.ts";
import { evalcreds } from "../evalcreds.ts";
import { fork319 } from "../fork319.ts";
import { notes319 } from "../notes319.ts";
import { plugindata } from "../plugindata.ts";
import type { PrintGroup } from "../types.ts";

export const groupsB2: PrintGroup[] = [
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
