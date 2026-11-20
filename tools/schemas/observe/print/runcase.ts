// Runs the print-mode cases against the local stub and the local collector, one case at a time.
import { binaryPath } from "../../../release/lib/env.ts";
import { allocPort } from "../../../release/lib/ports.ts";
import { runChild } from "../../../release/lib/proc.ts";
import { startStub } from "../../../release/lib/stub.ts";
import { startHostMock } from "../../../release/lib/stub/host.ts";
import type { Case } from "./case.ts";
import { collectRun } from "./collect.ts";
import { startCollector } from "./collector.ts";
import { counts } from "./ingest.ts";
import {
	argsFor,
	envFor,
	keepCopy,
	pacedStdin,
	sandboxFor,
	seqOf
} from "./setup.ts";

/** Starts the stub and the collector; `run` does one case, `stop` closes both. `keep` names a dir that gets a copy of each sandbox. */
export const createRunner = async (version: string, keep?: string) => {
	const collectorPort = await allocPort();
	const collector = startCollector(collectorPort);
	const stub = await startStub(await allocPort());
	const bin = binaryPath(version);

	const run = async (c: Case): Promise<void> => {
		const sb = await sandboxFor(c);
		const log = `${sb.root}/requests.jsonl`;
		const base = await stub.register(c.id, {
			log,
			...(c.seq ? { seq: seqOf(c, sb) } : {}),
			...(c.respHeaders ? { respHeaders: c.respHeaders } : {}),
			...(c.turns ? { turns: c.turns } : {}),
			...(c.rules ? { rules: c.rules } : {}),
			...(c.countTokens === undefined ? {} : { countTokens: c.countTokens })
		});
		const mock =
			c.host === undefined
				? undefined
				: await startHostMock({ disposition: c.host });
		const env = await envFor(c, sb, base, collectorPort, mock?.env());
		const r = await runChild([bin, ...argsFor(c, sb)], {
			cwd: sb.proj,
			env,
			timeoutMs: c.timeoutMs ?? 90_000,
			...(c.stdin === undefined ? {} : { stdin: pacedStdin(c.stdin) })
		});
		stub.unregister(c.id);
		await mock?.stop();
		counts.runs++;
		console.info(c.id, "exit", r.code, r.timedOut ? "TIMEOUT" : "");
		await collectRun(sb.cfg);
		if (keep !== undefined) {
			await keepCopy(sb, r, `${keep}/${c.id}`);
		}
		await sb.cleanup();
	};

	const stop = async (): Promise<void> => {
		await stub.stop();
		await collector.stop(true);
	};

	return { run, stop };
};
