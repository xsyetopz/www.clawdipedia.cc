// The version of a library that the program holds, and the published source of that version.
import { fetchPackage, linesAt, versionAt } from "../../inspect/mcp/src/npm.ts";
import {
	allText,
	type Ctx,
	type Found,
	reEscape,
	sorted,
} from "./audit-types.ts";

/** The ranges of a package that dependency lists in the bundle demand, with the place of the first. */
const rangesOf = (c: Ctx, name: string) => {
	const re = new RegExp(
		`"${reEscape(name)}":"([\\^~>=]+\\d+\\.\\d+\\.\\d+)"`,
		"gu",
	);
	const ranges = new Set<string>();
	let site = "";
	for (const m of allText(c)) {
		for (const h of m.text.matchAll(re)) {
			ranges.add(h[1] ?? "");
			if (site === "") {
				site = `${m.name}@${h.index}`;
			}
		}
	}
	return { ranges: sorted(ranges), site };
};

/** The user agent that a client builds from a version constant X. */
const USER_AGENTS: Record<string, RegExp> = {
	"@anthropic-ai/sdk": /Anthropic\/JS \$\{(\w+)\}/u,
	axios: /"axios\/"\+(\w+)/u,
};

/** The client sends its version in the user agent; X is a `var X="1.2.3"` in some module. */
const fromAgent = (c: Ctx, agent: RegExp): Omit<Found, "from"> | undefined => {
	for (const m of allText(c)) {
		const x = agent.exec(m.text)?.[1];
		if (x === undefined) {
			continue;
		}
		const decl = new RegExp(`var ${x}="(\\d+\\.\\d+\\.\\d+)";`, "u");
		for (const d of allText(c)) {
			const h = decl.exec(d.text);
			if (h?.[1] !== undefined) {
				return {
					version: h[1],
					source: `user-agent constant ${x} in ${d.name}@${h.index}`,
				};
			}
		}
	}
	return undefined;
};

/** An embedded package.json (`name`, `version`), zod's version object, or an exact pin in a dependency list. */
const fromText = (c: Ctx, name: string): Omit<Found, "from"> | undefined => {
	const q = reEscape(name);
	const exact = new RegExp(
		`name:"${q}",(?:description:"[^"]*",)?version:"(\\d[^"]*)"`,
		"u",
	);
	const pin = new RegExp(`"${q}":"(\\d+\\.\\d+\\.\\d+)"`, "u");
	for (const m of allText(c)) {
		if (!m.text.includes(name)) {
			continue;
		}
		const e = exact.exec(m.text)?.[1];
		if (e !== undefined) {
			return { version: e, source: `package.json in ${m.name}` };
		}
		const z =
			name === "zod"
				? /major:(\d+),minor:(\d+),patch:(\d+)/u.exec(m.text)
				: null;
		if (z) {
			return {
				version: z.slice(1, 4).join("."),
				source: `zod version object in ${m.name}@${z.index}`,
			};
		}
		const p = pin.exec(m.text)?.[1];
		if (p !== undefined) {
			return { version: p, source: `exact pin in ${m.name}` };
		}
	}
	return undefined;
};

/** A version the program states: an embedded package.json (`name`, `version`), an exact pin in a dependency list, or zod's version object. */
const embedded = (c: Ctx, name: string): Omit<Found, "from"> | undefined => {
	const agent = USER_AGENTS[name];
	const viaAgent = agent === undefined ? undefined : fromAgent(c, agent);
	return viaAgent ?? fromText(c, name);
};

/** The release time of the program: its BUILD_TIME constant. */
export const builtAt = (c: Ctx) => {
	for (const m of allText(c)) {
		const t = /BUILD_TIME:"(\d{4}-[^"]+)"/u.exec(m.text)?.[1];
		if (t !== undefined) {
			return t;
		}
	}
	throw new Error("no BUILD_TIME in the program");
};

/** A package that the registry does not know is not an error; any other failure is. */
export const gone = (e: Error): undefined => {
	if (!e.message.includes("HTTP 404")) {
		throw e;
	}
};

const dated = async (
	c: Ctx,
	name: string,
	given: string[],
): Promise<Found | undefined> => {
	const inBundle = rangesOf(c, name);
	const ranges = [...inBundle.ranges, ...given];
	const site =
		inBundle.site === "" ? "a dependent package.json" : inBundle.site;
	const v = await versionAt(name, builtAt(c), ranges).catch(gone);
	if (v === undefined) {
		return v;
	}
	// A bundled copy lags its dated pick by a minor or two, and a long major (AWS SDK v3 has hundreds of minors) costs one download per line.
	const lines =
		v.from === "range-max"
			? ranges.map((r) => r.replace(/^[\^~>=]+/u, ""))
			: await linesAt(name, builtAt(c), v.version.split(".")[0]);
	const recent = v.from === "range-max" ? lines : lines.slice(-4);
	const also = [...new Set(recent)].filter((a) => a !== v.version);
	also.reverse();
	return {
		version: v.version,
		from: v.from,
		source:
			v.from === "range-max"
				? `highest release in ${ranges.join(" ")} (${site}) published before the build`
				: "last release published before the build",
		also,
	};
};

/** The published source of a library at the version the program holds. `given` are ranges from the package.json of a package that depends on this one. */
export const library = async (c: Ctx, name: string, given: string[] = []) => {
	let known: Found | undefined = c.libraries[name];
	if (known === undefined) {
		const e = embedded(c, name);
		known =
			e === undefined
				? await dated(c, name, given)
				: { ...e, from: "embedded" };
	}
	if (known === undefined) {
		return known;
	}
	const pkg = await fetchPackage(name, known.version);
	c.libraries[name] = known;
	return { name, ...pkg, from: known.from };
};

const bundledScope = (c: Ctx, scope: string) => {
	const re = new RegExp(`"(${reEscape(scope)}[a-z0-9.-]+)":"`, "gu");
	const names = new Set<string>();
	for (const m of allText(c)) {
		for (const h of m.text.matchAll(re)) {
			names.add(h[1] ?? "");
		}
	}
	const kept = [...names].filter((n) => !/\/client-|\.$/u.test(n));
	// Client packages ship their own package.json object in the bundle.
	const clients = new RegExp(
		`name:"(${reEscape(scope)}client-[a-z0-9-]+)",description:`,
		"gu",
	);
	for (const m of allText(c)) {
		for (const h of m.text.matchAll(clients)) {
			kept.push(h[1] ?? "");
		}
	}
	return sorted(new Set(kept));
};

/** The libraries that the names stand for, and the names that no version was found for. */
export const packagesOf = async (c: Ctx, names: string[]) => {
	const list = names.flatMap((n) =>
		n.endsWith("/") ? bundledScope(c, n) : [n],
	);
	const out = await Promise.all(list.map((n) => library(c, n)));
	return {
		pkgs: out.filter((p) => p !== undefined),
		gaps: sorted(list.filter((n) => c.libraries[n] === undefined)),
	};
};
