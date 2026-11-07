// Types shared by the pty harness: the case, the run it produces, and the group.
import type { PtyResult, PtyStep } from "../../../lib/pty/driver.ts";
import type { Data } from "../../../lib/results.ts";
import type { Files, Sandbox } from "../../../lib/sandbox.ts";
import type { LoggedRequest, StubCase } from "../../../lib/stub.ts";

export type Obj = Record<string, unknown>;
export const obj = (x: unknown): Obj =>
  x && typeof x === "object" && !Array.isArray(x) ? (x as Obj) : {};
export const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export type PtyCase = {
  id: string; // inside the group, e.g. "hooks.permissionrequest.allow"
  settings?: Obj; // cfg/settings.json ({HOME} {CFG} {PROJ} allowed)
  cfgFiles?: Files;
  projFiles?: Files;
  homeFiles?: Files;
  git?: boolean;
  ctl?: Record<string, { out?: string; exit?: number }>; // hook replies, written to hooklog/ctl before the run
  stub?: Omit<StubCase, "log">;
  args?: string[]; // after --permission-mode/--model
  mode?: string; // --permission-mode, default "default"
  model?: string; // default claude-opus-5-5
  env?: Record<string, string>;
  allowOverride?: string[]; // fixed env keys that `env` may replace
  auth?: "none"; // no API key in the child env
  schedule: PtyStep[];
  secs: number;
  rows?: number;
  cols?: number;
  prompt?: string; // anything but PROMPT needs promptReason
  promptReason?: string;
  facts?: string[];
  notes?: string;
  setup?: (sb: Sandbox) => void;
  data: (x: PtyRun) => Record<string, Data>;
  samples?: (x: PtyRun) => Record<string, string>;
  artifacts?: (x: PtyRun) => Record<string, string>; // extra files beside the JSON: <case>.<name>
  /** Timing cases: when the first data says "out of tolerance", run once more; disagreement marks the case flaky. */
  retryIf?: (data: Record<string, Data>) => boolean;
};

export type PtyRun = {
  pty: PtyResult;
  screen: string;
  reqs: LoggedRequest[];
  sb: Sandbox;
  hook: (event: string) => { t: number; json: Obj; line: string }[];
  file: (rel: string) => string; // read a file under the sandbox home ("" if missing)
  messages: LoggedRequest[]; // requests with a messages array
};

export type PtyCtx = {
  version: string;
  bin: string;
  runDir: string;
  only: string[] | null;
  dry: boolean;
};

export type PtyGroup = {
  id: string;
  title: string;
  /** Cases in run order. Each is built lazily so --dry costs nothing. */
  cases: (ctx: PtyCtx) => PtyCase[];
};
