/** The front matter of a doc page, each value as a string. */
export interface FrontMatter {
	data: Record<string, string>;
	bodyStart: number;
}

/** Parse the front matter of a doc page, or `null` when it has none. Throws on YAML that the site build rejects. */
export const parseFrontMatter = (text: string): FrontMatter | null => {
	const lines = text.split("\n");
	if (lines[0]?.trim() !== "---") {
		return null;
	}
	const end = lines.findIndex((line, i) => i > 0 && line.trim() === "---");
	if (end === -1) {
		return null;
	}
	let yaml: unknown;
	try {
		yaml = Bun.YAML.parse(lines.slice(1, end).join("\n"));
	} catch (error) {
		throw new Error(`front matter is not valid YAML: ${String(error)}`, {
			cause: error
		});
	}
	const entries =
		typeof yaml === "object" && yaml !== null ? Object.entries(yaml) : [];
	return {
		data: Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
		bodyStart: end + 1
	};
};
