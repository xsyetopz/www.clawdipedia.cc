// Large CLAUDE.md probes: the warning in print, doctor and get_status, and a nested file over the limit.
import { arr, obj } from "../run.ts";
import {
	type CaseDef,
	evKinds,
	json,
	msgs,
	type Out,
	type Spec,
	withRun,
} from "../run/helpers.ts";
import type { PrintCtx } from "../types.ts";

const BIG = "x".repeat(45_000);
const stripX = (s: string) => s.replaceAll(/x{50,}/gu, "<xs>");

const doctorText = (ctx: PrintCtx): Promise<string> =>
	withRun(
		ctx,
		{
			argv: ["doctor"],
			noPrompt: true,
			projFiles: { "CLAUDE.md": BIG },
			timeoutMs: 30_000,
		},
		(d) => stripX(d.stdout + d.stderr),
	);

const STATUS_SPEC: Spec = {
	noPrompt: true,
	argv: [
		"-p",
		"--input-format",
		"stream-json",
		"--output-format",
		"stream-json",
		"--verbose",
	],
	stdin: `${json({ type: "control_request", request_id: "g1", request: { subtype: "get_status" } })}\n`,
	projFiles: { "CLAUDE.md": BIG },
};

const sectionTitles = (line: string): string => {
	try {
		const j = obj(JSON.parse(line));
		const sections = arr(obj(obj(j["response"])["response"])["sections"]);
		return sections.map((s) => String(obj(s)["title"])).join("|");
	} catch {
		return "";
	}
};

const statusInfo = (ctx: PrintCtx) =>
	withRun(ctx, STATUS_SPEC, (g) => {
		const line =
			g.stdout.split("\n").find((l) => l.includes("control_response")) ?? "";
		return {
			titles: sectionTitles(line),
			mentions: /Large CLAUDE|exceeds|chars/iu.test(line),
		};
	});

const bigOut = (ctx: PrintCtx): Promise<Out> =>
	withRun(ctx, { projFiles: { "CLAUDE.md": BIG } }, async (r) => {
		const t = stripX(r.stdout + r.stderr);
		const doc = await doctorText(ctx);
		const st = await statusInfo(ctx);
		return {
			from: r,
			data: {
				precondition: msgs(r).length > 0 && st.titles.length > 0,
				printWarns: /Large CLAUDE|exceeds|memory files/iu.test(t),
				doctorWarns: /Large CLAUDE|exceed|memory files/iu.test(doc),
				getStatusSections: st.titles,
				getStatusMentionsSize: st.mentions,
				events: evKinds(r),
			},
			notes:
				"Three runs (-p, doctor, get_status control request); the doctor and get_status runs send no prompt.",
		};
	});

export const bigClaudeMd: CaseDef = {
	name: "large-claude-md",
	run: (ctx) => bigOut(ctx),
};

const afterNested = (body: string, at: number) => {
	const rest = body.slice(at + 12);
	return {
		charsKept: /^y*/u.exec(rest)?.[0].length ?? 0,
		after: stripX(rest.replace(/^y+/u, "<ys>")).slice(0, 300),
	};
};

// The nested file loads after a Read under its folder; a model with each window shows which limit cuts it.
export const nestedClaudeMd = (model: string): CaseDef => ({
	name: `nested-claude-md-over-limit.${model}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				model,
				projFiles: {
					"sub/CLAUDE.md": `NESTED-BEGIN${"y".repeat(200_000)}NESTED-END`,
					"sub/f.txt": "x\n",
				},
				stub: {
					seq: [{ name: "Read", input: { file_path: "{PROJ}/sub/f.txt" } }],
				},
			},
			(r) => {
				const body = JSON.stringify(msgs(r).at(-1)?.body ?? "");
				const at = body.indexOf("NESTED-BEGIN");
				const kept = at === -1 ? null : afterNested(body, at);
				return {
					from: r,
					data: {
						precondition: msgs(r).length >= 2,
						nestedLoaded: at !== -1,
						endKept: body.includes("NESTED-END"),
						charsKept: kept?.charsKept ?? 0,
					},
					samples: { after: kept?.after ?? "" },
				};
			},
		),
});
