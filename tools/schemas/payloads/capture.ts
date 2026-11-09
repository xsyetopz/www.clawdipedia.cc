// Captures for the payload schemas (hook output, tools, control protocol, stream-json, --agents JSON).
// Every anchor is description text, a literal key order, or a literal string, never a minified name.
import { type Capture, ID } from "../capture.ts";

const escapeRe = (s: string) =>
	s.replaceAll(/[.*+?^${}()|[\]\\/]/gu, String.raw`\$&`);

// The schema modules declare each schema as `name=lazy(()=>...)` at the top level, and nothing nests such a
// declaration, so the nearest one before a description is the schema that description belongs to.
const declBefore = (src: string, index: number): string | null => {
	const re = new RegExp(String.raw`(${ID})=${ID}\(\(\)=>`, "gu");
	const head = src.slice(0, index);
	let last: string | null = null;
	for (let m = re.exec(head); m !== null; m = re.exec(head)) {
		last = m[1] ?? null;
	}
	return last;
};

const byDescription = (
	kind: string,
	description: string,
	refs = false,
): Capture => ({
	kind,
	...(refs ? { reused: "ref" as const } : {}),
	module: new RegExp(escapeRe(description), "u"),
	expr: (m, src) => {
		const name = declBefore(src, m.index ?? 0);
		return name === null ? null : `${name}()`;
	},
});

export const PAYLOAD_CAPTURES: Capture[] = [
	{
		// The stdout JSON object of a classic hook: continue, suppressOutput, stopReason, ... hookSpecificOutput.
		kind: "hook-output",
		module: new RegExp(
			String.raw`(${ID})=${ID}\(\(\)=>${ID}\(\{continue:${ID}\(\)\.optional\(\),suppressOutput:${ID}\(\)\.optional\(\),stopReason:`,
			"u",
		),
		expr: (m) => `${m[1]}()`,
	},
	{
		// The other arm of the output union: {async: true, asyncTimeout}.
		kind: "hook-output-async",
		module: new RegExp(
			String.raw`(${ID})=${ID}\(\(\)=>${ID}\(\{async:${ID}\(!0\),asyncTimeout:`,
			"u",
		),
		expr: (m) => `${m[1]}()`,
	},
	{
		// Rows built by function X(request, originator, response){return{request,originator,response}}.
		kind: "control",
		reused: "ref",
		module: new RegExp(
			String.raw`function ${ID}\((\w),(\w),(\w)\)\{return\{request:\1,originator:\2,response:\3\}\}var (${ID})=${ID}\(\(\)=>\[`,
			"u",
		),
		expr: (m) =>
			`${m[4]}().map(r=>({request:r.request,originator:r.originator,response:r.response}))`,
	},
	byDescription(
		"stream-out",
		"Everything the CLI writes to its output stream",
		true,
	),
	byDescription(
		"stream-in",
		"Everything a client may write to the CLI's input stream",
		true,
	),
	byDescription(
		"agents-json",
		"Definition for a custom subagent that can be invoked via the Agent tool.",
	),
	{
		// The tool factory copies every property of a tool definition (getters included) onto the tool object it returns.
		// Patch its return to remember each tool, and import the modules that call it so they build their tools.
		kind: "tools",
		module: new RegExp(
			String.raw`function (${ID})\((\w)\)\{let (\w)=\2\.create,[\s\S]*?Object\.getOwnPropertyDescriptors\(\2\)\),\w\);return (\w)\}`,
			"u",
		),
		alsoImport: (m, moduleName) =>
			new RegExp(
				String.raw`import\{[^}]*(?<![\w$])${escapeRe(m[1] ?? "")}(?![\w$])[^}]*\}from"/\$bunfs/root/${escapeRe(moduleName)}"`,
				"u",
			),
		rewrite: (src) =>
			src.replace(
				/(Object\.getOwnPropertyDescriptors\(\w\)\),\w\);)return (\w)\}/u,
				"$1return(globalThis.__ccTools??=[]).push($2),$2}",
			),
		// A getter that throws (Artifact tools read config) is recorded as an error text instead of a schema.
		expr: () =>
			`(globalThis.__ccTools??[]).map(t=>{let r={name:t.name};for(const k of["inputSchema","outputSchema"]){try{r[k]=t[k]}catch(e){r[k+"Error"]=String(e).slice(0,200)}}return r})`,
	},
];
