// Writes llms.txt, llms-full.txt, llms-manifest.json, llms-search-index.json (design D6), and one .md per doc page
// into the build output (design: agent-access D1). Output is deterministic.
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import type { LoadContext, Plugin } from "@docusaurus/types";

import {
	SEARCH_INDEX_FILE,
	searchIndexJson,
} from "../../../plugin/mcp/src/search";
import { CLAUDE_CODE_VERSION } from "../../version";
import { convertBody } from "./convert";
import {
	collectPages,
	findVersion,
	makeResolver,
	type Page,
	type Site,
} from "./pages";

const TITLE = "Clawdipedia";
const OPTIONAL_SECTION = "System Prompts";
const oneLine = (s: string) => s.replaceAll(/\s+/gu, " ").trim();
const yaml = (s: string) => JSON.stringify(oneLine(s));

const renderPage = async (
	page: Page,
	site: Site,
	byRepoPath: Map<string, Page>,
): Promise<string> => {
	const raw = await readFile(join(site.siteDir, page.repoPath), "utf8");
	let body = convertBody(raw, makeResolver(page, byRepoPath, site.base));
	if (!/^# .+/mu.test(body.split(/^\s*(?:`{3}|~{3})/mu)[0] ?? "")) {
		body = `# ${page.doc.title}\n\n${body}`;
	}
	return [
		"---",
		`title: ${yaml(page.doc.title)}`,
		`description: ${yaml(page.doc.description)}`,
		`url: ${page.htmlUrl}`,
		`source: ${page.repoPath}`,
		"---",
		"",
		body,
		"",
	].join("\n");
};

const link = (p: Page) =>
	`- [${p.doc.title}](${p.mdUrl}): ${oneLine(p.doc.description)}`;

const renderLlmsTxt = (
	pages: Page[],
	base: string,
	schemaNames: string[],
): string => {
	const lines = [
		`# ${TITLE}`,
		"",
		`> Unofficial community docs for Claude Code ${CLAUDE_CODE_VERSION}, built from the official docs and the program itself. Not made by or tied to Anthropic. Each item is marked [Documented], [Undocumented], [Differs], [Gated], [Managed Only], [Experimental], [Deprecated], or [Caution].`,
		"",
		`Every page below is plain markdown with a small front matter block. The full text of all pages is in llms-full.txt. Pages track version ${CLAUDE_CODE_VERSION} only. For supported behavior, check the official docs first.`,
		"",
	];
	const sections = [...new Set(pages.map((p) => p.section))];
	for (const section of sections.filter((s) => s !== OPTIONAL_SECTION)) {
		lines.push(`## ${section}`, "");
		for (const page of pages.filter((p) => p.section === section)) {
			lines.push(link(page));
		}
		lines.push("");
	}
	lines.push(
		"## Machine-Readable Files",
		"",
		`- [llms-full.txt](${base}llms-full.txt): every page below as markdown, in sidebar order`,
		`- [llms-manifest.json](${base}llms-manifest.json): index of all pages as JSON`,
		...schemaNames.map((n) => `- [${n}](${base}schemas/${n}): JSON Schema`),
		"",
		"## Optional",
		"",
	);
	for (const page of pages.filter((p) => p.section === OPTIONAL_SECTION)) {
		lines.push(link(page));
	}
	lines.push("");
	return lines.join("\n");
};

const buildOutputs = (
	pages: Page[],
	files: Map<string, string>,
	llmsTxt: string,
): Map<string, string> => {
	const manifest = pages.map((p) => ({
		route: p.route,
		title: p.doc.title,
		description: oneLine(p.doc.description),
		section: p.section,
		md: p.mdUrl,
		url: p.htmlUrl,
	}));
	return new Map([
		...files,
		["llms.txt", llmsTxt],
		["llms-full.txt", pages.map((p) => files.get(p.mdPath)).join("\n")],
		["llms-manifest.json", `${JSON.stringify(manifest, null, 2)}\n`],
		[
			SEARCH_INDEX_FILE,
			searchIndexJson(
				CLAUDE_CODE_VERSION,
				pages.map((p) => ({
					route: p.route,
					title: p.doc.title,
					description: p.doc.description,
					text: files.get(p.mdPath) ?? "",
				})),
			),
		],
	]);
};

const writeOutputs = async (
	outDir: string,
	out: Map<string, string>,
): Promise<void> => {
	await Promise.all(
		[...out].map(async ([name, text]) => {
			const dest = join(outDir, name);
			await mkdir(dirname(dest), { recursive: true });
			await writeFile(dest, text);
		}),
	);
};

export const llmsTxtPlugin = (context: LoadContext): Plugin => {
	const { siteDir, siteConfig } = context;
	const site: Site = {
		siteDir,
		url: siteConfig.url,
		baseUrl: siteConfig.baseUrl,
		base: `${siteConfig.url}${siteConfig.baseUrl}`,
	};

	let loaded: Record<string, Record<string, unknown>> = {};

	return {
		name: "llms-txt",
		allContentLoaded({ allContent }) {
			loaded = allContent;
		},
		async postBuild({ outDir }) {
			const version = findVersion(loaded["docusaurus-plugin-content-docs"]);
			if (!version) {
				throw new Error("llms-txt: docs plugin content not found");
			}
			const pages = collectPages(version, site);
			const byRepoPath = new Map(pages.map((p) => [p.repoPath, p]));
			const rendered = await Promise.all(
				pages.map((page) => renderPage(page, site, byRepoPath)),
			);
			// Maps each mdPath to its content.
			const files = new Map(pages.map((p, i) => [p.mdPath, rendered[i] ?? ""]));
			const schemaFiles = await readdir(join(siteDir, "schemas"));
			const schemaNames = schemaFiles
				.filter((n) => n.endsWith(".json") && !n.startsWith("."))
				.toSorted();
			const out = buildOutputs(
				pages,
				files,
				renderLlmsTxt(pages, site.base, schemaNames),
			);
			await writeOutputs(outDir, out);
		},
	};
};
