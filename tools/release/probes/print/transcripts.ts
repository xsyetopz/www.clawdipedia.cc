// Transcript (.jsonl) line types, keys, attachment types and api-request params (ported from p305-print/tr.ts, tr2.ts).
import { join } from "node:path";

import type { Data } from "../../lib/results.ts";
import {
	baseResult,
	type Case,
	dispose,
	listFiles,
	obj,
	oneCase,
	readIf,
	type Run,
	runCase,
} from "./run.ts";
import { eachInOrder } from "./run/seq.ts";
import { baselineB } from "./sig.ts";
import type { PrintGroup } from "./types.ts";

const STREAM = [
	"-p",
	"--input-format",
	"stream-json",
	"--output-format",
	"stream-json",
	"--verbose",
	"--model",
	"claude-opus-5-5",
];
const userLine = JSON.stringify({
	type: "user",
	message: { role: "user", content: "Reply with 'OK'." },
});
const twoTurns = (n: number): Case => ({
	noPrompt: true,
	argv: STREAM,
	stdin: `${Array.from({ length: n }, () => userLine).join("\n")}\n`,
});
const STYLE = "---\nname: st\ndescription: s\n---\nStyle.";
const TOP_LINES = new Set([
	"ai-title",
	"mode",
	"permission-mode",
	"last-prompt",
	"file-history-snapshot",
]);

/** Parsed lines of every transcript file under the sandbox config dir. */
const transcript = async (r: Run): Promise<Record<string, unknown>[]> => {
	const all = await listFiles(r.sb.cfg);
	const files = all.filter(
		(f) => f.startsWith("projects") && f.endsWith(".jsonl"),
	);
	const texts = await Promise.all(files.map((f) => readIf(join(r.sb.cfg, f))));
	return texts.flatMap((text) =>
		text
			.split("\n")
			.filter(Boolean)
			.map((l) => obj(JSON.parse(l))),
	);
};

const attKinds = (j: Record<string, unknown>): string[] => {
	const t = String(j["type"]);
	const sub = j["subtype"];
	const kinds: string[] = [];
	if (t === "attachment") {
		kinds.push(String(obj(j["attachment"])["type"]));
	}
	if (t === "user" && Boolean(j["isMeta"])) {
		kinds.push("isMeta-user");
	}
	if (t === "user" && Boolean(j["origin"])) {
		kinds.push("user.origin");
	}
	if (t === "assistant" && Boolean(j["advisorModel"])) {
		kinds.push("advisorModel");
	}
	if (t === "system" && Boolean(sub)) {
		kinds.push(`sys:${String(sub)}`);
	}
	if (TOP_LINES.has(t)) {
		kinds.push(`line:${t}`);
	}
	return kinds;
};

const attTypes = async (r: Run): Promise<string[]> => {
	const s = new Set<string>();
	for (const j of await transcript(r)) {
		for (const k of attKinds(j)) {
			s.add(k);
		}
	}
	return [...s].toSorted();
};

interface Acc {
	keysByType: Map<string, Set<string>>;
	att: Set<string>;
	params: Set<string>;
	baseKeys: Set<string>;
	betas: string[];
	lineCount: number;
	first: Run | null;
	allOk: boolean;
}

const absorb = (acc: Acc, j: Record<string, unknown>): void => {
	acc.lineCount += 1;
	const t = String(j["type"]);
	const set = acc.keysByType.get(t) ?? new Set<string>();
	for (const k of Object.keys(j)) {
		set.add(k);
	}
	acc.keysByType.set(t, set);
	if (t === "attachment") {
		acc.att.add(String(obj(j["attachment"])["type"]));
	}
	if (t === "api-request") {
		const p = obj(j["params"]);
		for (const k of Object.keys(p)) {
			acc.params.add(k);
		}
		for (const k of Object.keys(obj(j["base"]))) {
			acc.baseKeys.add(k);
		}
		const betas = p["betas"];
		if (Array.isArray(betas)) {
			acc.betas = betas.map(String);
		}
	}
};

const linesCases = (): Case[] => {
	const b = baselineB();
	return [
		{
			...b,
			projFiles: {
				"CLAUDE.md": "top memory",
				"sub/CLAUDE.md": "nested memory",
				"sub/f.txt": "x\n",
			},
			cfgFiles: { ...b.cfgFiles, "output-styles/st.md": STYLE },
			seq: [
				{ name: "Read", input: { file_path: "{PROJ}/sub/f.txt" } },
				{ name: "Bash", input: { command: "echo hi" } },
			],
		},
		{
			seq: [{ name: "Read", input: { file_path: "{PROJ}/sub/f.txt" } }],
			projFiles: { "sub/CLAUDE.md": "nested", "sub/f.txt": "x\n" },
			args: ["--settings", JSON.stringify({ outputStyle: "st" })],
			cfgFiles: { "output-styles/st.md": STYLE },
		},
		{ args: ["--permission-mode", "auto"] },
		twoTurns(2),
	];
};

const byKey = (a: [string, Set<string>], b: [string, Set<string>]): number => {
	if (a[0] === b[0]) {
		return 0;
	}
	return a[0] < b[0] ? -1 : 1;
};

const linesData = (acc: Acc): Record<string, Data> => {
	const data: Record<string, Data> = {
		precondition:
			acc.allOk &&
			acc.keysByType.has("user") &&
			acc.keysByType.has("assistant"),
		"lines.total": acc.lineCount,
		"attachment.types": [...acc.att].toSorted(),
		"api_request.params_keys": [...acc.params].toSorted(),
		"api_request.base_keys": [...acc.baseKeys].toSorted(),
		"api_request.betas_count": acc.betas.length,
		"api_request.betas": acc.betas,
	};
	for (const [t, s] of [...acc.keysByType].toSorted(byKey)) {
		data[`line.${t}`] = [...s].toSorted();
	}
	return data;
};

const runLines = async (ctx: Parameters<PrintGroup["run"]>[0]) => {
	const acc: Acc = {
		keysByType: new Map(),
		att: new Set(),
		params: new Set(),
		baseKeys: new Set(),
		betas: [],
		lineCount: 0,
		first: null,
		allOk: true,
	};
	await eachInOrder(linesCases(), async (c) => {
		const r = await runCase(ctx.bin, c);
		acc.allOk &&= r.code === 0;
		for (const j of await transcript(r)) {
			absorb(acc, j);
		}
		if (acc.first === null) {
			acc.first = r;
		} else {
			await dispose(r);
		}
	});
	if (acc.first === null) {
		throw new Error("no case ran");
	}
	const first = acc.first;
	const res = baseResult(ctx, "print.transcripts.lines", first, {
		data: linesData(acc),
		notes:
			"Four runs merged (tools+memory, output style, auto mode, two stream-json turns); args shown are the first run.",
	});
	await dispose(first);
	return res;
};

const EDIT_HOOK = JSON.stringify({
	hooks: {
		PostToolUse: [
			{
				matcher: "Read",
				hooks: [{ type: "command", command: "echo changed >> {PROJ}/f.txt" }],
			},
		],
	},
});

const runAttachments = async (ctx: Parameters<PrintGroup["run"]>[0]) => {
	const edited = await runCase(ctx.bin, {
		seq: [
			{ name: "Read", input: { file_path: "{PROJ}/f.txt" } },
			{ name: "Bash", input: { command: "echo hi" } },
		],
		args: ["--allowedTools", "Bash"],
		projFiles: { "f.txt": "one\n", "CLAUDE.md": "top" },
		cfgFiles: { "settings.json": EDIT_HOOK },
	});
	const editedTypes = await attTypes(edited);
	const changedText = await readIf(join(edited.sb.proj, "f.txt"));
	const fileChanged = changedText.includes("changed");
	const editedOk = edited.code === 0;
	await dispose(edited);
	const three = await runCase(ctx.bin, twoTurns(3));
	const threeTypes = await attTypes(three);
	const threeOk = three.code === 0 && threeTypes.length > 0;
	await dispose(three);
	const plain = await runCase(ctx.bin, {});
	try {
		const plainTypes = await attTypes(plain);
		return baseResult(ctx, "print.transcripts.attachments", plain, {
			data: {
				precondition:
					plain.code === 0 &&
					plainTypes.length > 0 &&
					editedOk &&
					fileChanged &&
					threeOk,
				"hook.changed_file": fileChanged,
				edited_file_run: editedTypes,
				three_prompts: threeTypes,
				plain: plainTypes,
			},
			notes:
				"args/exit are from the plain run; the other two runs are a Read with a file-changing hook and three stream-json turns.",
		});
	} finally {
		await dispose(plain);
	}
};

export const transcriptsGroup: PrintGroup = {
	id: "transcripts",
	title: "Transcript line shapes and attachments",
	run: async (ctx) => {
		const lines = await oneCase(ctx, "print.transcripts.lines", () =>
			runLines(ctx),
		);
		const atts = await oneCase(ctx, "print.transcripts.attachments", () =>
			runAttachments(ctx),
		);
		return [...lines, ...atts];
	},
};
