// HTML page to markdown: node-html-parser selects and cleans the DOM, node-html-markdown converts it.
import { NodeHtmlMarkdown } from "node-html-markdown";
import { type HTMLElement, parse } from "node-html-parser";

const DROPPED = "script, style, nav, footer, svg, noscript, form, button";
const NEVER: readonly [RegExp, string] = [/(?!)/gu, ""];

// Escaping is off: a model reads these pages, and a "\<div\>" in the text would be noise.
const translator = new NodeHtmlMarkdown({
	bulletMarker: "-",
	emDelimiter: "*",
	strongDelimiter: "**",
	codeFence: "```",
	maxConsecutiveNewlines: 2,
	globalEscape: NEVER,
	lineStartEscape: NEVER,
});

const oneLine = (s: string): string => s.replaceAll(/\s+/gu, " ").trim();

/** <main id="main-content">, else <article>, else <body>, else the whole input. */
const container = (root: HTMLElement): HTMLElement =>
	root.querySelector("main#main-content") ??
	root.querySelector("article") ??
	root.querySelector("body") ??
	root;

const resolveHref = (href: string, pageUrl: string): string | undefined => {
	const h = href.trim();
	if (h === "" || /^(javascript|data|vbscript):/iu.test(h)) {
		return undefined;
	}
	try {
		return new URL(h, pageUrl).href
			.replaceAll("(", "%28")
			.replaceAll(")", "%29");
	} catch {
		return undefined;
	}
};

const dropElements = (el: HTMLElement): void => {
	// The page title sits in an <h1> inside <header> on article pages: keep the <h1>, drop the rest.
	// The innermost header goes first, so an outer header still finds the h1 of an inner one.
	for (const header of el.querySelectorAll("header").toReversed()) {
		header.replaceWith(
			header
				.querySelectorAll("h1")
				.map((h1) => h1.outerHTML)
				.join(""),
		);
	}
	for (const drop of el.querySelectorAll(DROPPED)) {
		drop.remove();
	}
};

const fixLinks = (el: HTMLElement, pageUrl: string): void => {
	for (const a of el.querySelectorAll("a")) {
		const href = a.getAttribute("href");
		if (href === undefined) {
			continue;
		}
		const resolved = resolveHref(href, pageUrl);
		if (resolved === undefined) {
			a.removeAttribute("href");
		} else {
			a.setAttribute("href", resolved);
		}
	}
};

/** Converts a page to markdown. Relative links resolve against `pageUrl`. */
export const htmlToMarkdown = (html: string, pageUrl: string): string => {
	const el = container(parse(html));
	dropElements(el);
	fixLinks(el, pageUrl);
	return `${translator.translate(el.innerHTML).trim()}\n`;
};

/** The <title> without a trailing " | Claude by Anthropic" or " | Anthropic", else the first <h1>. */
export const htmlTitle = (html: string): string | undefined => {
	const root = parse(html);
	const title = oneLine(root.querySelector("title")?.text ?? "").replace(
		/\s*[\\|]\s*(?:Claude by )?Anthropic$/u,
		"",
	);
	if (title !== "") {
		return title;
	}
	const h1 = oneLine(root.querySelector("h1")?.text ?? "");
	return h1 === "" ? undefined : h1;
};
