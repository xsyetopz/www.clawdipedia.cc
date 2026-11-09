import type { Files, Sandbox } from "../../../lib/sandbox.ts";
// Types and tiny guards shared by the print case runner.
import type { LoggedRequest } from "../../../lib/stub.ts";

export type Obj = Record<string, unknown>;
export const isObj = (x: unknown): x is Obj =>
	typeof x === "object" && x !== null && !Array.isArray(x);
export const obj = (x: unknown): Obj => (isObj(x) ? x : {});
export const arr = (x: unknown): unknown[] => (Array.isArray(x) ? x : []);

export type Seq = { name: string; input: unknown }[];
export const isSeq = (x: unknown): x is Seq =>
	Array.isArray(x) && x.every((e) => isObj(e) && typeof e["name"] === "string");

export interface Case {
	// Anything but PROMPT needs promptReason.
	prompt?: string;
	promptReason?: string;
	// After the fixed -p/--output-format/--model part; {HOME} {CFG} {PROJ} {MEMORY_MCP} {BASE} allowed.
	args?: string[];
	// Variable under test.
	env?: Record<string, string>;
	cfgFiles?: Files;
	projFiles?: Files;
	homeFiles?: Files;
	git?: boolean;
	tool?: string;
	toolInput?: unknown;
	seq?: Seq;
	text?: string;
	stdin?: string;
	// Keep stdin open this long after `stdin` is written.
	stdinOpenMs?: number;
	// No -p prompt (stream-json input or control requests).
	noPrompt?: boolean;
	// Replaces the whole argument list after the binary.
	argv?: string[];
	timeoutMs?: number;
	respHeaders?: Record<string, string>;
	// Default claude-opus-5-5.
	model?: string;
	// Git init plus one commit in the project dir.
	commit?: boolean;
	// After fixture files, before the run.
	setup?: (sb: Sandbox) => Promise<void> | void;
	// No API key in the child env.
	auth?: "none";
	// Fixed env keys that `env` may replace.
	allowOverride?: string[];
	// Credential-named env vars set to a sentinel (see lib/env.ts).
	fakeCredentials?: string[];
	// Read state after exit, before leftover children are killed.
	afterExit?: (
		sb: Sandbox,
	) => Promise<Record<string, unknown>> | Record<string, unknown>;
	// Run in this subfolder of the project dir (created before the run).
	cwdSub?: string;
	// Stub: server-side auto mode verdict for each tool call.
	safeguard?: "flagged" | "not_flagged";
	// Stub: HTTP 400 for the dangerous-tool-use beta.
	refuseServerCheck?: boolean;
	// Stub: self-hosted runner API with these spawn hints.
	orchestrator?: {
		secret: string;
		hints: Record<string, unknown>[];
		assignment?: string;
		refuseRemote?: boolean;
	};
	// Stub: the Nth messages request gets the prompt-is-too-long 400.
	tooLongOn?: number;
	// Stub: wait between SSE events.
	gapMs?: number;
	// Stub: split a text block into this many deltas.
	deltas?: number;
}

export interface Run {
	stdout: string;
	stderr: string;
	code: number | null;
	timedOut: boolean;
	reqs: LoggedRequest[];
	sb: Sandbox;
	prompt: string;
	promptReason?: string;
	args: string[];
	envSet: string[];
	after: Record<string, unknown>;
}
