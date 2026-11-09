// Runs inside the isolated child process started by generate.ts. Not meant to be run by hand.
// Usage: bun driver.ts <tmpRoot> <outFile>
// Imports the patched chunks (which fill globalThis.__ccSchemas), then calls each captured schema's own
// zod v4 toJSONSchema and writes the raw results as JSON.
import { join } from "node:path";

interface Manifest {
	modules: string[];
	kinds: string[];
	refKinds?: string[];
}
interface Zod {
	toJSONSchema: (opts: object) => unknown;
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
const isStringArray = (v: unknown): v is string[] =>
	Array.isArray(v) && v.every((x) => typeof x === "string");
const isManifest = (v: unknown): v is Manifest =>
	isRecord(v) &&
	isStringArray(v["modules"]) &&
	isStringArray(v["kinds"]) &&
	(v["refKinds"] === undefined || isStringArray(v["refKinds"]));
const isThunk = (v: unknown): v is () => unknown => typeof v === "function";
const isZod = (v: unknown): v is Zod =>
	typeof v === "object" &&
	v !== null &&
	"toJSONSchema" in v &&
	typeof v.toJSONSchema === "function";

const [root, outFile] = process.argv.slice(2);
if (root === undefined || outFile === undefined) {
	throw new Error("usage: bun driver.ts <tmpRoot> <outFile>");
}
const manifestJson: unknown = await Bun.file(
	join(root, "manifest.json"),
).json();
if (!isManifest(manifestJson)) {
	throw new Error("manifest.json is not a schema manifest");
}
const manifest = manifestJson;

/** Imports one chunk after another, because each chunk runs code that the next one may need. */
const importAll = async (mods: string[]): Promise<void> => {
	const [first, ...rest] = mods;
	if (first === undefined) {
		return;
	}
	await import(join(root, "root", first));
	await importAll(rest);
};
await importAll(manifest.modules);

const registryValue: unknown = Reflect.get(globalThis, "__ccSchemas");
const registry: Record<string, unknown> = isRecord(registryValue)
	? registryValue
	: {};
const out: Record<string, unknown> = {};
const lossy: string[] = [];
let current = "";

/** The type tag of a zod schema's definition. */
const defType = (schema: unknown): unknown => {
	const internals = isRecord(schema) ? schema["_zod"] : undefined;
	const def = isRecord(internals) ? internals["def"] : undefined;
	return isRecord(def) ? def["type"] : undefined;
};

const convert = (schema: Zod, reused: "inline" | "ref" = "inline") =>
	schema.toJSONSchema({
		target: "draft-2020-12",
		io: "input",
		reused,
		// Types JSON cannot express (undefined, transforms) become {} instead of aborting.
		unrepresentable: (ctx: { path: (string | number)[]; message: string }) => {
			lossy.push(`${current}: /${ctx.path.join("/")} ${ctx.message}`);
			// build.ts drops this marker from unions (an undefined arm means "may be absent"), else it stays {} (any).
			return { "x-cc-unrepresentable": true };
		},
		// The binary's own export drops these defaults too: a catch() fallback is not a documented default.
		override: (ctx: {
			zodSchema: unknown;
			jsonSchema: Record<string, unknown>;
		}) => {
			if (defType(ctx.zodSchema) === "catch") {
				delete ctx.jsonSchema["default"];
			}
		},
	});
// A capture may be a plain array or object that holds schemas (tool lists, tables): convert each one inside it.
// One schema that cannot be read or converted becomes { "x-cc-error": message } so the rest still come out.
const deep = (v: unknown, reused: "inline" | "ref"): unknown => {
	if (isZod(v)) {
		try {
			return convert(v, reused);
		} catch (error) {
			return { "x-cc-error": String(error).slice(0, 300) };
		}
	}
	if (Array.isArray(v)) {
		return v.map((x) => deep(x, reused));
	}
	if (typeof v === "object" && v !== null) {
		return Object.fromEntries(
			Object.entries(v).map(([k, x]) => [k, deep(x, reused)]),
		);
	}
	return v;
};
for (const kind of manifest.kinds) {
	const get = registry[kind];
	if (!isThunk(get)) {
		throw new Error(`schema "${kind}" was not captured`);
	}
	current = kind;
	const value = get();
	const reused = manifest.refKinds?.includes(kind) === true ? "ref" : "inline";
	out[kind] = isZod(value) ? convert(value, reused) : deep(value, reused);
}
await Bun.write(outFile, JSON.stringify({ schemas: out, lossy }));
// process.exit is banned, so the process ends when no timers or sockets from the chunks stay open.
process.exitCode = 0;
