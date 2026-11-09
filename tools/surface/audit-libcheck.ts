// The library check: whether the published source of a bundled library holds a text of the program.
import {
	dependenciesOf,
	fetchPackage,
	findText,
	linesAt,
} from "../../inspect/mcp/src/npm.ts";
import { builtAt, gone, library, packagesOf } from "./audit-npm.ts";
import { type Ctx, eachOf, firstOf, type Verdict } from "./audit-types.ts";

type Lib = NonNullable<Awaited<ReturnType<typeof library>>>;

interface Search {
	c: Ctx;
	text: string;
	exact: boolean;
	tried: string[];
}

const look = async (
	s: Search,
	name: string,
	version: string,
	from: string,
	dir: string,
): Promise<Verdict | undefined> => {
	const r = await findText(dir, s.text, s.exact);
	if (r.file === undefined) {
		s.tried.push(`${name}@${version} (${from})`);
		return undefined;
	}
	return {
		ok: true,
		evidence: {
			package: `${name}@${version}`,
			versionFrom: from,
			file: r.file,
			...(r.loose === true ? { match: "sentences in any order" } : {}),
		},
	};
};

/** The other releases that the program may hold. */
const alsoHit = (s: Search, p: Lib) =>
	firstOf(s.c.libraries[p.name]?.also ?? [], async (v) => {
		// A release in the time list can be gone from the registry.
		const pkg = await fetchPackage(p.name, v).catch(gone);
		return pkg === undefined ? undefined : look(s, p.name, v, "also", pkg.dir);
	});

const probe = async (s: Search, p: Lib) => {
	const hit = await look(s, p.name, p.version, p.from, p.dir);
	return hit ?? alsoHit(s, p);
};

/** The dependencies of a package, which the bundle names no version of. */
const expand = async (s: Search, p: Lib, seen: Set<string>, deps: Lib[]) =>
	eachOf(Object.entries(await dependenciesOf(p.dir)), async ([d, r]) => {
		if (seen.has(d) || !/^[\^~]?\d+\.\d+\.\d+$/u.test(r)) {
			return;
		}
		seen.add(d);
		const q = await library(s.c, d, [r]);
		if (q !== undefined) {
			deps.push(q);
		}
	});

/** Another major than the one the program holds may carry the text, e.g. a second copy of the library. */
const majorHit = async (s: Search, p: Lib) => {
	const lines = await linesAt(p.name, builtAt(s.c));
	return firstOf(
		lines.filter((v) => v !== p.version),
		async (v) => {
			// A release in the time list can be gone from the registry.
			const pkg = await fetchPackage(p.name, v).catch(gone);
			return pkg === undefined
				? undefined
				: look(s, p.name, v, "major-latest", pkg.dir);
		},
	);
};

/** Look for `text` in the published source of the libraries. */
export const libCheck = async (
	c: Ctx,
	names: string[],
	text: string,
	majors = true,
	exact = false,
): Promise<Verdict> => {
	const { pkgs, gaps } = await packagesOf(c, names);
	const s: Search = { c, text, exact, tried: [] };
	// The packages, the other releases they may be, then their own dependencies.
	const seen = new Set(pkgs.map((p) => p.name));
	const deps: Lib[] = [];
	const hit =
		(await firstOf(pkgs, async (p) => {
			const found = await probe(s, p);
			if (found === undefined) {
				await expand(s, p, seen, deps);
			}
			return found;
		})) ??
		(await firstOf(deps, (p) => probe(s, p))) ??
		(majors ? await firstOf(pkgs, (p) => majorHit(s, p)) : undefined);
	return hit ?? { ok: false, evidence: { notIn: s.tried, gaps } };
};
