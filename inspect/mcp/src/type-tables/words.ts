// Words that carry no claim; a page word outside these and outside the doc comment is printed by --prose.
const PLAIN = new Set(
	"a an and are as at be by can do does for from has have if in is it its of on one or that the then this to was when where which while with without not no".split(
		" ",
	),
);

const words = (t: string): string[] =>
	t
		.toLowerCase()
		.replaceAll(/<[^>]+>|\[\^[\w-]+\]/gu, " ")
		.match(/[a-z0-9_.$-]+/gu)
		?.map((w) => w.replace(/\.+$/u, "")) ?? [];

const stem = (w: string): string => w.replace(/s$/u, "");

/** The words of the page cell that the doc comment does not have: the claims to read against the code. */
export const newWords = (page: string, doc: string): string[] => {
	const known = new Set(words(doc).map((w) => stem(w)));
	return [
		...new Set(words(page).filter((w) => !PLAIN.has(w) && !known.has(stem(w)))),
	];
};
