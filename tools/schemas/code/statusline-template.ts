// The statusline-setup prompt template: types and descriptions the code does not show.
import { splitTop } from "../jsparse.ts";
import { group, idx, type Json, props, type Src, UNVERIFIED } from "./ctx.ts";

interface TNode {
	type?: string;
	comment: string;
	nullable: boolean;
	children?: Map<string, TNode>;
}

/** One `"key": type // comment` line of the template, or undefined for a line that is not one. */
const templateEntry = (
	t: string,
): { key: string; value: string; comment: string } | undefined => {
	const m = /^"([\w.-]+)":\s*(.*)$/u.exec(t);
	if (!m) {
		return undefined;
	}
	const [value = "", ...rest] = group(m, 2).split("//");
	return {
		key: group(m, 1),
		value: value.trim().replace(/,$/u, "").trim(),
		comment: rest.join("//").trim(),
	};
};

/** The JSON template in the statusline-setup agent prompt: type text and comment of each path. */
export const parseTemplate = (src: Src): TNode => {
	const start = idx(
		src,
		"The statusLine command will receive the following JSON input via stdin:",
	);
	const lines = src.text.slice(start).split("\n").slice(1);
	const root: TNode = { comment: "", nullable: false, children: new Map() };
	const stack: TNode[] = [root];
	let started = false;
	for (const line of lines) {
		const t = line.trim();
		if (!started) {
			if (t === "{") {
				started = true;
			}
			continue;
		}
		if (t.startsWith("}")) {
			const closed = stack.pop();
			if (closed && /\|\s*null/u.test(t)) {
				closed.nullable = true;
			}
			if (stack.length === 0) {
				break;
			}
			continue;
		}
		const entry = templateEntry(t);
		if (!entry) {
			continue;
		}
		const node: TNode = { comment: entry.comment, nullable: false };
		stack.at(-1)?.children?.set(entry.key, node);
		if (entry.value === "{") {
			node.children = new Map();
			stack.push(node);
		} else {
			node.type = entry.value;
		}
	}
	return root;
};

const templateAtom = (a: string): Json | undefined => {
	if (a === '"string"') {
		return { type: "string" };
	}
	if (a === "number") {
		return { type: "number" };
	}
	if (a === "boolean") {
		return { type: "boolean" };
	}
	if (a === "null") {
		return { type: "null" };
	}
	if (a === '["string"]') {
		return { type: "array", items: { type: "string" } };
	}
	if (/^\{ "string": number \}$/u.test(a)) {
		return { type: "object", additionalProperties: { type: "number" } };
	}
	if (/^"[^"]+"$/u.test(a)) {
		return { const: a.slice(1, -1) };
	}
	return undefined;
};

const templateType = (text: string): Json => {
	const alts = splitTop(text, "|").map((a) => a.trim());
	const ok: Json[] = [];
	for (const a of alts) {
		const p = templateAtom(a);
		if (p === undefined) {
			return { ...UNVERIFIED };
		}
		ok.push(p);
	}
	const [first] = ok;
	if (ok.length === 1 && first !== undefined) {
		return first;
	}
	if (ok.every((p) => "const" in p || p["type"] === "null")) {
		const consts = ok.filter((p) => "const" in p).map((p) => p["const"]);
		return ok.some((p) => p["type"] === "null")
			? { enum: [...consts, null] }
			: { enum: consts };
	}
	return { anyOf: ok };
};

const has = (v: unknown): boolean =>
	v !== undefined && v !== null && v !== false && v !== "" && v !== 0;

/** The schema a template child resolves to: the code's own, or one made from the template. */
const resolveChild = (found: Json | undefined, child: TNode): Json => {
	if (found === undefined) {
		return child.children === undefined
			? templateType(child.type ?? "")
			: { type: "object", properties: {} };
	}
	if (child.children === undefined && has(found["x-unverified"])) {
		return {
			...templateType(child.type ?? ""),
			...(has(found["x-observed"]) ? { "x-observed": true } : {}),
		};
	}
	return found;
};

const mergeChild = (
	p: Record<string, Json>,
	k: string,
	child: TNode,
	at: string,
	codeOnly: string[],
	tmplOnly: string[],
): void => {
	const cur = resolveChild(p[k], child);
	p[k] = cur;
	if (child.comment !== "") {
		cur["description"] = child.comment;
	}
	if (child.children === undefined) {
		return;
	}
	if (child.nullable) {
		const inner: Json = { ...cur };
		delete inner["description"];
		p[k] = {
			description: child.comment === "" ? undefined : child.comment,
			anyOf: [inner, { type: "null" }],
		};
		mergeTemplate(inner, child, at, codeOnly, tmplOnly);
	} else {
		mergeTemplate(cur, child, at, codeOnly, tmplOnly);
	}
};

/** Fill types and descriptions from the template, and report paths that only one side has. A template-only key is left out. */
export const mergeTemplate = (
	schema: Json,
	node: TNode,
	path: string,
	codeOnly: string[],
	tmplOnly: string[],
) => {
	const viaVariable = schema["x-unverified"] === true;
	delete schema["x-unverified"];
	if (!has(schema["type"]) && !has(schema["anyOf"])) {
		schema["type"] = "object";
	}
	const p = props(schema);
	for (const [k, child] of node.children ?? []) {
		const at = path === "" ? k : `${path}.${k}`;
		// The code builds this object from a literal without the key, so the program never sends it.
		if (p[k] === undefined && !viaVariable) {
			tmplOnly.push(at);
			continue;
		}
		mergeChild(p, k, child, at, codeOnly, tmplOnly);
	}
	const kids = node.children;
	if (kids !== undefined && !viaVariable) {
		for (const k of Object.keys(p)) {
			if (!kids.has(k)) {
				codeOnly.push(path === "" ? k : `${path}.${k}`);
			}
		}
	}
	schema["properties"] = p;
};
