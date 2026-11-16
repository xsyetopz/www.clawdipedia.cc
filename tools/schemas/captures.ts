// Captures for the config schemas in schemas/: settings, plugin and marketplace manifests, .mcp.json, keybindings.
import { type Capture, ID } from "./capture.ts";

const SCHEMA_DESC = String.raw`JSON Schema reference for editor autocomplete\/validation; ignored at load time`;
const lazy = (kind: string, after: string): Capture => ({
	kind,
	module: new RegExp(
		String.raw`(${ID})=${ID}\(\(\)=>${ID}\(\{\$schema:${after}`,
		"u",
	),
	expr: (m) => `${m[1]}()`,
});

// Stable anchors (text of descriptions and field order), never minified names.
/** The config schema captures, anchored on description text and field order. */
export const CAPTURES: Capture[] = [
	{
		// function X(e,n={}){let r=cc(e,n);return new Class(r).whole()}  +  function Y(){return list.filter((e)=>reg[e].buildGate())}
		kind: "settings",
		module: new RegExp(
			String.raw`function (${ID})\((${ID}),(${ID})=\{\}\)\{let (${ID})=${ID}\(\2,\3\);return new ${ID}\(\4\)\.whole\(\)\}`,
			"u",
		),
		expr: (m, src) => {
			const gate = new RegExp(
				String.raw`function (${ID})\(\)\{return ${ID}\.filter\(\((${ID})\)=>${ID}\[\2\]\.buildGate\(\)\)\}`,
				"u",
			).exec(src);
			return gate ? `${m[1]}(${gate[1]}())` : null;
		},
	},
	// The base object (name, version, author, ...). The full manifest merges its shape with the component objects.
	{
		...lazy(
			"plugin-manifest-base",
			String.raw`${ID}\(\)\.optional\(\)\.describe\("${SCHEMA_DESC}"\),name:${ID}\(\)\.describe\("Unique identifier for the plugin`,
		),
		internal: true,
	},
	{
		kind: "plugin-manifest",
		module: (names) => {
			const base = names.get("plugin-manifest-base")?.replace(/\(\)$/u, "");
			return base !== undefined && base !== ""
				? new RegExp(
						String.raw`(${ID})=${ID}\(\(\)=>${ID}\(\{\.\.\.${base.replaceAll("$", String.raw`\$`)}\(\)\.shape,`,
						"u",
					)
				: null;
		},
		expr: (m) => `${m[1]}()`,
	},
	{
		// The marketplace file keeps plugins as unknown[] and checks each entry afterwards with this schema.
		kind: "marketplace-plugin-entry",
		module: new RegExp(
			String.raw`function ${ID}\((${ID})\)\{let (${ID})=(${ID})\(\);return \1\.flatMap\(\((${ID}),(${ID})\)=>\{let (${ID})=\2\.safeParse\(\4\)`,
			"u",
		),
		expr: (m) => `${m[3]}()`,
	},
	lazy(
		"marketplace",
		String.raw`${ID}\(\)\.optional\(\)\.describe\("${SCHEMA_DESC}"\),name:${ID}\(${ID}\),version:${ID}\(\)\.optional\(\)\.describe\("Marketplace manifest version"`,
	),
	lazy(
		"plugin-hooks",
		String.raw`${ID}\(\)\.optional\(\)\.catch\(void 0\)\.describe\("${SCHEMA_DESC}"\),description:`,
	),
	{
		// {mcpServers: record(string, server)}: the .mcp.json file. Followed by a helper that reads connection state.
		// Since 2.1.326 other declarations of the same statement can sit before that helper.
		kind: "mcp",
		module: new RegExp(
			String.raw`(${ID})=${ID}\(\(\)=>${ID}\(\{mcpServers:${ID}\(${ID}\(\),${ID}\(\)\)\}\)\)[^;]*;function ${ID}\(\w\)\{return \w\.type==="connected"\|\|\w\.type==="cached"\}`,
			"u",
		),
		expr: (m) => `${m[1]}()`,
	},
	lazy(
		"keybindings",
		String.raw`${ID}\(\)\.optional\(\)\.describe\("JSON Schema URL for editor validation"\),\$docs:`,
	),
];
