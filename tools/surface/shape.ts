import { KINDS } from "../../inspect/mcp/src/surface/index.ts";

export const FIELDS = ["name", "default", "values", "gate", "detail"] as const;

export const cmp = (a: string, b: string) => {
	if (a < b) {
		return -1;
	}
	return a > b ? 1 : 0;
};

export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);

const itemProblems = (k: string, it: unknown, prev: string): string[] => {
	if (!isRecord(it) || typeof it["name"] !== "string" || !it["name"]) {
		return [`${k}: an item has no name`];
	}
	const name = it["name"];
	const bad: string[] = [];
	const extra = Object.keys(it).filter((f) => !FIELDS.some((x) => x === f));
	if (extra.length > 0) {
		bad.push(`${k}:${name}: unknown field ${extra.join(", ")}`);
	}
	for (const f of ["default", "gate", "detail"]) {
		if (it[f] !== undefined && typeof it[f] !== "string") {
			bad.push(`${k}:${name}: ${f} is not a string`);
		}
	}
	const values = it["values"];
	if (
		values !== undefined &&
		!(Array.isArray(values) && values.every((v) => typeof v === "string"))
	) {
		bad.push(`${k}:${name}: values is not a list of strings`);
	}
	if (cmp(prev, name) > 0) {
		bad.push(`${k}: not sorted at ${name}`);
	}
	return bad;
};

const kindProblems = (k: string, items: unknown): string[] => {
	const bad: string[] = [];
	if (!(k in KINDS)) {
		bad.push(`unknown kind "${k}"`);
	}
	if (!Array.isArray(items) || items.length === 0) {
		bad.push(`kind "${k}" is not a non-empty list`);
		return bad;
	}
	let prev = "";
	for (const it of items) {
		const found = itemProblems(k, it, prev);
		bad.push(...found);
		if (found[0]?.endsWith("an item has no name") === true) {
			break;
		}
		prev = isRecord(it) && typeof it["name"] === "string" ? it["name"] : prev;
	}
	return bad;
};

/** Problems with the shape of a parsed schemas/surface.json, or an empty list. */
export const validate = (data: unknown, version: string): string[] => {
	if (!isRecord(data)) {
		return ["not an object"];
	}
	const bad: string[] = [];
	if (data["version"] !== version) {
		bad.push(`names version ${String(data["version"])}, not ${version}`);
	}
	const kinds = data["kinds"];
	if (!isRecord(kinds)) {
		return [...bad, "kinds is not an object"];
	}
	const names = Object.keys(kinds);
	for (const k of Object.keys(KINDS)) {
		if (!names.includes(k)) {
			bad.push(`kind "${k}" missing`);
		}
	}
	for (const k of names) {
		bad.push(...kindProblems(k, kinds[k]));
	}
	return bad;
};
