// Case runner shared by print probes; the parts live in run/*.
import type { Run } from "./run/types.ts";

export { events, msgs, toolResults } from "./run/events.ts";
export { runCase } from "./run/exec.ts";
export { listFiles, pathExists, readIf } from "./run/files.ts";
export { stopStub } from "./run/stub.ts";
export { baseResult, oneCase, requestSummary, selected } from "./run/result.ts";
export {
	arr,
	type Case,
	type Obj,
	obj,
	type Run,
	type Seq,
} from "./run/types.ts";

export const dispose = async (r: Run): Promise<void> => {
	await r.sb.cleanup();
};
