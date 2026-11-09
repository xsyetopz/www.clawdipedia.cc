// Shared contract for print probes (task 1.3, chunks B2 and B3).
// index.ts (B2) runs groups from groups/a.ts (B2) and groups/b.ts (B3).
import type { CaseResult } from "../../lib/results.ts";

export interface PrintCtx {
	// Claude Code version under test.
	version: string;
	// Path to the binary.
	bin: string;
	// From openRun(); write results with writeCase(runDir, r).
	runDir: string;
	// Case or group ids to run; undefined = all.
	only?: string[];
	// List cases, spawn nothing.
	dry: boolean;
}

export interface PrintGroup {
	// ^[A-Za-z0-9][A-Za-z0-9._-]*$, used as the case id prefix.
	id: string;
	title: string;
	run: (ctx: PrintCtx) => Promise<CaseResult[]>;
}
