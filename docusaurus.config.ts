import { cp } from "node:fs/promises";
import { basename, join } from "node:path";

import type * as Preset from "@docusaurus/preset-classic";
import type { Config, LoadContext, Plugin } from "@docusaurus/types";
import { themes as prismThemes } from "prism-react-renderer";

import { llmsTxtPlugin } from "./src/plugins/llms-txt";
import { rehypeCodeWbr } from "./src/plugins/rehype/code-wbr";
import { rehypeTableMarks } from "./src/plugins/rehype/table-marks";
import { CLAUDE_CODE_VERSION } from "./src/version";

const REPO = "https://github.com/xsyetopz/www.clawdipedia.cc";
const DISCLAIMER = "Unofficial. Not made by or tied to Anthropic.";

// Serves schemas/ at <baseUrl>schemas/ so the $id and $schema URLs resolve after deploy.
// Dotfiles, such as the oxlint config, are tooling and stay unpublished.
const schemasPlugin = ({ siteDir }: LoadContext): Plugin => ({
	name: "serve-schemas",
	async postBuild({ outDir }) {
		await cp(join(siteDir, "schemas"), join(outDir, "schemas"), {
			recursive: true,
			filter: (src) => !basename(src).startsWith("."),
		});
	},
});

const config: Config = {
	title: "Clawdipedia",
	tagline: DISCLAIMER,
	favicon: "img/logo.svg",
	url: "https://clawdipedia.cc",
	baseUrl: "/",
	organizationName: "xsyetopz",
	projectName: "clawdipedia",
	trailingSlash: false,

	onBrokenLinks: "throw",
	onBrokenAnchors: "throw",

	customFields: { claudeCodeVersion: CLAUDE_CODE_VERSION },

	i18n: { defaultLocale: "en", locales: ["en"] },

	markdown: {
		mermaid: true,
		hooks: {
			onBrokenMarkdownLinks: "throw",
			onBrokenMarkdownImages: "throw",
		},
	},

	themes: [
		"@docusaurus/theme-mermaid",
		[
			"@easyops-cn/docusaurus-search-local",
			{
				hashed: true,
				docsRouteBasePath: "/",
				indexBlog: false,
				highlightSearchTermsOnTargetPage: true,
			},
		],
	],

	plugins: [schemasPlugin, llmsTxtPlugin],

	presets: [
		[
			"classic",
			{
				docs: {
					routeBasePath: "/",
					sidebarPath: "./sidebars.config.ts",
					editUrl: `${REPO}/edit/main/`,
					rehypePlugins: [rehypeCodeWbr, rehypeTableMarks],
				},
				blog: false,
				theme: { customCss: ["./src/css/custom.css", "./src/css/mantine.css"] },
			} satisfies Preset.Options,
		],
	],

	themeConfig: {
		colorMode: { defaultMode: "light", respectPrefersColorScheme: true },
		announcementBar: {
			id: "unofficial",
			content: `${DISCLAIMER} A community project that describes Claude Code ${CLAUDE_CODE_VERSION}.`,
			isCloseable: false,
			backgroundColor: "#141413",
			textColor: "#faf9f5",
		},
		navbar: {
			title: "Clawdipedia",
			logo: { alt: "Docs icon", src: "img/logo.svg" },
			items: [
				{
					type: "docSidebar",
					sidebarId: "docs",
					position: "left",
					label: "Docs",
				},
				{ to: "/prompts", label: "System Prompts", position: "left" },
				{
					to: "/reference/undocumented",
					label: "Undocumented",
					position: "left",
				},
				{
					to: "/start/what-changed",
					label: `Tracks ${CLAUDE_CODE_VERSION}`,
					position: "right",
					className: "navbar-version",
				},
				{ href: REPO, label: "GitHub", position: "right" },
			],
		},
		footer: {
			style: "dark",
			links: [
				{
					title: "Docs",
					items: [
						{ label: "Start Here", to: "/start/how-to-read" },
						{ label: "How It Works", to: "/how-it-works/architecture" },
						{ label: "Style Guide", to: "/contributing/style-guide" },
					],
				},
				{
					title: "Project",
					items: [{ label: "GitHub", href: REPO }],
				},
			],
			copyright: `${DISCLAIMER} This is a community project. "Claude" and "Claude Code" name the product it describes. Docs: CC BY 4.0. Code: MIT.`,
		},
		mermaid: {
			theme: { light: "neutral", dark: "dark" },
			options: {
				fontFamily: "Lora, Georgia, serif",
				themeVariables: {
					fontFamily: "Lora, Georgia, serif",
					fontSize: "16px",
				},
				flowchart: {
					htmlLabels: true,
					useMaxWidth: true,
					wrappingWidth: 200,
					padding: 12,
					nodeSpacing: 32,
					rankSpacing: 40,
					curve: "basis",
				},
				sequence: {
					useMaxWidth: true,
					wrap: false,
					mirrorActors: false,
					actorMargin: 80,
					messageMargin: 40,
					noteMargin: 12,
					boxMargin: 10,
					width: 160,
				},
				state: { useMaxWidth: true },
			},
		},
		prism: {
			theme: prismThemes.github,
			darkTheme: prismThemes.dracula,
			additionalLanguages: ["bash", "json", "diff", "toml", "yaml"],
		},
	} satisfies Preset.ThemeConfig,
};

export default config;
