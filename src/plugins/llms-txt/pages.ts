// Reads the docs plugin content and the sidebar into an ordered list of pages.
import { posix } from "node:path";

interface Doc {
	id: string;
	title: string;
	description: string;
	permalink: string;
	source: string;
}
interface SidebarItem {
	type: string;
	id?: string;
	label?: string;
	items?: SidebarItem[];
	link?: { type: string; id?: string };
}
interface Version {
	docs: Doc[];
	sidebars: Record<string, SidebarItem[]>;
}

export interface Page {
	doc: Doc;
	section: string;
	route: string;
	mdPath: string;
	htmlUrl: string;
	mdUrl: string;
	/** Repo-relative source path, such as docs/start/how-to-read.md. */
	repoPath: string;
}

export interface Site {
	siteDir: string;
	url: string;
	baseUrl: string;
	/** Site URL plus base URL, ending in a slash. */
	base: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isVersion = (value: unknown): value is Version =>
	isRecord(value) &&
	Array.isArray(value["docs"]) &&
	isRecord(value["sidebars"]);

export const findVersion = (content: unknown): Version | undefined => {
	if (!isRecord(content)) {
		return undefined;
	}
	const preset = content["default"];
	if (!isRecord(preset)) {
		return undefined;
	}
	const versions = preset["loadedVersions"];
	if (!Array.isArray(versions)) {
		return undefined;
	}
	const first: unknown = versions[0];
	return isVersion(first) ? first : undefined;
};

// Walks the sidebar: pages in order, tagged with their top-level section.
export const collectPages = (version: Version, site: Site): Page[] => {
	const docs = new Map(version.docs.map((d) => [d.id, d]));
	const pages: Page[] = [];
	const seen = new Set<string>();
	const add = (id: string | undefined, section: string) => {
		const doc = id === undefined ? undefined : docs.get(id);
		if (!doc || seen.has(doc.id)) {
			return;
		}
		seen.add(doc.id);
		const route =
			doc.permalink.slice(site.baseUrl.length - 1).replace(/\/$/u, "") || "/";
		const mdPath = route === "/" ? "index.md" : `${route.slice(1)}.md`;
		pages.push({
			doc,
			section,
			route,
			mdPath,
			htmlUrl: `${site.url}${doc.permalink}`,
			mdUrl: `${site.base}${mdPath}`,
			repoPath: doc.source.replace(/^@site\//u, ""),
		});
	};
	const walk = (items: SidebarItem[], section?: string) => {
		for (const item of items) {
			if (item.type === "doc") {
				add(item.id, section ?? "Overview");
			} else if (item.type === "category") {
				const own = section ?? item.label ?? "Docs";
				if (item.link?.type === "doc") {
					add(item.link.id, own);
				}
				walk(item.items ?? [], own);
			}
		}
	};
	walk(version.sidebars["docs"] ?? []);
	for (const d of version.docs) {
		add(d.id, "Docs");
	}
	return pages;
};

export const makeResolver =
	(page: Page, byRepoPath: Map<string, Page>, base: string) =>
	(target: string): string | null => {
		// A site-absolute link (a category page has no .md) becomes the full page URL.
		if (/^\/(?!\/)/u.test(target)) {
			return `${base}${target.slice(1)}`;
		}
		if (/^[a-z][a-z0-9+.-]*:|^#|^\//u.test(target)) {
			return null;
		}
		const [file = "", hash] = target.split("#");
		if (/\.(?!mdx?$)\w+$/u.test(posix.basename(file))) {
			return null;
		}
		const joined = posix.join(posix.dirname(page.repoPath), file);
		const dest = [joined, `${joined}.md`, `${joined}.mdx`, `${joined}/index.md`]
			.map((c) => byRepoPath.get(c))
			.find((d) => d !== undefined);
		if (!dest) {
			throw new Error(
				`llms-txt: ${page.repoPath} links to unknown doc ${target}`,
			);
		}
		return hash === undefined || hash === ""
			? dest.mdUrl
			: `${dest.mdUrl}#${hash}`;
	};
