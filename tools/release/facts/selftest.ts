// Fixture tests for facts and compare (run by `release:check --selftest`): no binary, no captures/, temp dirs only.
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runCompareChecks } from "./selftest/compare.ts";
import { runFactsChecks } from "./selftest/facts.ts";
import type { Step } from "./selftest/fixture.ts";
import { runResultsChecks } from "./selftest/results.ts";

export const runFactsSelftest = async (step: Step): Promise<void> => {
	const root = await mkdtemp(join(await realpath(tmpdir()), "ccrel-facts-"));
	try {
		await runFactsChecks(step, root);
		const { base, b } = await runCompareChecks(step, root);
		await runResultsChecks(step, root, base, b);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
};
