// Usage: bun tools/schemas/check.ts   (also: bun run schemas:check, part of verify)
// Uses ajv (draft 2020-12, strict mode; only our own x-managed-only marker is declared).
// 1. Every schemas/*.json is a well-formed JSON Schema with the expected $id, and every file in FILES exists.
// 2. For each kind, fixtures/<kind>.good.json validates and fixtures/<kind>.bad.json is rejected.
//    A file made only of $defs (tools, control protocol, stream-json) has no root to validate against, so its
//    fixture names the definition: { "$def": "BashInput", "value": { ... } }.
import { readdir } from "node:fs/promises";
import { join } from "node:path";

import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020.js";

import { BASE_URL, CODE_FILES, FILES } from "./build.ts";

type Validate = ReturnType<Ajv2020["compile"]>;

const ROOT = join(import.meta.dir, "..", "..");
const ajv = new Ajv2020({ strict: true, strictTypes: false, allErrors: true });
addFormats(ajv);
// zod emits these two non-standard formats for startsWith()/endsWith() checks. Declared so strict mode accepts them; they are not enforced.
for (const f of ["starts_with", "ends_with"]) {
	ajv.addFormat(f, true);
}
ajv.addKeyword({ keyword: "x-managed-only", schemaType: "boolean" });
// Who sends a control-protocol message: client, agent, or both.
ajv.addKeyword({ keyword: "x-direction", schemaType: "string" });
// Markers of the schemas that code.ts writes: a type the code does not show, a key a probe saw,
// the OpenTelemetry signal kind, and a ~/.claude.json key a person may set.
for (const keyword of ["x-unverified", "x-observed", "x-user-settable"]) {
	ajv.addKeyword({ keyword, schemaType: "boolean" });
}
// The JSON types that real payloads had at a field the code gives no type (annotation, not enforced).
ajv.addKeyword({ keyword: "x-observed-type", schemaType: "array" });
ajv.addKeyword({ keyword: "x-otel-kind", schemaType: "string" });
const NAMES = [...Object.keys(FILES), ...CODE_FILES];
const problems: string[] = [];

const read = async (p: string): Promise<Record<string, unknown>> => {
	const json: unknown = await Bun.file(p).json();
	if (typeof json !== "object" || json === null || Array.isArray(json)) {
		throw new Error(`${p}: not a JSON object`);
	}
	return Object.fromEntries(Object.entries(json));
};

const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);

/** Validates one fixture against the schema (or the definition it names), and reports a wrong outcome. */
const checkFixture = async (
	f: string,
	kind: string,
	schema: Record<string, unknown>,
	check: Validate,
): Promise<void> => {
	const wantValid = f === `${kind}.good.json`;
	if (!wantValid && !f.startsWith(`${kind}.bad`)) {
		return;
	}
	const fixture = await read(join(import.meta.dir, "fixtures", f));
	let run: Validate | undefined = check;
	let value: unknown = fixture;
	const def = fixture["$def"];
	if (typeof def === "string") {
		run = ajv.getSchema(`${String(schema["$id"])}#/$defs/${def}`);
		value = fixture["value"];
		if (run === undefined) {
			problems.push(`fixtures/${f}: no definition ${def}`);
			return;
		}
	}
	const errs =
		run(value) === true
			? []
			: (run.errors ?? []).map(
					(e) => `${e.instancePath === "" ? "/" : e.instancePath} ${e.message}`,
				);
	if (wantValid && errs.length > 0) {
		problems.push(
			`fixtures/${f} should be valid: ${errs.slice(0, 3).join("; ")}`,
		);
	}
	if (!wantValid && errs.length === 0) {
		problems.push(`fixtures/${f} should be rejected but is valid`);
	}
};

/** Checks the fixtures of one schema: <kind>.good.json must validate; every <kind>.bad*.json must be rejected. */
const checkFixtures = async (
	kind: string,
	schema: Record<string, unknown>,
	check: Validate,
): Promise<void> => {
	const all = await readdir(join(import.meta.dir, "fixtures"));
	const names = all.filter((f) => f.startsWith(`${kind}.`));
	if (!names.includes(`${kind}.good.json`)) {
		problems.push(`fixtures/${kind}.good.json: missing`);
	}
	if (!names.some((f) => f.startsWith(`${kind}.bad`))) {
		problems.push(`fixtures/${kind}.bad.json: missing`);
	}
	await Promise.all(names.map((f) => checkFixture(f, kind, schema, check)));
};

const checkSchema = async (name: string): Promise<void> => {
	const file = join(ROOT, "schemas", name);
	if (!(await Bun.file(file).exists())) {
		problems.push(`schemas/${name}: missing (run "bun run schemas")`);
		return;
	}
	const schema = await read(file);
	if (schema["$id"] !== `${BASE_URL}/${name}`) {
		problems.push(`schemas/${name}: wrong $id ${String(schema["$id"])}`);
	}
	if (
		typeof schema["title"] !== "string" ||
		typeof schema["$comment"] !== "string"
	) {
		problems.push(`schemas/${name}: title or $comment missing`);
	}
	let check: Validate;
	try {
		check = ajv.compile(schema);
	} catch (error) {
		problems.push(
			`schemas/${name}: not a valid schema: ${errorMessage(error)}`,
		);
		return;
	}
	await checkFixtures(name.replace(/\.json$/u, ""), schema, check);
};

await Promise.all(NAMES.map((name) => checkSchema(name)));

if (problems.length > 0) {
	for (const p of problems) {
		console.error(`schemas:check: ${p}`);
	}
	process.exitCode = 1;
} else {
	console.info(`schemas:check: ${NAMES.length} schemas valid, fixtures behave`);
}
