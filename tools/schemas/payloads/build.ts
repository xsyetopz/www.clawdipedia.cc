// Turns the raw captures of tools/schemas/payloads/capture.ts into the bodies of the payload schema files.
// Pieces that zod emits per captured schema (a $schema key, $defs with local names) are folded into one document.
import type { Json } from "../build.ts";
import {
	addDef,
	dropMeta,
	getJson,
	inlineDefs,
	isObject,
	jsonList,
	need,
	omitLarge,
	requireJson,
	sortDefs,
	usable,
} from "./defs.ts";

export { addDef } from "./defs.ts";
export { streamJson } from "./stream.ts";

// ---- hook output -----------------------------------------------------------------------------------------------

export const hookOutput = (raw: Record<string, unknown>): Json => {
	const sync = dropMeta(need(raw, "hook-output"));
	const props = getJson(sync, "properties");
	const union =
		props === undefined ? undefined : getJson(props, "hookSpecificOutput");
	if (props === undefined || union === undefined) {
		throw new TypeError("hook output has no hookSpecificOutput");
	}
	const arms = union["anyOf"];
	if (!Array.isArray(arms)) {
		throw new TypeError("hookSpecificOutput is not a union");
	}
	const defs: Json = {};
	const refs: Json[] = [];
	for (const arm of jsonList(arms, "hookSpecificOutput anyOf")) {
		const event = getJson(arm, "properties")?.["hookEventName"];
		const name = isObject(event) ? event["const"] : undefined;
		if (typeof name !== "string") {
			throw new TypeError("hookSpecificOutput member without a hookEventName");
		}
		addDef(defs, `${name}HookSpecificOutput`, arm);
		refs.push({ $ref: `#/$defs/${name}HookSpecificOutput` });
	}
	// The arms are told apart by hookEventName, so exactly one matches.
	const { anyOf: _a, ...restUnion } = union;
	void _a;
	addDef(defs, "AsyncHookOutput", need(raw, "hook-output-async"));
	return {
		type: "object",
		...Object.fromEntries(
			Object.entries(sync).filter(([k]) => k !== "properties"),
		),
		properties: {
			...props,
			hookSpecificOutput: { ...restUnion, oneOf: refs },
		},
		$defs: sortDefs(defs),
	};
};

// ---- tools -----------------------------------------------------------------------------------------------------

export interface ToolsResult {
	body: Json;
	missing: string[];
}

const TOOL_SCHEMAS = [
	["inputSchema", "Input"],
	["outputSchema", "Result"],
] as const;

export const tools = (raw: Record<string, unknown>): ToolsResult => {
	const list = raw["tools"];
	if (!Array.isArray(list)) {
		throw new TypeError('missing raw capture "tools"');
	}
	const defs: Json = {};
	const missing: string[] = [];
	for (const t of jsonList(list, "raw capture tools")) {
		const name = String(t["name"]);
		for (const [key, suffix] of TOOL_SCHEMAS) {
			const schema = t[key];
			if (usable(schema)) {
				addDef(defs, `${name}${suffix}`, schema);
			} else {
				missing.push(`${name}${suffix}`);
			}
		}
	}
	return { body: { $defs: sortDefs(defs) }, missing };
};

// ---- control protocol ------------------------------------------------------------------------------------------

const markDirection = (defs: Json, key: string, direction: string) => {
	const def = defs[key];
	if (isObject(def)) {
		def["x-direction"] = direction;
	}
};

export const control = (raw: Record<string, unknown>): Json => {
	const rows = raw["control"];
	if (!Array.isArray(rows)) {
		throw new TypeError('missing raw capture "control"');
	}
	const defs: Json = {};
	for (const row of jsonList(rows, "raw capture control")) {
		const request = omitLarge(
			inlineDefs(requireJson(row["request"], "control request")),
			"claude-code-stream-json.json (userInput and assistantOutput)",
			50_000,
		);
		const subtype = getJson(request, "properties")?.["subtype"];
		const literalSubtype = isObject(subtype) ? subtype["const"] : undefined;
		if (typeof literalSubtype !== "string") {
			throw new TypeError("control request without a literal subtype");
		}
		const direction = String(row["originator"]);
		addDef(defs, `${literalSubtype}Request`, request);
		markDirection(defs, `${literalSubtype}Request`, direction);
		// A response of null or undefined means the request gets no payload back.
		const response = row["response"];
		if (usable(response)) {
			addDef(defs, `${literalSubtype}Response`, inlineDefs(response));
			markDirection(defs, `${literalSubtype}Response`, direction);
		}
	}
	return { $defs: sortDefs(defs) };
};

// ---- --agents JSON ---------------------------------------------------------------------------------------------

export const agentsJson = (raw: Record<string, unknown>): Json => {
	const { $defs, ...body } = dropMeta(need(raw, "agents-json"));
	return isObject($defs) ? { ...body, $defs } : body;
};
