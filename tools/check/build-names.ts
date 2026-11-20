// Finds lines that name a Claude Code build, such as "found in 2.1.328". The Surface Coverage page states the build
// once, so a build in an exclusion reason goes stale at the next release while its citations move.

/** One line that names a build of the program. */
export interface BuildName {
	line: number;
	build: string;
}

const escape = (s: string): string => s.replaceAll(".", String.raw`\.`);

/**
 * The lines of `text` that name a build of the same major and minor version as `current`. Library versions of other
 * lines, such as `4.14.1`, do not count.
 */
export const buildNames = (text: string, current: string): BuildName[] => {
	const [major, minor] = current.split(".");
	const re = new RegExp(
		String.raw`(?<![\d.])${escape(`${major}.${minor}.`)}\d+(?![\d.])`,
		"gu",
	);
	return text
		.split("\n")
		.flatMap((l, i) =>
			[...l.matchAll(re)].map((m) => ({ line: i + 1, build: m[0] })),
		);
};
