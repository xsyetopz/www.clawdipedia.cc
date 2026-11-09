// Checks the llms.txt output (design: agent-access D1). Run after `bun run build`:
//   bun tools/llms/check.ts
// 1. Every link in llms.txt resolves to a file in build/.
// 2. Every docs/**/*.md(x) page has a built .md page, a manifest entry, and a link in llms.txt.
// 3. llms-full.txt holds every page, and each page file starts with front matter.
import { join, relative } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const BUILD = join(ROOT, "build");
const BASE = "https://clawdipedia.cc/";
const problems: string[] = [];
const fail = (m: string) => problems.push(m);

const read = async (name: string): Promise<string> => {
	const file = Bun.file(join(BUILD, name));
	if (!(await file.exists())) {
		fail(`missing build/${name} (run \`bun run build\` first)`);
		return "";
	}
	return file.text();
};

const walk = async (dir: string): Promise<string[]> => {
	const out: string[] = [];
	for await (const name of new Bun.Glob("**/*.{md,mdx}").scan({
		cwd: dir,
		absolute: true,
	})) {
		out.push(name);
	}
	return out;
};

interface ManifestEntry {
	route: string;
	md: string;
	url: string;
}

const isEntry = (v: unknown): v is ManifestEntry =>
	typeof v === "object" &&
	v !== null &&
	"route" in v &&
	typeof v.route === "string" &&
	"md" in v &&
	typeof v.md === "string" &&
	"url" in v &&
	typeof v.url === "string";

const readManifest = async (): Promise<ManifestEntry[]> => {
	try {
		const parsed: unknown = JSON.parse(
			(await read("llms-manifest.json")) || "[]",
		);
		return Array.isArray(parsed)
			? parsed.filter((e: unknown) => isEntry(e))
			: [];
	} catch {
		fail("llms-manifest.json is not valid JSON");
		return [];
	}
};

const checkLinks = async (links: (string | undefined)[]): Promise<void> => {
	await Promise.all(
		links.map(async (url) => {
			if (url === undefined || !url.startsWith(BASE)) {
				fail(`llms.txt link outside ${BASE}: ${url}`);
				return;
			}
			if (!(await Bun.file(join(BUILD, url.slice(BASE.length))).exists())) {
				fail(`llms.txt link does not resolve to a built file: ${url}`);
			}
		}),
	);
};

/** Check one manifest page; return its source path, if the front matter has one. */
const checkEntry = async (
	entry: ManifestEntry,
	links: (string | undefined)[],
	full: string,
): Promise<string | undefined> => {
	const file = entry.md.slice(BASE.length);
	const text = await read(file);
	const m =
		/^---\ntitle: .*\ndescription: .*\nurl: (.*)\nsource: (.*)\n---\n/u.exec(
			text,
		);
	if (!m) {
		fail(`build/${file} has no valid front matter`);
		return undefined;
	}
	if (m[1] !== entry.url) {
		fail(`build/${file}: url differs from the manifest`);
	}
	const prose = text
		.replaceAll(/^\s*(`{3,}|~{3,})[\s\S]*?^\s*\1.*$/gmu, "")
		.replaceAll(/(`+)[^`][\s\S]*?\1/gu, "");
	const jsx = /<[A-Z]\w*[ />]/u.exec(prose);
	if (jsx) {
		fail(`build/${file} keeps a JSX tag: ${jsx[0]}`);
	}
	for (const link of prose.matchAll(/\]\(([^)\s]+)/gu)) {
		const target = link[1] ?? "";
		if (!/^(https?:|mailto:|#)/u.test(target)) {
			fail(`build/${file} keeps a relative link: ${target}`);
		}
	}
	if (!links.includes(entry.md)) {
		fail(`llms.txt misses ${entry.md}`);
	}
	if (!full.includes(`\nurl: ${entry.url}\nsource: ${m[2]}\n`)) {
		fail(`llms-full.txt misses ${entry.url}`);
	}
	return m[2] === undefined || m[2] === "" ? undefined : m[2];
};

const checkDocs = async (sources: Set<string>): Promise<void> => {
	const pages = await walk(join(ROOT, "docs"));
	await Promise.all(
		pages.map(async (path) => {
			const rel = relative(ROOT, path).split("\\").join("/");
			// Docusaurus leaves draft pages out of production builds
			const draft = /^---\n[\s\S]*?^draft: true$/mu.test(
				await Bun.file(path).text(),
			);
			if (!sources.has(rel) && !draft) {
				fail(`${rel} has no page in the llms output`);
			}
		}),
	);
};

const main = async (): Promise<void> => {
	const llms = await read("llms.txt");
	if (problems.length > 0) {
		console.error(`llms:check  ${problems[0]}`);
		process.exitCode = 1;
		return;
	}
	const full = await read("llms-full.txt");
	const manifest = await readManifest();
	const links = [...llms.matchAll(/^- \[[^\]]+\]\(([^)]+)\)/gmu)].map(
		(m) => m[1],
	);
	await checkLinks(links);
	const found = await Promise.all(
		manifest.map((entry) => checkEntry(entry, links, full)),
	);
	const sources = new Set<string>();
	for (const source of found) {
		if (source !== undefined) {
			sources.add(source);
		}
	}
	await checkDocs(sources);
	if (problems.length > 0) {
		for (const p of problems) {
			console.error(`llms:check  ${p}`);
		}
		console.error(`\n${problems.length} problem(s).`);
		process.exitCode = 1;
		return;
	}
	console.info(
		`llms:check ok: ${manifest.length} pages, ${links.length} links.`,
	);
};

await main();
