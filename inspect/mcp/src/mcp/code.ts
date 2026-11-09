import { listInstalls, program } from "../binary.ts";
import { cut, lines as linesOf } from "../diff.ts";
import { findUnits } from "../find.ts";
import { fetchPackage, findText } from "../npm.ts";
import { prepared } from "../prepare.ts";
import { readable } from "../readable.ts";
import { clip, group, has, need, regex, text, WRITES_CACHE } from "./app.ts";
import { cli, runCode } from "./code-cli.ts";
import { CODE_DESCRIPTION, CODE_SHAPE } from "./code-schema.ts";

const npmVerdict = (r: Awaited<ReturnType<typeof findText>>) => {
	if (has(r.file)) {
		return `text found in ${r.file}`;
	}
	return r.short ? "text too short to name a package" : "text not found";
};

group(
	"code",
	CODE_DESCRIPTION,
	"action",
	{
		installs: async () => {
			const installs = await listInstalls();
			return text(
				installs.length > 0
					? installs
							.map(
								(i) =>
									`- ${i.version}${i.current ? " (current)" : ""}  ${i.path}`,
							)
							.join("\n")
					: "No Claude Code install found.",
				{ installs },
			);
		},
		modules: async ({ version, name }) => {
			const p = await program(version);
			const modules = p.modules
				.filter((m) => !has(name) || m.name.includes(name))
				.map((m) => ({ name: m.name, bytes: m.bytes.length }));
			return text(
				`${p.path}: ${modules.length} modules\n${modules.map((m) => `- ${m.name}  ${m.bytes} bytes`).join("\n")}`,
				{ path: p.path, modules },
			);
		},
		search: async ({
			query,
			regex: isRegex = false,
			module,
			version,
			context = 150,
			limit = 20,
		}) => {
			const re = new RegExp(regex(need(query, "query"), isRegex).source, "gu");
			const hits: { module: string; offset: number; snippet: string }[] = [];
			const { bundle } = await program(version);
			for (const m of bundle.modules.values()) {
				if (has(module) && !m.name.includes(module)) {
					continue;
				}
				for (const h of m.text.matchAll(re)) {
					hits.push({
						module: m.name,
						offset: h.index,
						snippet: m.text.slice(
							Math.max(0, h.index - context),
							h.index + h[0].length + context,
						),
					});
					if (hits.length >= limit) {
						break;
					}
				}
				if (hits.length >= limit) {
					break;
				}
			}
			return text(
				hits.length > 0
					? hits
							.map((h) => `- ${h.module}@${h.offset}: ${h.snippet}`)
							.join("\n\n")
					: `No match for ${re}.`,
				{ hits },
			);
		},
		read: async ({ module, offset = 0, length = 4000, version, view }) => {
			const p = await program(version);
			const mod = need(module, "module");
			const m =
				p.modules.find((x) => x.name.endsWith(`/${mod}`)) ??
				p.modules.find((x) => x.name === mod);
			if (!m) {
				throw new Error(`no module "${mod}" in ${p.path}`);
			}
			if (view !== undefined && view !== "readable") {
				throw new Error(`unknown view "${view}"; views: readable`);
			}
			if (view) {
				const t = await readable(version, m.name);
				const end = Math.min(t.length, offset + length);
				const slice = t.slice(offset, end);
				return text(
					`${m.name} (readable) [${offset}, ${end}) of ${t.length}\n${slice}`,
					{ module: m.name, view, offset, end, total: t.length, text: slice },
				);
			}
			const end = Math.min(m.source.length, offset + length);
			return text(
				`${m.name} [${offset}, ${end}) of ${m.source.length}\n${m.source.slice(offset, end)}`,
			);
		},
		find: async ({ query, version, limit = 10 }) => {
			const q = need(query, "query");
			const r = await prepared(version);
			const found = findUnits(r.index, q, Math.min(limit, 10)).map((f) => ({
				u: f.u,
				n: f.n,
				hits: f.hits,
				excerpt: linesOf(f.u.t)
					.slice(0, 4)
					.map((line) => cut(line)),
			}));
			return text(
				found.length > 0
					? `${r.index.version}: top ${found.length} for "${clip(q, 100)}"\n${found
							.map(
								({ u, n, hits, excerpt }) =>
									`## ${u.k}  ${u.m}:${u.s}  score ${n} (${hits.join(", ")})\n${excerpt.join("\n")}`,
							)
							.join("\n\n")}`
					: `No unit holds a word of "${clip(q, 100)}".`,
				{
					found: found.map(({ u, n, hits, excerpt }) => ({
						label: u.k,
						module: u.m,
						offset: u.s,
						score: n,
						hits,
						excerpt,
					})),
				},
			);
		},
		run: runCode,
		cli,
		npm: async ({ name, packageVersion, query }) => {
			const pkg = await fetchPackage(need(name, "name"), packageVersion);
			const r = await findText(pkg.dir, need(query, "query"));
			return text(`${name}@${pkg.version}: ${npmVerdict(r)}`, {
				package: name,
				version: pkg.version,
				...r,
			});
		},
		prepare: async ({ version }) => {
			const r = await prepared(version);
			const skipped = Object.keys(r.index.skipped);
			return text(
				`${r.index.version}: ${r.parsed ? `${r.parsed} modules cleaned` : "read from the cache"}, ${r.index.units.length} units, ${r.ms} ms -> ${r.dir}${skipped.length > 0 ? `\nNot JavaScript: ${skipped.join(", ")}` : ""}`,
				{
					dir: r.dir,
					version: r.index.version,
					parsed: r.parsed,
					units: r.index.units.length,
					skipped,
					ms: r.ms,
				},
			);
		},
	},
	CODE_SHAPE,
	{ ...WRITES_CACHE, openWorldHint: true },
);
