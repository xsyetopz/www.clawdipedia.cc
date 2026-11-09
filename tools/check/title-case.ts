// The Title Case rule that check:docs applies to every title, heading, and
// sidebar label. A small word may take either case inside the title, because
// markdownlint's title-case-style rule decides the case of each heading word,
// such as "From" and "Without".

const SMALL = new Set(
	(
		"a an the and but or nor for so yet as at by in of on to up via per vs " +
		"from into onto over with within without off out than " +
		"about above across after against along among around before behind " +
		"below beneath beside between beyond down during inside near past " +
		"since through throughout toward towards under until upon " +
		"like unlike despite"
	).split(" "),
);

/** Returns the words that break the rule, or an empty list. */
export const titleCaseProblems = (raw: string): string[] => {
	// Code spans are always fine, so each becomes a placeholder.
	const text = raw
		.replace(/\s*\{#[^}]*\}\s*$/u, "")
		.replaceAll(/`[^`]*`/gu, "X")
		.replaceAll(/!?\[([^\]]*)\]\([^)]*\)/gu, "$1")
		.replaceAll(/<[^>]+>/gu, "")
		.replaceAll(/[*_]{1,3}/gu, "");
	const words = text.split(/\s+/u).filter(Boolean);
	const bad: string[] = [];
	for (const [i, word] of words.entries()) {
		const core = word.replace(/^[("'[]+/u, "");
		const first = core[0];
		// Digits, symbols, and placeholders are fine.
		if (first === undefined || !/\p{L}/u.test(first)) {
			continue;
		}
		const bare = core.replace(/[^\p{L}\p{N}-]+$/u, "");
		const edge =
			i === 0 || i === words.length - 1 || /[:?!.]$/u.test(words[i - 1] ?? "");
		if (first === first.toUpperCase()) {
			continue;
		}
		if (!edge && SMALL.has(bare.toLowerCase())) {
			continue;
		}
		bad.push(bare);
	}
	return bad;
};
