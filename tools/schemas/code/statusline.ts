// Surface 1: the status line input, from the program's payload builders and the statusline-setup prompt.
import { join } from "node:path";

import {
	CAPTURES,
	header,
	type Json,
	literalAfter,
	markObserved,
	note,
	only,
	props,
	R,
	readJson,
	stdinKeys,
	VERSION,
} from "./ctx.ts";
import { objSchema } from "./schema.ts";
import { mergeTemplate, parseTemplate } from "./statusline-template.ts";

export const buildStatusLine = async (): Promise<{
	file: string;
	schema: Json;
}> => {
	const src = await only("tengu_status_line_result");
	const main = await literalAfter(
		src,
		/return\{\.\.\.[\w$]+\([\w$]+,[\w$]+\),\.\.\.[\w$]+&&\{session_name:/u,
	);
	// literalAfter points at the `{` before session_name; the full literal starts at the `return{` before it.
	const retAt = src.text.lastIndexOf("return{", main.at) + "return".length;
	const schema = await objSchema(await R.objectAt(src, retAt), "plain");
	const tmpl = parseTemplate(src);
	const codeOnly: string[] = [];
	const tmplOnly: string[] = [];
	mergeTemplate(schema, tmpl, "", codeOnly, tmplOnly);

	const seen = stdinKeys(
		readJson(join(CAPTURES, "pty/statusline.refresh-interval.json")),
	);
	markObserved(schema, seen);
	for (const k of seen) {
		if (props(schema)[k] === undefined) {
			note(`status-line: probe key ${k} not in code`);
		}
	}

	if (tmplOnly.length > 0) {
		note(
			`status-line: in the prompt template, and the code builds that object from a literal without it: ${tmplOnly.join(", ")}`,
		);
	}
	if (codeOnly.length > 0) {
		note(
			`status-line: set by the code but absent from the prompt template: ${codeOnly.join(", ")}`,
		);
	}

	const out: Json = {
		...header(
			"claude-code-status-line.json",
			"Claude Code status line stdin JSON",
			`For the JSON on stdin of a statusLine command. Generated from Claude Code ${VERSION} by tools/schemas/code.ts. Anchors: the telemetry key "tengu_status_line_result" (module with the builder whose return literal starts at "session_name"), the common base builder it spreads (keys session_id, transcript_path, cwd, scratchpad_dir, prompt_id, permission_mode, agent_id, agent_type, effort), the prompt_cache builder (key "prompt_cache" with "warm"), and "The statusLine command will receive the following JSON input via stdin:" for the types and descriptions the code does not show. Field order is the order in the code.${tmplOnly.length > 0 ? ` The prompt also lists ${tmplOnly.join(", ")}, which the code never sets, so ${tmplOnly.length > 1 ? "they are" : "it is"} left out.` : ""}${codeOnly.length > 0 ? ` The code sets ${codeOnly.join(", ")}, which the prompt does not list.` : ""} Do not edit by hand.`,
		),
		...schema,
	};
	return { file: "claude-code-status-line.json", schema: out };
};
