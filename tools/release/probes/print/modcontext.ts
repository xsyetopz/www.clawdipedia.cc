// A mod that adds one instruction file of each kind in its `prompt.context` hook. The case records the label that the program
// writes above each file that it did not load itself. A managed folder that root owns never shows the "not verified" label.
import type { Data } from "../../lib/results.ts";
import { arr, obj } from "./run.ts";
import {
	bodyOf,
	type CaseDef,
	json,
	msgs,
	runCases,
	show,
	withRun,
} from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

const KINDS = ["managed", "user", "project", "local", "memory"];
const FILES = KINDS.map((kind) => ({
	path: `/opt/ctxprobe/${kind}.md`,
	kind,
	content: `Probe ${kind} text.`,
}));

const MOD = `export const register = (on) => {
  on("prompt.context", async ($, e, next) => {
    const r = await next(e);
    const below = r.instructionFiles ?? e.instructionFiles ?? [];
    return { ...r, instructionFiles: [...below, ...${json(FILES)}] };
  });
};
`;

const addedFiles: CaseDef = {
	name: "prompt-context.added-files",
	run: (ctx) =>
		withRun(
			ctx,
			{
				homeFiles: {
					"plug/.claude-plugin/plugin.json": json({
						name: "ctxprobe",
						version: "1.0.0",
					}),
					"plug/hooks/hooks.json": json({ modules: ["./register.ts"] }),
					"plug/hooks/register.ts": MOD,
				},
				args: ["--plugin-dir", "{HOME}/plug"],
			},
			(r) => {
				const [q] = msgs(r);
				const first = q === undefined ? undefined : bodyOf(q).messages?.[0];
				const lines = arr(first?.content)
					.flatMap((c) => show(obj(c)["text"] ?? "").split("\n"))
					.filter((l) => l.includes("ctxprobe") || l.includes("Probe "));
				const data: Record<string, Data> = {
					precondition: lines.some((l) => l.includes("Probe managed text.")),
				};
				for (const kind of KINDS) {
					data[`label.${kind}`] =
						lines.find((l) => l.includes(`/opt/ctxprobe/${kind}.md`)) ?? null;
					data[`quoted.${kind}`] = lines.includes(`> Probe ${kind} text.`);
				}
				return { from: r, data, samples: { lines: lines.join("\n") } };
			},
		),
};

export const modcontext: PrintGroup = {
	id: "modcontext",
	title:
		"Mod API prompt.context: the label of an instruction file that a mod adds",
	run: (ctx) => runCases(ctx, "modcontext", [addedFiles]),
};
