// get_schema: a JSON Schema of the site, or the Mod API type file.
import { SCHEMA_NAMES, TYPE_NAMES } from "../content.ts";
import { type Source, sourceData, sourceLine } from "../fetcher.ts";
import { isRecord, present } from "../text.ts";
import { lookup, outline } from "../types.ts";
import { content, fail, guarded, ok, type Result } from "./shared.ts";

type Json = Record<string, unknown>;

const objectOr = (v: unknown): Json => (isRecord(v) ? v : {});

/** Follows a dotted path from a $defs name or the root through properties, then additionalProperties (a map's values), then items ("[]" also works). */
const walk = (schema: Json, path: string): Json | undefined => {
	let cur: Json = schema;
	const keys = path.split(".").filter((k) => k !== "");
	// A file made of definitions (tools, control protocol): the first key may name one.
	const defs = schema["$defs"];
	const first = keys[0];
	if (isRecord(defs) && first !== undefined && Object.hasOwn(defs, first)) {
		keys.shift();
		const def = defs[first];
		if (!isRecord(def)) {
			return undefined;
		}
		cur = def;
	}
	for (const key of keys) {
		if (key === "__proto__" || key === "constructor" || key === "prototype") {
			return undefined;
		}
		const props = cur["properties"];
		let next: unknown;
		if (isRecord(props) && Object.hasOwn(props, key)) {
			next = props[key];
		} else if (key === "[]") {
			next = cur["items"];
		} else {
			next = cur["additionalProperties"] ?? cur["items"];
		}
		if (!isRecord(next)) {
			return undefined;
		}
		cur = next;
	}
	return cur;
};

/** One 25k-character chunk of `out`, with a note that gives the next offset. */
const schemaPage = (
	name: string,
	property: string | undefined,
	out: string,
	offset: number,
	source: Source,
): Result => {
	const LIMIT = 25_000;
	if (offset >= out.length && out.length > 0) {
		return fail(
			`offset ${offset} is past the end (${out.length} characters).`,
			source,
		);
	}
	const chunk = out.slice(offset, offset + LIMIT);
	const end = offset + chunk.length;
	const note =
		end < out.length
			? `[chars ${offset}-${end} of ${out.length}; call again with offset=${end}]\n`
			: "";
	return ok(
		`${note}${chunk}\n\n${sourceLine(source)}`,
		{
			name,
			...(present(property) ? { property } : {}),
			offset,
			end,
			total: out.length,
			...(end < out.length ? { nextOffset: end } : {}),
			text: chunk,
			source: sourceData(source),
		},
		source,
	);
};

export interface SchemaArgs {
	name: string;
	property?: string | undefined;
	offset?: number;
}

const typeOf = (v: Json): string => {
	const t = v["type"];
	if (Array.isArray(t)) {
		return t.join("|");
	}
	if (typeof t === "string") {
		return t;
	}
	return Array.isArray(v["anyOf"]) ? "union" : "any";
};

const firstSentence = (v: Json): string | undefined => {
	const d = v["description"];
	return (typeof d === "string" ? d : "").split(/(?<=\.)\s/u)[0]?.slice(0, 140);
};

/** The overview of a whole schema: title, id, top-level properties, and definitions. */
const overview = (sch: Json): string => {
	const rows = Object.entries(objectOr(sch["properties"])).map(([k, v]) => {
		const first = firstSentence(objectOr(v));
		return `- ${k} (${typeOf(objectOr(v))})${present(first) ? `: ${first}` : ""}`;
	});
	const defs = Object.keys(objectOr(sch["$defs"]));
	const defList =
		defs.length > 0
			? `\n\n${defs.length} definitions (pass one as \`property\`): ${defs.join(", ")}`
			: "";
	return `${String(sch["title"])}\n$id: ${String(sch["$id"])}\n${rows.length} top-level properties. Pass \`property\` for details.\n\n${rows.join("\n")}${defList}`;
};

const typeFileResult = async (
	name: string,
	property: string | undefined,
	offset: number,
): Promise<Result> => {
	const got = await content.typeFile();
	if (got.status === "notfound") {
		return fail(`The type file was not found on ${got.origin}.`);
	}
	if (got.status === "error") {
		return fail(got.message);
	}
	if (!present(property)) {
		return schemaPage(name, property, outline(got.body), offset, got.source);
	}
	const found = lookup(got.body, property);
	if (found.kind === "missing") {
		return fail(
			`"${property}" is not in the type file, so its fields are unconfirmed for this release.${found.near.length > 0 ? ` Closest names in the file: ${found.near.join(", ")}. Look one of them up.` : " Call without `property` for the list of names."}`,
			got.source,
		);
	}
	return schemaPage(
		name,
		property,
		`// ${found.title}\n${found.text}`,
		offset,
		got.source,
	);
};

const jsonSchemaResult = async (
	name: string,
	property: string | undefined,
	offset: number,
): Promise<Result> => {
	const got = await content.schema(name);
	if (got === "unknown") {
		return fail(
			`Unknown schema "${name}". Valid names: ${SCHEMA_NAMES.join(", ")}, types`,
		);
	}
	if (got.status === "notfound") {
		return fail(`Schema "${name}" was not found on ${got.origin}.`);
	}
	if (got.status === "error") {
		return fail(got.message);
	}
	const { schema: sch, source } = got;
	if (!present(property)) {
		return schemaPage(name, property, overview(sch), offset, source);
	}
	const sub = walk(sch, property);
	if (!sub) {
		const keys = [
			...Object.keys(objectOr(sch["properties"])),
			...Object.keys(objectOr(sch["$defs"])),
		];
		return fail(
			`"${property}" is not in ${name}, so its fields are unconfirmed for this release. Its top-level properties and definitions: ${keys.join(", ")}. Look one of them up.`,
			source,
		);
	}
	return schemaPage(
		name,
		property,
		JSON.stringify(sub, null, 2),
		offset,
		source,
	);
};

export const schema = (args: SchemaArgs): Promise<Result> =>
	guarded(() => {
		const { name, property, offset = 0 } = args;
		if (TYPE_NAMES.some((t) => t === name)) {
			return typeFileResult(name, property, offset);
		}
		return jsonSchemaResult(name, property, offset);
	});
