// The verdict on one table row of a Mod API page, by the form of the row. See ../type-tables.ts.
import {
	aliasOf,
	headDoc,
	nested,
	normalizeType,
	type TypeField,
	typeFields,
	type TypeFile,
} from "./parse.ts";

/** The verdict on one row. */
export type Outcome =
	| { kind: "ok"; name: string; doc: string }
	| { kind: "bad"; text: string }
	| { kind: "skip"; text: string };

/** The heading a table sits under, and the members its rows name. */
export interface Section {
	heading: string | undefined;
	fields: TypeField[] | undefined;
	/** True for a render component: its rows may give the type as a leading `` `T` ``. */
	elements: boolean;
	seen: Set<string>;
	line: number;
}

/** One table row, split. */
export interface Row {
	first: string;
	typeCell: string;
	page: string;
}

const ok = (name: string, doc: string): Outcome => ({ kind: "ok", name, doc });
const bad = (text: string): Outcome => ({ kind: "bad", text });
const skip = (text: string): Outcome => ({ kind: "skip", text });

/** The member at a dotted path under `CoreEngineInterface`, such as `ui.notice`. */
const engineMember = (f: TypeFile, path: string[]): TypeField | undefined => {
	let fields = typeFields(f, "CoreEngineInterface") ?? [];
	let found: TypeField | undefined;
	for (const p of path) {
		found = fields.find((x) => x.name === p);
		if (!found) {
			return undefined;
		}
		fields = nested(f, found);
	}
	return found;
};

/** The props of render component `name`: its member of `RenderPropsOf`. */
export const propsOf = (f: TypeFile, name: string): TypeField[] | undefined => {
	const m = typeFields(f, "RenderPropsOf")?.find((x) => x.name === name);
	return m === undefined ? undefined : nested(f, m);
};

// The maps that key events by name: argument types, then result types.
const EVENT_MAPS = ["EngineEventOf", "OpEventOf"];
const RESULT_MAPS = ["EngineResultOf", "OpValueOf"];

const typeList = (xs: TypeField[]): string =>
	xs.map((x) => `\`${x.type}\``).join(" or ");

/** An event row: `ui.render`, with `Input \`T\`` and `Result \`U\`` in the last cell. */
const eventRow = (f: TypeFile, name: string, cell: string): Outcome => {
	const find = (maps: string[]) =>
		maps.flatMap((m) => typeFields(f, m)?.filter((x) => x.name === name) ?? []);
	const input = find(EVENT_MAPS);
	if (input.length === 0) {
		return bad(`event \`${name}\` is in no event map`);
	}
	// A page may spell out a named type: `{ key: string }` for `CancelNotifyArgs`.
	const same = (x: TypeField, w: string) =>
		x.type === normalizeType(w) || aliasOf(f, x.type) === normalizeType(w);
	const want = /\bInput `((?:[^`]|``)+)`/u.exec(cell)?.[1];
	if (want !== undefined && !input.some((x) => same(x, want))) {
		return bad(`${name}: input \`${want}\`, file has ${typeList(input)}`);
	}
	const result = /\bResult `((?:[^`]|``)+)`/u.exec(cell)?.[1];
	const results = find(RESULT_MAPS);
	if (result !== undefined && !results.some((x) => same(x, result))) {
		return bad(
			`${name}: result \`${result}\`, file has ${typeList(results) || "none"}`,
		);
	}
	return ok(name, input.map((x) => x.doc).join(" / "));
};

/** A call row such as `$.ui.notice`. */
const engineRow = (f: TypeFile, first: string): Outcome => {
	const m = engineMember(f, first.slice(2).split("."));
	return m
		? ok(first, m.doc)
		: bad(`\`${first}\` is not a member of the engine`);
};

/** An alias row: only `Alias of \`T\`.` with nothing added; "Alias of `T` plus …" is prose. */
const aliasRow = (f: TypeFile, first: string, alias: string): Outcome => {
	const has = aliasOf(f, first);
	if (has === undefined) {
		return bad(`\`${first}\`: the type file declares no such alias`);
	}
	return normalizeType(alias) === has
		? ok(first, headDoc(f, first))
		: bad(`\`${first}\`: alias of \`${alias}\`, file has \`${has}\``);
};

/** The type a member row gives: `Type: \`T\``, or a leading `` `T` `` in an element table. */
const rowType = (cell: string, elements: boolean): string | undefined =>
	/^Type: `((?:[^`]|``)+)`/u.exec(cell)?.[1] ??
	(elements ? /^`((?:[^`]|``)+)`[.,]/u.exec(cell)?.[1] : undefined);

/** A member row under a type heading. */
const memberRow = (
	s: Section & { heading: string; fields: TypeField[] },
	r: Row,
): Outcome => {
	const name = `${s.heading}.${r.first}`;
	// A union of object types repeats a name once per variant; a row matches any of them.
	const all = s.fields.filter((x) => x.name === r.first);
	if (all.length === 0) {
		return bad(`${name}: no such member`);
	}
	s.seen.add(r.first);
	const typed = rowType(r.typeCell, s.elements);
	if (typed === undefined) {
		// A row such as `onScreen` with "See above." names the member and leaves its type to the text.
		return skip(`${name}: member found; the row gives no type`);
	}
	const optional = /(?:^|\. |`, )[Oo]ptional[.,]/u.test(r.typeCell);
	const want = normalizeType(typed);
	// The pages write a nested object type as `object` and describe its members in the text.
	const same = (x: TypeField) =>
		want === x.type || (want === "object" && x.type.startsWith("{"));
	if (!all.some((x) => same(x))) {
		return bad(`${name}: type \`${typed}\`, file has ${typeList(all)}`);
	}
	if (!all.some((x) => same(x) && x.optional === optional)) {
		return bad(
			`${name}: ${optional ? "member is required" : "member is optional"}`,
		);
	}
	const doc = all
		.map((x) => x.doc)
		.filter(Boolean)
		.join(" / ");
	return ok(name, doc);
};

const ALIAS = /^(?:Generic )?[Aa]lias of `((?:[^`]|``)+)`(?:\.|$)/u;

const hasFields = (
	s: Section,
): s is Section & { heading: string; fields: TypeField[] } =>
	s.heading !== undefined && s.fields !== undefined;

/** The verdict on one row, by its form. */
export const rowOutcome = (f: TypeFile, s: Section, r: Row): Outcome => {
	if (r.first.startsWith("$.")) {
		return engineRow(f, r.first);
	}
	if (s.heading === undefined && /^[a-z]+\.\w+$/u.test(r.first)) {
		return eventRow(f, r.first, r.typeCell);
	}
	const alias = ALIAS.exec(r.typeCell)?.[1];
	if (s.heading === undefined && alias !== undefined) {
		return aliasRow(f, r.first, alias);
	}
	if (!hasFields(s)) {
		const where =
			s.heading === undefined
				? "a heading that names no type"
				: `\`${s.heading}\`, which is neither a declaration nor a render component`;
		return skip(`\`${r.first}\` under ${where}`);
	}
	return memberRow(s, r);
};
