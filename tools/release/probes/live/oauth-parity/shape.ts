import { type Data, normalise } from "../../../lib/results.ts";
import { show } from "../../print/run/helpers.ts";
import { arr, obj } from "../harness.ts";

export interface Shape {
	bodyKeys: string[];
	tools: string[];
	systemBlocks: number;
	/** System text lines with temp paths, model names, and the per-run billing hash masked, so two models can be compared. Never written out. */
	systemLines: string[];
	model: string;
	betas: string[];
}

const systemText = (sys: unknown): string =>
	(Array.isArray(sys)
		? sys.map((x) => show(obj(x)["text"]))
		: [show(sys ?? "")]
	)
		.join("\n")
		.replaceAll(/claude-(?:opus|sonnet|haiku|fable)-[\w-]+/gu, "<model-id>")
		.replaceAll(/\b(?:Opus|Sonnet|Haiku|Fable) \d+(?:\.\d+)?/gu, "<model>")
		.replaceAll(/\bcch=[0-9a-f]+/gu, "cch=<hash>");

const blocks = (sys: unknown): number => {
	if (Array.isArray(sys)) {
		return sys.length;
	}
	return sys === undefined || sys === null || sys === "" ? 0 : 1;
};

export const shapeOf = (body: unknown, betas: string): Shape => {
	const b = obj(body);
	const sys = b["system"];
	return {
		bodyKeys: Object.keys(b).toSorted(),
		tools: arr(b["tools"])
			.map((t) => show(obj(t)["name"]))
			.toSorted(),
		systemBlocks: blocks(sys),
		systemLines: normalise(systemText(sys)).split("\n"),
		model: show(b["model"] ?? ""),
		betas: betas
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "")
			.toSorted(),
	};
};

const only = (a: string[], b: string[]): string[] =>
	a.filter((v) => !b.includes(v));

/** The main request is the one with tools (title and summary calls have none). */
export const mainShape = (xs: Shape[]): Shape | undefined =>
	xs.find((s) => s.tools.length > 0) ?? xs.at(-1);

/** The OAuth side (a) against the key side (b). */
export const compare = (a: Shape, b: Shape): Record<string, Data> => ({
	"same.bodyKeys": a.bodyKeys.join(",") === b.bodyKeys.join(","),
	"bodyKeys.onlyOauth": only(a.bodyKeys, b.bodyKeys),
	"bodyKeys.onlyKey": only(b.bodyKeys, a.bodyKeys),
	"same.tools": a.tools.join(",") === b.tools.join(","),
	"tools.onlyOauth": only(a.tools, b.tools),
	"tools.onlyKey": only(b.tools, a.tools),
	"systemBlocks.oauth": a.systemBlocks,
	"systemBlocks.key": b.systemBlocks,
	"same.systemText": a.systemLines.join("\n") === b.systemLines.join("\n"),
	"systemText.linesOnlyOauth": only(a.systemLines, b.systemLines).length,
	"systemText.linesOnlyKey": only(b.systemLines, a.systemLines).length,
	"betas.onlyOauth": only(a.betas, b.betas),
	"betas.onlyKey": only(b.betas, a.betas),
	"betas.oauth": a.betas,
	"model.oauth": a.model,
	"model.key": b.model,
});
