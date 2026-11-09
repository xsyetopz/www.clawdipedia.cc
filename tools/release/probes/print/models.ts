// Model-name handling: system prompt size, tool count, and the model id sent (ported from p305-print models.ts).
import {
	bodyOf,
	type CaseDef,
	fixed,
	msgs,
	runCases,
	sysText,
	toolNames,
	withRun,
} from "./run/helpers.ts";
import { eachInOrder } from "./run/seq.ts";
import type { PrintGroup } from "./types.ts";

const MODELS =
	"claude-opus-5-5 claude-sonnet-5-5 claude-opus-5-5-eap claude-sonnet-5-5-eap claude-haiku-5-5 claude-opus-4-8 claude-opus-5 claude-fable-5 claude-fable-5-1 claude-mythos-5 claude-mythos-5-1 totally-unknown claude-sonnet-5 claude-haiku-4-5 claude-3-5-haiku claude-3-5-sonnet claude-3-7-sonnet claude-sonnet-4-0 claude-sonnet-4-5 claude-sonnet-4-6 claude-opus-4-5 claude-opus-4-6 claude-opus-4-7 claude-opus-4-0 claude-opus-4-1".split(
		" ",
	);

const matrix: CaseDef = {
	name: "matrix",
	run: async (ctx) => {
		const data: Record<string, string | number | boolean | null> = {};
		await eachInOrder(MODELS, async (m) => {
			await withRun(ctx, { model: m }, (r) => {
				const q = msgs(r)[0];
				if (!q) {
					data[`${m}.status`] = "no request";
					return;
				}
				data[`${m}.systemChars`] = fixed(r, sysText(q)).replace(
					/cc_version=[^;]*;/u,
					"",
				).length;
				data[`${m}.tools`] = toolNames(q).length;
				data[`${m}.requestModel`] = bodyOf(q).model ?? null;
			});
		});
		return {
			data: {
				precondition: Boolean(data[`${MODELS[0]}.requestModel`]),
				models: MODELS.length,
				...data,
			},
			notes: `One run per model name (${MODELS.length}); the model flag is the variable under test.`,
		};
	},
};

export const models: PrintGroup = {
	id: "models",
	title: "Model-name handling",
	run: (ctx) => runCases(ctx, "models", [matrix]),
};
