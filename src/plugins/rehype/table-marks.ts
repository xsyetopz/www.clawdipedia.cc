// Gives the yes/no glyphs at the start of a table cell an accessible name.
// A bare glyph gets role="img" and aria-label. A glyph that is followed by
// "Yes" or "No" text is hidden from screen readers, because the text says it.
interface Node {
	type: string;
	tagName?: string;
	value?: string;
	children?: Node[];
	properties?: Record<string, unknown>;
}

const MARKS: Record<string, string> = { "✅": "Yes", "❌": "No" };

const markCell = (cell: Node): void => {
	const first = cell.children?.[0];
	if (
		first?.type !== "text" ||
		first.value === undefined ||
		first.value === "" ||
		cell.children === undefined
	) {
		return;
	}
	const trimmed = first.value.trimStart();
	const glyph = trimmed[0] ?? "";
	const label = MARKS[glyph];
	if (label === undefined) {
		return;
	}
	// Skip a variation selector (U+FE0F) that follows the glyph.
	const rest = trimmed.slice(1).replace(/^\uFE0F/u, "");
	const spoken = new RegExp(`^\\s*${label}\\b`, "u").test(rest);
	const span: Node = {
		type: "element",
		tagName: "span",
		properties: spoken
			? { className: ["cc-mark"], ariaHidden: "true" }
			: { className: ["cc-mark"], role: "img", ariaLabel: label },
		children: [{ type: "text", value: glyph }],
	};
	const tail: Node[] = rest === "" ? [] : [{ type: "text", value: rest }];
	cell.children.splice(0, 1, span, ...tail);
};

const walk = (node: Node): void => {
	for (const child of node.children ?? []) {
		if (child.type !== "element") {
			continue;
		}
		if (child.tagName === "td") {
			markCell(child);
		} else {
			walk(child);
		}
	}
};

export const rehypeTableMarks =
	() =>
	(tree: Node): void => {
		walk(tree);
	};
