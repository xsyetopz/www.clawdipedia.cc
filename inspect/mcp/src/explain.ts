// `release` `explain`: where a name lives in a prepared install (`prepare.ts`), and who calls it, when it runs, and how.
import { cut, lines, NAME, namesOf, parentsOf } from "./diff.ts";
import type { Index, Unit } from "./prepare.ts";

export type How = "no-op" | "stub" | "handled";
export interface Explained {
	holder: Unit;
	/** `unit` when a literal, key, or read names it; `text` when only a search of the code text found it */
	via: "unit" | "text";
	/** other units that hold the name, as `module:offset` */
	others: string[];
	/** the holder's cleaned code, capped */
	what: string[];
	/** units that use the holder's names, as `label module:offset` */
	who: string[];
	when: { gates: string[]; env: string[]; isEnabled?: string };
	/** each function of the holder, with how it behaves */
	how: { label: string; at: number; how: How; value?: string | undefined }[];
}

const CONST = String.raw`(?:!0|!1|null|void 0|""|-?\d+(?:\.\d+)?|\[\]|\{\}|"(?:[^"\\]|\\.)*")`;
const HEAD = String.raw`^(?:async )?(?:function\*? ?[\w$]*)?\([^)]*\)`;
const NOOP = [
	// `=>{}` is an empty body, not an object.
	new RegExp(`${HEAD}=>\\{\\}$`, "u"),
	new RegExp(`${HEAD}=>\\(?(${CONST})?\\)?$`, "u"),
	new RegExp(`${HEAD}(?:=>)?\\{(?:return ?(${CONST}))?;?\\}$`, "u"),
];
const GUARD = String.raw`if\([^{}]*\)(?:return ?${CONST}|throw [^;{}]*);?`;
const STUB = new RegExp(
	`${HEAD}(?:=>)?\\{(?:${GUARD})*(?:throw [^;{}]*|return ?(${CONST}));?\\}$`,
	"u",
);
const SHOW: Record<string, string> = {
	"!0": "true",
	"!1": "false",
	"void 0": "undefined",
};

/** `no-op` returns a constant only; `stub` throws, or returns a constant after checks; `handled` is anything else. */
export const howOf = (t: string): { how: How; value?: string | undefined } => {
	for (const re of NOOP) {
		const m = re.exec(t);
		if (m) {
			return { how: "no-op", value: SHOW[m[1] ?? "void 0"] ?? m[1] };
		}
	}
	const s = STUB.exec(t);
	if (s && (s[1] === undefined || /throw |if\(/u.test(t))) {
		return {
			how: "stub",
			...(s[1] !== undefined && { value: SHOW[s[1]] ?? s[1] }),
		};
	}
	return { how: "handled" };
};

const DECL =
	/(?:^|,|var |let |const |function\*? ?|class )(\$[0-9a-f]{6}(?:_\d+)?)(?=[=({ ])/gu;
const isFnLabel = (k: string) => !/^[A-Z]/u.test(k);
const ENV_SHAPED = /^[A-Z][A-Z0-9_]{2,}$/u;
const quote = (s: string) =>
	s.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const FN_NAME = /name:(\$[0-9a-f]{6}(?:_\d+)?)/gu;

type Names = ReturnType<typeof namesOf>;
interface Hit {
	u: Unit;
	score?: number;
}

/** The units that hold `name`, best first, and whether a literal, key, or read named it or only a text search found it. */
const findHits = (
	ix: Index,
	names: Names,
	name: string,
): { via: "unit" | "text"; hits: Hit[] } => {
	const bare = name.replace(/^\//u, "");
	const lits = new Set([JSON.stringify(name), JSON.stringify(bare)]);
	// A flag literal carries its dashes and may carry a placeholder, such as "--name <value>".
	const flag = `"--${name.replace(/^-{1,2}/u, "")}`;
	const isFlag = (x: string) =>
		x === `${flag}"` || x.startsWith(`${flag} `) || x.startsWith(`${flag}=`);
	// An env-shaped name is also an identifier key (`NAME:`) or a member read (`i.NAME`).
	const envShaped = ENV_SHAPED.test(name);
	const member = `.${name}`;
	const read = new RegExp(`\\.${quote(name)}(?![\\w$])`, "u");
	const reads = (u: Unit) => envShaped && read.test(u.t);
	// Names whose value is the string, such as a tool's `name:$a1b2c3`.
	const refs = new Set([...names.holding(name), ...names.holding(bare)]);
	const refers = (u: Unit) =>
		refs.size > 0 &&
		[...u.t.matchAll(NAME)].some(([h]) => refs.has(`${u.m}|${h}`));
	const named = (u: Unit) =>
		[...lits].some((l) => u.t.includes(`name:${l}`)) ||
		[...u.t.matchAll(FN_NAME)].some(([, h]) => refs.has(`${u.m}|${h}`));
	// A unit that reads the name outranks one that only lists it, such as an env pass-through set.
	const unitHits = ix.units
		.filter(
			(u) =>
				u.f.some(
					(x) => lits.has(x) || isFlag(x) || (envShaped && x === member),
				) || refers(u),
		)
		.map((u) => ({
			u,
			score: (reads(u) ? 4 : 0) + (named(u) ? 2 : 0) + (u.f.length > 3 ? 1 : 0),
		}))
		.toSorted((a, b) => b.score - a.score || b.u.f.length - a.u.f.length);
	if (unitHits.length > 0) {
		return { via: "unit", hits: unitHits };
	}
	const word = new RegExp(`(?<![\\w$-])${quote(name)}(?![\\w$-])`, "u");
	return {
		via: "text",
		hits: ix.units.filter((u) => word.test(u.t)).map((u) => ({ u })),
	};
};

const inside = (u: Unit, holder: Unit) => u.s >= holder.s && u.e <= holder.e;

/** The units that use a name the holder declares, as `label module:offset`. */
const usersOf = (ix: Index, names: Names, holder: Unit): string[] => {
	const declared = [...holder.t.matchAll(DECL)].flatMap(([, h]) =>
		h === undefined ? [] : [h],
	);
	const users = declared.flatMap((h) => names.aliases(`${holder.m}|${h}`));
	return [
		...new Set(
			users.flatMap((k) => {
				const [m = "", h = ""] = k.split("|");
				const re = new RegExp(
					`${h.replace("$", String.raw`\$`)}(?![\\w])`,
					"u",
				);
				return ix.units
					.filter(
						(u) =>
							u.m === m &&
							u.k !== "ImportDeclaration" &&
							!u.t.startsWith("export{") &&
							!(u.m === holder.m && inside(u, holder)) &&
							re.test(u.t),
					)
					.map((u) => `${u.k} ${u.m}:${u.s}`);
			}),
		),
	];
};

/** The `tengu_` gates and the env names that the holder, its inner units, and the small functions it calls use. */
const gatesAndEnv = (
	units: Unit[],
	holder: Unit,
	names: Names,
): { gates: string[]; env: string[] } => {
	const mod = units.filter((u) => u.m === holder.m);
	const own = [holder, ...mod.filter((u) => u !== holder && inside(u, holder))];
	const small = own.flatMap((u) =>
		[...u.t.matchAll(NAME)].flatMap(([h]) => {
			const f = names.fn(u.m, h);
			return f && f.f.length <= 3 ? [f] : [];
		}),
	);
	const all = [...own, ...small];
	const strings = new Set(
		all.flatMap((u) => u.f.filter((x) => x.startsWith('"'))),
	);
	const env = new Set(
		all
			.filter((u) => u.f.includes(".env"))
			.flatMap((u) =>
				u.f
					.filter((x) => /^\.[A-Z][A-Z0-9_]{2,}$/u.test(x))
					.map((x) => x.slice(1)),
			),
	);
	return {
		gates: [...strings].filter((x) => x.startsWith('"tengu_')),
		env: [...env],
	};
};

const howEntry = (u: Unit): Explained["how"][number] => {
	const h = howOf(u.t);
	const base = { label: u.k, at: u.s, how: h.how };
	return h.value === undefined ? base : { ...base, value: h.value };
};

/** Explains the unit that holds `name` (a string, a command such as `/loops`, or a tool name), or undefined. */
export const explain = (
	ix: Index,
	name: string,
	cap = 40,
): Explained | undefined => {
	const names = namesOf(ix);
	const { via, hits } = findHits(ix, names, name);
	const holder = hits[0]?.u;
	if (!holder) {
		return undefined;
	}
	const mod = ix.units.filter((u) => u.m === holder.m);
	const parent = parentsOf(mod);
	const at = mod.indexOf(holder);
	const direct = mod.filter((_, i) => parent[i] === at);
	const enabled = direct.find((u) => u.k === "isEnabled");
	const all = lines(holder.t).map((l) => cut(l));
	return {
		holder,
		via,
		others: hits.slice(1, 6).map(({ u }) => `${u.m}:${u.s}`),
		what:
			all.length > cap
				? [...all.slice(0, cap), `… ${all.length - cap} more lines`]
				: all,
		who: usersOf(ix, names, holder),
		when: {
			...gatesAndEnv(ix.units, holder, names),
			...(enabled && { isEnabled: enabled.t }),
		},
		how: (isFnLabel(holder.k) ? [holder, ...direct] : direct)
			.filter((u) => isFnLabel(u.k))
			.map((u) => howEntry(u)),
	};
};
