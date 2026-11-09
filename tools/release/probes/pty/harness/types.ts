// Types shared by the pty harness: the case, the run it produces, and the group.
import type { PtyResult, PtyStep } from "../../../lib/pty/driver.ts";
import type { Data } from "../../../lib/results.ts";
import type { Files, Sandbox } from "../../../lib/sandbox.ts";
import type { LoggedRequest, StubCase } from "../../../lib/stub.ts";
import type { Obj } from "../../print/run/types.ts";

export { arr, type Obj, obj } from "../../print/run/types.ts";

export interface PtyCase {
	/** inside the group, e.g. "hooks.permissionrequest.allow". */
	id: string;
	/** cfg/settings.json ({HOME} {CFG} {PROJ} allowed). */
	settings?: Obj;
	cfgFiles?: Files;
	projFiles?: Files;
	homeFiles?: Files;
	git?: boolean;
	/** hook replies, written to hooklog/ctl before the run. */
	ctl?: Record<string, { out?: string; exit?: number }>;
	stub?: Omit<StubCase, "log">;
	/** after --permission-mode/--model. */
	args?: string[];
	/** --permission-mode, default "default". */
	mode?: string;
	/** default claude-opus-5-5. */
	model?: string;
	env?: Record<string, string>;
	/** fixed env keys that `env` may replace. */
	allowOverride?: string[];
	/** no API key in the child env. */
	auth?: "none";
	schedule: PtyStep[];
	secs: number;
	rows?: number;
	cols?: number;
	/** anything but PROMPT needs promptReason. */
	prompt?: string;
	promptReason?: string;
	facts?: string[];
	notes?: string;
	setup?: (sb: Sandbox) => Promise<void> | void;
	data: (x: PtyRun) => Record<string, Data>;
	samples?: (x: PtyRun) => Record<string, string>;
	/** extra files beside the JSON: <case>.<name>. */
	artifacts?: (x: PtyRun) => Record<string, string>;
	/** Timing cases: when the first data says "out of tolerance", run once more; disagreement marks the case flaky. */
	retryIf?: (data: Record<string, Data>) => boolean;
}

export interface PtyRun {
	pty: PtyResult;
	screen: string;
	reqs: LoggedRequest[];
	sb: Sandbox;
	hook: (event: string) => { t: number; json: Obj; line: string }[];
	/** read a file under the sandbox home ("" if missing). */
	file: (rel: string) => string;
	/** Every file under the sandbox root, by path relative to it, listed after the run. */
	tree: string[];
	/** read a file under the sandbox config dir ("" if missing). */
	cfgFile: (rel: string) => string;
	/** Every file under the sandbox home, read after the run, by path relative to home. */
	files: Record<string, string>;
	/** The RAW bytes of the run. */
	raw: Uint8Array;
	/** requests with a messages array. */
	messages: LoggedRequest[];
}

export interface PtyCtx {
	version: string;
	bin: string;
	runDir: string;
	only: string[] | null;
	dry: boolean;
}

export interface PtyGroup {
	id: string;
	title: string;
	/** Cases in run order. Each is built lazily so --dry costs nothing. */
	cases: (ctx: PtyCtx) => PtyCase[];
}
