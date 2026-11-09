// html.ts: HTML pages to markdown, and the page title.
import { describe, expect, test } from "bun:test";

import { htmlTitle, htmlToMarkdown } from "../src/html.ts";

const URL = "https://www.anthropic.com/research/page";
const main = (inner: string) => `<main id="main-content">${inner}</main>`;

describe("htmlToMarkdown container", () => {
	test("prefers main#main-content over the rest of the body", () => {
		const html = `<body><nav>n</nav>${main("<p>Hi</p>")}<p>out</p></body>`;
		expect(htmlToMarkdown(html, URL)).toBe("Hi\n");
	});

	test("falls back to article, then body, then the input", () => {
		expect(
			htmlToMarkdown("<body><p>x</p><article><p>Art</p></article></body>", URL),
		).toBe("Art\n");
		expect(htmlToMarkdown("<html><body><p>Body</p></body></html>", URL)).toBe(
			"Body\n",
		);
		expect(htmlToMarkdown("<p>Bare</p>", URL)).toBe("Bare\n");
	});

	test("drops script, style, nav, header, footer, svg, noscript, form, button", () => {
		const html = main(
			"<p>a</p><script>x()</script><style>.a{}</style><nav>n</nav><svg><path/></svg><form><input></form><button>b</button><noscript>ns</noscript><footer>f</footer><header>h</header><p>z</p>",
		);
		expect(htmlToMarkdown(html, URL)).toBe("a\n\nz\n");
	});

	test("drops an element nested in one of the same name", () => {
		expect(
			htmlToMarkdown(main("<nav>a<nav>b</nav>c</nav><p>kept</p>"), URL),
		).toBe("kept\n");
	});

	test("keeps an h1 that sits in a dropped header", () => {
		const html = main("<header><h1>Title</h1><p>junk</p></header><p>body</p>");
		expect(htmlToMarkdown(html, URL)).toBe("# Title\n\nbody\n");
	});
});

describe("htmlToMarkdown elements", () => {
	test("headings, paragraphs, emphasis", () => {
		const html = main(
			"<h1>A</h1><p>b <strong>bold</strong> and <em>it</em></p><h3>C</h3>",
		);
		expect(htmlToMarkdown(html, URL)).toBe(
			"# A\n\nb **bold** and *it*\n\n### C\n",
		);
	});

	test("unordered and ordered lists", () => {
		expect(
			htmlToMarkdown(main("<ul><li>One</li><li>Two <b>x</b></li></ul>"), URL),
		).toBe("- One\n- Two **x**\n");
		expect(htmlToMarkdown(main("<ol><li>a</li><li>b</li></ol>"), URL)).toBe(
			"1. a\n2. b\n",
		);
	});

	test("blockquote", () => {
		expect(
			htmlToMarkdown(main("<blockquote><p>Quote</p></blockquote>"), URL),
		).toBe("> Quote\n");
	});

	test("pre becomes a fence with decoded text and keeps its indentation", () => {
		const html = main(
			"<p>Before</p><pre><code>if (a &lt; b) {\n  run();\n}</code></pre><p>After</p>",
		);
		expect(htmlToMarkdown(html, URL)).toBe(
			"Before\n\n```\nif (a < b) {\n  run();\n}\n```\n\nAfter\n",
		);
	});

	test("inline code becomes backticks", () => {
		expect(htmlToMarkdown(main("<p>Use <code>a&lt;b</code>.</p>"), URL)).toBe(
			"Use `a<b`.\n",
		);
	});

	test("links resolve against the page URL", () => {
		const html = main(
			'<p><a href="/x?a=1&amp;b=2">abs</a> <a href="../y">up</a> <a href="z">sib</a> <a href="https://o.example/q">full</a> <a href="javascript:void(0)">js</a></p>',
		);
		expect(htmlToMarkdown(html, URL)).toBe(
			"[abs](https://www.anthropic.com/x?a=1&b=2) [up](https://www.anthropic.com/y) [sib](https://www.anthropic.com/research/z) [full](https://o.example/q) js\n",
		);
	});
});

describe("htmlToMarkdown text", () => {
	test("decodes named and numeric entities once", () => {
		const html = main(
			"<p>&amp;lt; &#39;q&#39; &#x41; &quot;d&quot; a&nbsp;b &unknown;</p>",
		);
		expect(htmlToMarkdown(html, URL)).toBe(`&lt; 'q' A "d" a b &unknown;\n`);
	});

	test("an escaped tag in text stays text", () => {
		expect(htmlToMarkdown(main("<p>&lt;div&gt; tag</p>"), URL)).toBe(
			"<div> tag\n",
		);
	});

	test("source whitespace is collapsed and blank lines are capped at one", () => {
		const html = main("<p>a\n     b</p>\n\n\n\n<div></div><div></div><p>c</p>");
		expect(htmlToMarkdown(html, URL)).toBe("a b\n\nc\n");
	});
});

describe("htmlTitle", () => {
	test("removes a trailing Anthropic brand", () => {
		expect(
			htmlTitle(
				String.raw`<title>Building effective AI agents \ Anthropic</title>`,
			),
		).toBe("Building effective AI agents");
		expect(htmlTitle("<title>Privacy | Anthropic</title>")).toBe("Privacy");
		expect(
			htmlTitle("<title>Introducing Claude Duet | Claude by Anthropic</title>"),
		).toBe("Introducing Claude Duet");
		expect(htmlTitle("<title>Plain &amp; simple</title>")).toBe(
			"Plain & simple",
		);
	});

	test("falls back to the first h1, then to nothing", () => {
		expect(htmlTitle("<body><h1 class='t'>From <b>h1</b></h1></body>")).toBe(
			"From h1",
		);
		expect(htmlTitle("<body><p>none</p></body>")).toBeUndefined();
	});
});
