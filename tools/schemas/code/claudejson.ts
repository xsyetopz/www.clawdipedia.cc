// Surface 5: ~/.claude.json, from the defaults objects and the list of user-settable keys.
import {
	header,
	idx,
	type Json,
	note,
	only,
	parseStrings,
	props,
	R,
	UNVERIFIED,
	VERSION,
} from "./ctx.ts";
import { objSchema } from "./schema.ts";
export const buildClaudeJson = (): { file: string; schema: Json } => {
	const src = only("numStartups:0");
	const dStart = idx(src, "{numStartups:0,");
	const pStart = idx(src, "{allowedTools:[],mcpContextUris:[],mcpServers:{}");
	const global = objSchema(R.objectAt(src, dStart), "default");
	const project = objSchema(R.objectAt(src, pStart), "default");
	const al = /\["apiKeyHelper","installMethod","autoUpdates"[^\]]*\]/u.exec(
		src.text,
	);
	if (!al) {
		throw new Error("user-settable key list not found");
	}
	const settable = parseStrings(al[0]);
	const gp = props(global);
	const noDefault = settable.filter((k) => !(k in gp));
	for (const k of settable) {
		gp[k] = { ...(gp[k] ?? { ...UNVERIFIED }), "x-user-settable": true };
	}
	// `projects[<path>]` is read with the project defaults as the fallback.
	if (!/\.projects\?*\.?\[/u.test(src.text)) {
		throw new Error("projects map not found");
	}
	gp["projects"] = {
		type: "object",
		additionalProperties: { $ref: "#/$defs/project" },
	};
	note(
		`claude-json: ${Object.keys(gp).length} global keys (${settable.length} user-settable, ${noDefault.length} of those not in the defaults), ${Object.keys(props(project)).length} project keys`,
	);
	return {
		file: "claude-code-claude-json.json",
		schema: {
			...header(
				"claude-code-claude-json.json",
				"Claude Code ~/.claude.json",
				`For ~/.claude.json (the global state file). Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: the defaults function (first key numStartups:0), the per-project defaults object (allowedTools:[],mcpContextUris:[],mcpServers:{}) used as the fallback for projects[<path>], and the list of user-settable keys (starts "apiKeyHelper","installMethod","autoUpdates"). "default" is the value in the code's defaults; "x-user-settable" marks keys in that list. Keys with no default value in the code (undefined, or only in the list) are x-unverified. The file holds more keys than these (the program writes others on demand); only keys the code names are listed. No probe in captures/ records this file's keys, so nothing is marked x-observed. Do not edit by hand.`,
			),
			...global,
			$defs: {
				project: {
					...project,
					$comment: "Value of projects[<absolute path>].",
				},
			},
		},
	};
};
