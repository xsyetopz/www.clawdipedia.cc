// Live look at two 2.1.319 items that the fake key of the print and pty probes cannot reach.
// 1. cli319.upgrade-typeahead: type `/upg` (never Enter) and read the typeahead line of /upgrade.
// 2. cli319.attribution: `-p` runs behind the local proxy with attributionProject set in user settings. The proxy keeps only the
//    key names of the billing header in the first system block (cc_project, cc_project_src), and the two debug lines of the program.
import { join } from "node:path";

import { startMitm } from "../../lib/mitm.ts";
import type { Data } from "../../lib/results.ts";
import type { Sandbox } from "../../lib/sandbox.ts";
import { show } from "../print/run/helpers.ts";
import { READY, tolerant } from "../pty/harness.ts";
import {
	baseResult,
	type LiveCase,
	type LiveCtx,
	liveSandbox,
	obj,
	PROMPT,
	runLivePty,
	runPrint,
} from "./harness.ts";

/** Lines of a rendered screen that show a typeahead row for `name`: not the echoed input line. */
export const typeaheadLines = (screen: string, name: string): string[] =>
	screen
		.split("\n")
		.filter((l) => tolerant(`/${name}`).test(l) && !/^\s*[>❯]/u.test(l))
		.map((l) => l.trim().slice(0, 200));

/** Key names of the billing header, and the value of cc_project / cc_project_src. The first system block holds the header. */
export const headerOf = (
	body: unknown,
): { keys: string[]; project: string; src: string } => {
	const sys = obj(body)["system"];
	const first = Array.isArray(sys) ? obj(sys[0])["text"] : sys;
	const text = show(first ?? "");
	const line =
		text.split("\n").find((l) => l.startsWith("x-anthropic-billing-header:")) ??
		"";
	const pairs = line
		.replace("x-anthropic-billing-header:", "")
		.split(";")
		.map((p) => p.trim())
		.filter((p) => p !== "")
		.map((p) => [p.split("=")[0] ?? "", p.slice(p.indexOf("=") + 1)] as const);
	const get = (k: string) => pairs.find(([n]) => n === k)?.[1] ?? "";
	return {
		keys: pairs.map(([n]) => n),
		project: get("cc_project"),
		src: get("cc_project_src"),
	};
};

// 22 base58 characters after `01`; all `1` is the lowest value. No account has this Project.
const FAKE_PROJECT = `claude_proj_01${"1".repeat(22)}`;

const upgradeTypeahead: LiveCase = {
	id: "cli319.upgrade-typeahead",
	title: "/upgrade typeahead line with the real login (typed, never run)",
	requests: "no prompt; startup sends a few small requests",
	run: async (x) => {
		const sb = await liveSandbox();
		try {
			const pty = await runLivePty(x, sb, {
				schedule: [
					READY,
					{ t: 8, send: "/upg", label: "type-upg" },
					// clear the input so the exit step never turns it into a command
					{ t: 13, send: "\u0015", label: "clear" },
				],
				secs: 16,
			});
			const rows = typeaheadLines(pty.screen, "upgrade");
			const ready = /shortcuts|auto\s*mode|Claude Code/iu.test(pty.screen);
			return [
				baseResult(x, "cli319.upgrade-typeahead", {
					prompt: "",
					exit: pty.exit,
					data: {
						precondition: ready,
						...(ready ? {} : { "precondition.detail": "UI never started" }),
						typeaheadRows: rows.length,
						unknownCommand: tolerant("Unknown command").test(pty.screen),
					},
					samples: { rows: rows.join("\n") },
					facts: [],
					notes:
						"Typed `/upg` and cleared the input; Enter was never sent for it, so /upgrade did not run.",
				}),
			];
		} finally {
			await sb.cleanup();
		}
	},
};

const quiet = (x: LiveCtx) =>
	x.dry
		? {
				tunnelOthers: false,
				upstream: () =>
					new Response("{}", {
						status: 404,
						headers: { "content-type": "application/json" },
					}),
			}
		: {};

const debugLines = (dbg: string, value: string): string[] =>
	dbg
		.split("\n")
		.filter((l) => l.includes("Attribution Project"))
		.map((l) =>
			l
				.replace(/^\S+\s/u, "")
				.replace(value, "<value>")
				.slice(0, 200),
		);

const attrData = (
	seen: ReturnType<typeof headerOf>[],
	dbg: string,
	value: string,
): Record<string, Data> => {
	const a = seen.find((s) => s.keys.length > 0) ?? seen[0];
	return {
		precondition: a !== undefined,
		"live.requests": seen.length,
		"header.keys": a?.keys ?? [],
		"header.hasProject": (a?.project ?? "") !== "",
		"header.projectIsValue": a?.project === value,
		"header.src": a?.src ?? "",
		"debug.lines": debugLines(dbg, value),
	};
};

const attrRun = async (
	x: LiveCtx,
	value: string,
): Promise<{ data: Record<string, Data>; exit: number | null }> => {
	const sb: Sandbox = await liveSandbox();
	const seen: ReturnType<typeof headerOf>[] = [];
	const mitm = await startMitm({
		onMessages: (r) => {
			seen.push(headerOf(r.body));
		},
		...quiet(x),
	});
	try {
		const log = join(sb.cfg, "d.log");
		await Bun.write(
			join(sb.cfg, "settings.json"),
			JSON.stringify({
				permissions: { deny: ["Artifact"] },
				attributionProject: value,
			}),
		);
		const res = await runPrint(x, sb, ["-p", PROMPT, "--debug-file", log], {
			mitm,
		});
		const dbg = await Bun.file(log)
			.text()
			.catch(() => "");
		return { exit: res.code, data: attrData(seen, dbg, value) };
	} finally {
		await mitm.stop();
		await sb.cleanup();
	}
};

const prefixed = (p: string, d: Record<string, Data>) =>
	Object.fromEntries(
		Object.entries(d)
			.filter(([k]) => k !== "precondition")
			.map(([k, v]) => [`${p}.${k}`, v]),
	);

const attribution: LiveCase = {
	id: "cli319.attribution",
	title:
		"attributionProject in the billing header, good and bad value, real login",
	requests: "2 live",
	run: async (x) => {
		const good = await attrRun(x, FAKE_PROJECT);
		const bad = await attrRun(x, "foo_123");
		const pre =
			good.data["precondition"] === true && bad.data["precondition"] === true;
		return [
			baseResult(x, "cli319.attribution", {
				args: ["-p"],
				exit: good.exit,
				data: {
					precondition: pre,
					...prefixed("good", good.data),
					...prefixed("bad", bad.data),
				},
				facts: [],
				notes:
					"Real token behind a local proxy with a throw-away CA. attributionProject is set in user settings of a temp config dir. Kept: the key names of the billing header and the cc_project fields (a made-up Project ID that no account has), and the debug lines that start with Attribution Project. No other header, body text or child output is kept.",
			}),
		];
	},
};

export const cli319Cases: LiveCase[] = [upgradeTypeahead, attribution];
