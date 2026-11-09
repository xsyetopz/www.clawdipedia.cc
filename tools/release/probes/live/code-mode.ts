// Live look at CLAUDE_CODE_EXPERIMENTAL_CODE_MODE (2.1.319, chunk-f0e5mbbe.js@3460). The gate needs the cli entrypoint, a
// firstParty login and the server flag tengu_rustling_blossom (payload or override). A fake key cannot reach the payload.
// The sandbox sets the variable to "on" in user settings, accepts both caveats, keeps telemetry on so the program fetches
// its feature values, sends the prompt, and then reads the flag value the program cached from the live payload.
import { join } from "node:path";

import type { Data } from "../../lib/results.ts";
import type { Sandbox } from "../../lib/sandbox.ts";
import { show } from "../print/run/helpers.ts";
import { READY } from "../pty/harness.ts";
import {
	baseResult,
	type LiveCase,
	liveSandbox,
	obj,
	PROMPT,
	runLivePty,
} from "./harness.ts";

const ID = "code-mode";
const FLAG = "tengu_rustling_blossom";

const readJson = async (file: string): Promise<Record<string, unknown>> =>
	obj(JSON.parse(await Bun.file(file).text()));

const seed = async (sb: Sandbox, cj: string): Promise<void> => {
	await Bun.write(
		join(sb.cfg, "settings.json"),
		JSON.stringify({
			permissions: { deny: ["Artifact"] },
			env: { CLAUDE_CODE_EXPERIMENTAL_CODE_MODE: "on" },
		}),
	);
	await Bun.write(
		cj,
		JSON.stringify({
			...(await readJson(cj)),
			codeModeCaveatsAcceptedV1: true,
			codeModeAutoModeCaveatAcceptedV1: true,
		}),
	);
};

const codeData = (
	screen: string,
	cache: Record<string, unknown>,
	log: string,
): Record<string, Data> => ({
	precondition: screen.includes("OK"),
	flagName: FLAG,
	flagCached: FLAG in cache,
	flagValue: FLAG in cache ? show(cache[FLAG]) : "absent",
	cachedFlagCount: Object.keys(cache).length,
	cachedTenguFlags: Object.keys(cache).filter((k) => k.startsWith("tengu_"))
		.length,
	cachedBlossomNames: Object.keys(cache).filter((k) => k.includes("blossom")),
	debugLines: log
		.split("\n")
		.filter((l) => /code.?mode|repl_mode|rustling|REPL tool/iu.test(l))
		.slice(0, 20)
		.map((l) => l.slice(0, 200)),
	screenMentionsReplOrCodeMode: /code mode|REPL tool/iu.test(screen),
});

export const codeModeCase: LiveCase = {
	id: ID,
	title: "EXPERIMENTAL_CODE_MODE gate with the real login",
	requests: "1 live",
	run: async (x) => {
		const sb = await liveSandbox();
		try {
			const cj = join(sb.cfg, ".claude.json");
			await seed(sb, cj);
			const dbg = join(sb.root, "debug.log");
			const pty = await runLivePty(x, sb, {
				schedule: [READY, { t: 3, send: `${PROMPT}\r`, label: "prompt" }],
				secs: 40,
				featureGates: true,
				args: ["--debug-file", dbg],
			});
			const saved = await readJson(cj);
			const cache = obj(saved["cachedGrowthBookFeatures"]);
			const log = await Bun.file(dbg)
				.text()
				.catch(() => "");
			return [
				baseResult(x, ID, {
					exit: pty.exit,
					data: codeData(pty.screen, cache, log),
					samples: { screenTail: pty.screen.split("\n").slice(-25).join("\n") },
					notes:
						"User settings env sets CLAUDE_CODE_EXPERIMENTAL_CODE_MODE=on; both caveats are accepted in .claude.json; telemetry stays on so the live feature payload is fetched. flagValue is the cached live value.",
				}),
			];
		} finally {
			await sb.cleanup();
		}
	},
};
