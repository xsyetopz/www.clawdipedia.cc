// The shape of one print-mode case.
import type { HostDisposition } from "../../../release/lib/stub/host.ts";
import type { StubReply, StubRule } from "../../../release/lib/stub/types.ts";

/** One print-mode run: its arguments, files, environment, and the scripted stub answers. */
export interface Case {
	id: string;
	args?: string[];
	env?: Record<string, string>;
	seq?: { name: string; input: unknown }[];
	cfgFiles?: Record<string, string>;
	projFiles?: Record<string, string>;
	git?: boolean;
	/** With `git`: commit the project files once, so the repository has a HEAD. */
	commit?: boolean;
	prompt?: string;
	/** Points the API base URL at a closed port: connection errors. */
	deadBase?: boolean;
	/** Sets no API key, so the program reads a made-up login file from cfgFiles instead. Never a real credential. */
	noKey?: boolean;
	/** Headers the stub adds to each reply. */
	respHeaders?: Record<string, string>;
	/** Scripted stub answers by tool-result count (see StubCase.turns). */
	turns?: (StubReply | null)[];
	/** Scripted stub answers by last-message text (see StubCase.rules). */
	rules?: StubRule[];
	/** The input_tokens count_tokens answers (see StubCase.countTokens). */
	countTokens?: number;
	/** Keys merged into the sandbox .claude.json, such as cached feature flags. */
	claudeJson?: Record<string, unknown>;
	/** Stops the run after this many ms (default 90000), for a run that does not end by itself. */
	timeoutMs?: number;
	/** Starts the tool host mock (tools/release/lib/stub/host.ts), which answers each remote tool call with this disposition; `{SDK_URL}` in args is its session URL. */
	host?: HostDisposition;
	/** Stream-JSON input lines, and a number to wait that many ms: the run reads them from stdin instead of a prompt. */
	stdin?: (object | number)[];
}
