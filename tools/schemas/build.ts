import { FILES } from "./files.ts";
import {
	agentsJson,
	control,
	hookOutput,
	streamJson,
	tools,
} from "./payloads/build.ts";

export { CODE_FILES, FILES, KINDS } from "./files.ts";

// Turns the raw toJSONSchema output into the published files (design D2).
export type Json = Record<string, unknown>;
// A kind holds one schema, or a list of rows (control, tools) that the payload builders check themselves.
export type RawSchemas = Record<string, unknown>;

export const BASE_URL = "https://clawdipedia.cc/schemas";

// The binary has no list of managed-only settings. It says so in each key's description, so the descriptions
// are the source (same rules as the claudetto schema generator). Rules run on top-level and nested properties.
const MANAGED_ONLY = [
	/\bonly (?:honou?red |read |enforced |applies )?(?:from|in) (?:the )?(?:admin-controlled |device )?(?:managed|policy)/iu,
	/\b(?:honou?red|read|enforced) only (?:from|in) (?:the )?(?:admin-controlled |device )?(?:managed|policy|HKLM)/iu,
	/(?:^|[.(] ?|\bRead from )managed settings only/iu,
	/\(and set in (?:device )?managed settings/iu,
	/^When set in managed settings/u,
];
export const isManagedOnly = (description: unknown): boolean =>
	typeof description === "string" &&
	MANAGED_ONLY.some((re) => re.test(description));

const isObject = (v: unknown): v is Json =>
	typeof v === "object" && v !== null && !Array.isArray(v);

/** Marks or removes the managed-only keys among `props`, and walks into each one. */
const applyManagedProps = (props: Json, strip: boolean): Json => {
	const out: Json = {};
	for (const [key, sub] of Object.entries(props)) {
		if (!isObject(sub)) {
			out[key] = sub;
			continue;
		}
		const managed = isManagedOnly(sub["description"]);
		if (managed && strip) {
			continue;
		}
		const next = applyManaged(sub, strip);
		out[key] = managed ? { ...next, "x-managed-only": true } : next;
	}
	return out;
};

// Marks (strip=false) or removes (strip=true) managed-only keys. Walks properties and array items.
export const applyManaged = (schema: Json, strip: boolean): Json => {
	const out: Json = {};
	for (const [k, v] of Object.entries(schema)) {
		if (k === "properties" && isObject(v)) {
			out[k] = applyManagedProps(v, strip);
		} else if (
			k === "required" &&
			Array.isArray(v) &&
			strip &&
			isObject(schema["properties"])
		) {
			const outProps = out["properties"];
			const keep = new Set(isObject(outProps) ? Object.keys(outProps) : []);
			out[k] = v.filter((x) => keep.has(String(x)));
		} else if (k === "items" && isObject(v)) {
			out[k] = applyManaged(v, strip);
		} else {
			out[k] = v;
		}
	}
	return out;
};

/** A copy of a schema without its "$schema" key. */
const withoutSchema = (body: Json): Json =>
	Object.fromEntries(Object.entries(body).filter(([k]) => k !== "$schema"));

// The binary reads marketplace "plugins" as unknown[] and checks every entry with its own schema afterwards,
// so the plain conversion leaves "items" empty. Put the entry schema there.
const graftPluginEntries = (marketplace: Json, entry: Json): Json => {
	const props = marketplace["properties"];
	if (!isObject(props) || !isObject(props["plugins"])) {
		throw new Error("marketplace schema has no plugins property");
	}
	const item = withoutSchema(entry);
	// The entry type is a partial of the manifest, so zod leaves "source" optional. Entries need it
	// (a bad entry is stubbed or dropped), and "." is accepted: the binary maps "." to "./" before checking.
	const itemProps = item["properties"];
	if (isObject(itemProps) && isObject(itemProps["source"])) {
		const source = itemProps["source"];
		const arms: unknown = source["anyOf"];
		if (Array.isArray(arms)) {
			const known: unknown[] = arms;
			source["anyOf"] = [{ const: "." }, ...known];
		}
	}
	const found: unknown = item["required"];
	const required: unknown[] = Array.isArray(found) ? found : [];
	item["required"] = [...new Set([...required, "source"])];
	return {
		...marketplace,
		properties: { ...props, plugins: { ...props["plugins"], items: item } },
	};
};

// An undefined arm in a union only means "may be absent", which JSON Schema already says. Drop it.
export const pruneUnrepresentable = (node: unknown): unknown => {
	if (Array.isArray(node)) {
		return node.map((x) => pruneUnrepresentable(x));
	}
	if (!isObject(node)) {
		return node;
	}
	const out: Json = {};
	for (const [k, v] of Object.entries(node)) {
		if ((k === "anyOf" || k === "oneOf") && Array.isArray(v)) {
			const kept = v.filter(
				(x) => !(isObject(x) && x["x-cc-unrepresentable"] === true),
			);
			out[k] = kept.map((x) => pruneUnrepresentable(x));
		} else {
			out[k] = pruneUnrepresentable(v);
		}
	}
	if (out["x-cc-unrepresentable"] === true) {
		delete out["x-cc-unrepresentable"];
	}
	return out;
};

// The binary adds this key only when the environment variable is set; say so in the key's description.
const noteGatedKeys = (settings: Json): Json => {
	const props = settings["properties"];
	if (!isObject(props) || !isObject(props["xaaIdp"])) {
		return settings;
	}
	const key = props["xaaIdp"];
	const existing =
		typeof key["description"] === "string" ? key["description"] : "";
	const description =
		`${existing.trim()} Only applies when CLAUDE_CODE_ENABLE_XAA=1 is set in the environment; Claude Code ignores this key otherwise.`.trim();
	return {
		...settings,
		properties: { ...props, xaaIdp: { ...key, description } },
	};
};

const anchorNote = (name: keyof typeof FILES): string => {
	const entry = FILES[name];
	const anchor = "anchor" in entry ? entry.anchor : "";
	return anchor === "" ? "" : ` Anchor: ${anchor}.`;
};

const withHeader = (
	name: keyof typeof FILES,
	body: Json,
	version: string,
): Json => {
	const rest = withoutSchema(body);
	return {
		$schema: "https://json-schema.org/draft/2020-12/schema",
		$id: `${BASE_URL}/${name}`,
		title: `${FILES[name].title} (Claude Code ${version})`,
		$comment: `For ${FILES[name].what}. Generated from Claude Code ${version} by calling the zod v4 toJSONSchema embedded in the binary on its own validator (method A, runtime export).${anchorNote(name)} Do not edit by hand: run "bun run schemas".`,
		...rest,
	};
};

export const isRawSchemas = (v: unknown): v is RawSchemas => isObject(v);

type Need = (k: string) => Json;

type PayloadKind =
	| "claude-code-hook-output.json"
	| "claude-code-tools.json"
	| "claude-code-control-protocol.json"
	| "claude-code-stream-json.json"
	| "claude-code-agents-json.json";

const assembleSchemas = (
	need: Need,
	version: string,
): Record<Exclude<keyof typeof FILES, PayloadKind>, Json> => ({
	"claude-code-settings.json": withHeader(
		"claude-code-settings.json",
		noteGatedKeys(applyManaged(need("settings"), true)),
		version,
	),
	"claude-code-managed-settings.json": withHeader(
		"claude-code-managed-settings.json",
		noteGatedKeys(applyManaged(need("settings"), false)),
		version,
	),
	"claude-code-plugin-manifest.json": withHeader(
		"claude-code-plugin-manifest.json",
		need("plugin-manifest"),
		version,
	),
	"claude-code-marketplace.json": withHeader(
		"claude-code-marketplace.json",
		graftPluginEntries(need("marketplace"), need("marketplace-plugin-entry")),
		version,
	),
	"claude-code-plugin-hooks.json": withHeader(
		"claude-code-plugin-hooks.json",
		need("plugin-hooks"),
		version,
	),
	"claude-code-keybindings.json": withHeader(
		"claude-code-keybindings.json",
		need("keybindings"),
		version,
	),
	"claude-code-mcp.json": withHeader(
		"claude-code-mcp.json",
		need("mcp"),
		version,
	),
});

const assemblePayloads = (
	payloads: RawSchemas,
	version: string,
): Record<PayloadKind, Json> => {
	const toolDefs = tools(payloads);
	return {
		"claude-code-hook-output.json": withHeader(
			"claude-code-hook-output.json",
			hookOutput(payloads),
			version,
		),
		"claude-code-tools.json": withHeader(
			"claude-code-tools.json",
			{
				...(toolDefs.missing.length > 0
					? {
							description: `The program did not give these definitions: ${toolDefs.missing.join(", ")}.`,
						}
					: {}),
				...toolDefs.body,
			},
			version,
		),
		"claude-code-control-protocol.json": withHeader(
			"claude-code-control-protocol.json",
			control(payloads),
			version,
		),
		"claude-code-stream-json.json": withHeader(
			"claude-code-stream-json.json",
			streamJson(payloads),
			version,
		),
		"claude-code-agents-json.json": withHeader(
			"claude-code-agents-json.json",
			agentsJson(payloads),
			version,
		),
	};
};

export const buildFiles = (
	raw: RawSchemas,
	version: string,
): Record<keyof typeof FILES, Json> => {
	const need: Need = (k) => {
		const v = raw[k];
		if (v === undefined) {
			throw new Error(`missing raw schema "${k}"`);
		}
		const pruned = pruneUnrepresentable(v);
		if (!isObject(pruned)) {
			throw new Error(`raw schema "${k}" is not an object`);
		}
		return pruned;
	};
	const payloads = pruneUnrepresentable(raw);
	if (!isRawSchemas(payloads)) {
		throw new Error("raw schemas are not objects");
	}
	return {
		...assembleSchemas(need, version),
		...assemblePayloads(payloads, version),
	};
};
