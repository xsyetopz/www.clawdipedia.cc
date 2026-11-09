// Offline checks of the live probe helpers and the pty live-token path.
import { chmod } from "node:fs/promises";
import { join } from "node:path";

import { artifactsPanelShown } from "../../../probes/live/artifacts.ts";
import { headerOf, typeaheadLines } from "../../../probes/live/cli319.ts";
import { pathExists } from "../../fs.ts";
import { runPty } from "../../pty/driver.ts";
import { DRY_TOKEN, liveEnv } from "../env.ts";

type Step = (name: string, ok: boolean, detail?: string) => void;

export const probeChecks = (step: Step): void => {
	const unknownScreen =
		"> /artifacts\n\n⏺ Unknown command: /artifacts\n\n/exit Exit the CLI\n/context Visualize current context usage\n";
	step(
		"artifacts probe: echoed command and Unknown command are not a panel",
		!artifactsPanelShown("> /artifacts\n") &&
			!artifactsPanelShown(unknownScreen) &&
			artifactsPanelShown("> /artifacts\n\n Artifacts\n No artifacts yet\n"),
	);
	const hdr = headerOf({
		system: [
			{
				text: "x-anthropic-billing-header: cc_version=1.a; cc_entrypoint=cli; cc_project=claude_proj_01X; cc_project_src=user;\nrest",
			},
		],
	});
	step(
		"attribution probe: header keys and project fields, no header text kept",
		hdr.keys.join(",") ===
			"cc_version,cc_entrypoint,cc_project,cc_project_src" &&
			hdr.project === "claude_proj_01X" &&
			hdr.src === "user" &&
			headerOf({ system: [{ text: "plain" }] }).keys.length === 0,
	);
	step(
		"upgrade typeahead probe: the echoed input line is not a row",
		typeaheadLines("> /upg\n  /upgrade  Upgrade your plan\n", "upgrade")
			.length === 1 && typeaheadLines("> /upg\n", "upgrade").length === 0,
	);
};

/** The live token reaches a pty child only with `liveToken`, and the env file is gone after the run. */
export const ptyChecks = async (step: Step, dir: string): Promise<void> => {
	const prog = join(dir, "prog.sh");
	await Bun.write(
		prog,
		"#!/bin/sh\nprintf 'tok=[%s]\\r\\n' \"$CLAUDE_CODE_OAUTH_TOKEN\"\nsleep 1\n",
	);
	await chmod(prog, 0o755);
	const ptyEnv = liveEnv({
		home: dir,
		configDir: dir,
		token: DRY_TOKEN,
		tty: true,
	});
	const out = join(dir, "RAW");
	let refused = false;
	try {
		await runPty({ cwd: dir, env: ptyEnv, bin: prog, secs: 3, out });
	} catch {
		refused = true;
	}
	const r = await runPty({
		cwd: dir,
		env: ptyEnv,
		bin: prog,
		secs: 3,
		out,
		liveToken: DRY_TOKEN,
	});
	step(
		"runPty: live token only with liveToken, env file removed",
		refused &&
			r.screen.includes(`tok=[${DRY_TOKEN}]`) &&
			!(await pathExists(`${out}.env.json`)),
	);
};
