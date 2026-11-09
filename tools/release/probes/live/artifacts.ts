// Live /artifacts panel, read-only: open the panel, read the screen, press Esc. Ports the open step of p305-lv
// s_art2.json / s_art3.json. The later steps there (d, y, r: delete, confirm, rename) are NOT ported: they change the
// account. The old publishing run is dropped too: the Artifact tool really publishes. Every live sandbox also
// denies the Artifact tool in settings as a safety net.
import { READY, tolerant } from "../pty/harness.ts";
import {
	baseResult,
	type LiveCase,
	liveSandbox,
	runLivePty,
} from "./harness.ts";

const ID = "artifacts";

/** The panel is open only when "Artifacts" shows outside the echoed `/artifacts` input line and the program did not answer
 * "Unknown command". The echo alone contains the word, so it must not count. */
export const artifactsPanelShown = (screen: string): boolean => {
	if (tolerant("Unknown command").test(screen)) {
		return false;
	}
	const rest = screen
		.split("\n")
		.filter((l) => !/\/artifacts/iu.test(l))
		.join("\n");
	return tolerant("Artifacts").test(rest);
};

export const artifactsCase: LiveCase = {
	id: ID,
	title: "/artifacts panel (open, read, Esc; read-only)",
	requests: "no prompt; startup sends a few small requests",
	run: async (x) => {
		const sb = await liveSandbox();
		try {
			const pty = await runLivePty(x, sb, {
				schedule: [
					READY,
					{ t: 10, send: "/artifacts\r", label: "artifacts" },
					{ t: 17, send: "\u001B", label: "esc" },
				],
				secs: 20,
			});
			const s = pty.screen;
			const ready = /shortcuts|auto\s*mode|Claude Code/iu.test(s);
			const shows = (p: string): boolean => tolerant(p).test(s);
			return [
				baseResult(x, ID, {
					prompt: "",
					exit: pty.exit,
					data: {
						precondition: ready,
						...(ready ? {} : { "precondition.detail": "UI never started" }),
						panelShown: artifactsPanelShown(s),
						showsPublished: shows("Published"),
						showsNone: shows("No artifacts"),
						showsFailed: shows("Failed to load"),
					},
					samples: { screenTail: s.split("\n").slice(-30).join("\n") },
					facts: [],
					notes:
						"No prompt is sent (prompt is empty): /artifacts is a local command and only the panel is read. Matching tolerates dropped letters in the rendered screen. URLs and ids are scrubbed from the sample.",
				}),
			];
		} finally {
			await sb.cleanup();
		}
	},
};
