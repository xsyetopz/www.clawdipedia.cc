// Surface 1: the status line input, from the program's payload builders and the statusline-setup prompt.
import { join } from "node:path";

import { children, type Node } from "../../../inspect/mcp/src/ast.ts";
import { isNode } from "../../../inspect/mcp/src/ast/node.ts";
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
	type Src,
	stdinKeys,
	VERSION,
} from "./ctx.ts";
import { objSchema } from "./schema.ts";
import { mergeTemplate, parseTemplate } from "./statusline-template.ts";

/** `tasks: list.map((t) => ({...}))`: the object each item is. */
const findTaskItem = (n: Node | undefined): Node | undefined => {
	if (!n) {
		return undefined;
	}
	if (
		n.type === "ArrowFunctionExpression" &&
		n.body.type === "ObjectExpression"
	) {
		return isNode(n.body) ? n.body : undefined;
	}
	return children(n)
		.map((c) => findTaskItem(c))
		.find((x) => x !== undefined);
};

/** The common base is spread from the same builder as the main payload, with two arguments as
 * there: copy the keys that builder sends. */
const copyBase = (
	src: Src,
	retAt: number,
	schema: Json,
	subSchema: Json,
): void => {
	const baseCall = src.at(retAt + "{...".length, "CallExpression");
	const baseKeys = new Set(
		(baseCall ? (R.call(src, baseCall) ?? []) : []).flatMap((e) =>
			"key" in e ? [e.key] : [],
		),
	);
	for (const [k, v] of Object.entries(props(schema))) {
		if (baseKeys.has(k)) {
			props(subSchema)[k] = v;
		}
	}
};

/** The subagent panel gets its own payload: the common base plus `columns` and `tasks`. */
const buildSubagent = (
	src: Src,
	retAt: number,
	schema: Json,
): Json | undefined => {
	const sub = only("subagentStatusLine execution");
	const sm = /\{\.\.\.[\w$]+\([\w$]+,[\w$]+\),columns:[\w$]+,tasks:/u.exec(
		sub.text,
	);
	if (!sm) {
		return undefined;
	}
	const subEntries = R.objectAt(sub, sm.index);
	const subSchema = objSchema(subEntries, "plain");
	const tasks = subEntries.find((e) => "key" in e && e.key === "tasks");
	const each =
		tasks && "val" in tasks && tasks.val.k === "unk"
			? findTaskItem(tasks.val.ref?.n)
			: undefined;
	if (each?.type === "ObjectExpression") {
		props(subSchema)["tasks"] = {
			type: "array",
			items: objSchema(R.entries(sub, each), "plain"),
		};
	}
	copyBase(src, retAt, schema, subSchema);
	markObserved(
		subSchema,
		stdinKeys(readJson(join(CAPTURES, "pty/statusline.subagent-tick.json"))),
	);
	return {
		...subSchema,
		$comment: "Payload of the subagentStatusLine command.",
	};
};

export const buildStatusLine = (): { file: string; schema: Json } => {
	const src = only("tengu_status_line_result");
	const main = literalAfter(
		src,
		/return\{\.\.\.[\w$]+\([\w$]+,[\w$]+\),\.\.\.[\w$]+&&\{session_name:/u,
	);
	// literalAfter points at the `{` before session_name; the full literal starts at the `return{` before it.
	const retAt = src.text.lastIndexOf("return{", main.at) + "return".length;
	const schema = objSchema(R.objectAt(src, retAt), "plain");
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

	const subDef = buildSubagent(src, retAt, schema);
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
		...(subDef ? { $defs: { subagentStatusLineInput: subDef } } : {}),
	};
	return { file: "claude-code-status-line.json", schema: out };
};
