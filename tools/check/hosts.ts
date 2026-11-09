// Example-host check. Run with: bun tools/check/hosts.ts
//
// IANA reserves example.com, example.org, and example.net for documentation
// (https://www.iana.org/help/example-domains). The same page says they are "not a service" and that you
// must "avoid relying on [them] for testing and monitoring purposes".
//
// So a page may use them in an example, and code may not use them as a host it reaches. A test or a
// probe uses a name under `.invalid` instead, which RFC 2606 section 2 reserves for a name that never
// resolves, or `127.0.0.1` with a port when it needs a server that answers.
//
// An email address keeps example.com, because no code resolves an email address.
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

// Code trees only. `docs/` is prose, where the example hosts belong.
const TREES = ["tools", "plugin", "cli", "inspect", "src"];
const CODE_EXT = /\.(ts|tsx|js|mjs|cjs|json|jsonc|sh|py)$/u;
const SKIP_DIR = new Set(["node_modules", "dist", "out", "bin", "fixtures"]);

const EXAMPLE_HOST = /\b(?:example\.(?:com|org|net)|example)\b/u;

// A host inside a URL, with or without a scheme. The capture is the host.
const URL_HOST =
	/(?:https?:\/\/|wss?:\/\/|\/\/)([a-z0-9.-]*\bexample\.(?:com|org|net))/giu;

/** An email address keeps the example host: nothing resolves it. */
const EMAIL = /[a-z0-9._%+-]+@example\.(?:com|org|net)/giu;

/**
 * Files that may name an example host in code, each with the reason.
 * Add an entry only when the host is the subject of the code, never when the code reaches it.
 */
const ALLOWED = new Map<string, string>([
	[
		"inspect/mcp/src/surface/endpoint.ts",
		"a comment that names example.com as a placeholder the extractor leaves out",
	],
	[
		"inspect/mcp/test/surface/names.test.ts",
		"a source fixture string: the extractor is tested on exactly this input",
	],
]);

interface Problem {
	file: string;
	line: number;
	message: string;
}

const walk = async (dir: string): Promise<string[]> => {
	const names = await readdir(dir);
	const found = await Promise.all(
		names.map(async (name): Promise<string[]> => {
			if (name.startsWith(".") || SKIP_DIR.has(name)) {
				return [];
			}
			const full = join(dir, name);
			const info = await stat(full);
			if (info.isDirectory()) {
				return walk(full);
			}
			return CODE_EXT.test(name) ? [full] : [];
		}),
	);
	return found.flat();
};

const walkTree = async (tree: string): Promise<string[]> => {
	const dir = join(ROOT, tree);
	try {
		const info = await stat(dir);
		return info.isDirectory() ? await walk(dir) : [];
	} catch {
		return [];
	}
};

const scanFile = async (full: string): Promise<Problem[]> => {
	const rel = relative(ROOT, full).split(sep).join("/");
	const reason = ALLOWED.get(rel);
	const text = await readFile(full, "utf8");
	if (!EXAMPLE_HOST.test(text) || reason !== undefined) {
		return [];
	}
	const found: Problem[] = [];
	for (const [i, line] of text.split("\n").entries()) {
		// Strip every email address first, so a git author line passes.
		const bare = line.replaceAll(EMAIL, "");
		const hosts = [...bare.matchAll(URL_HOST)].map((m) => m[1]);
		if (hosts.length > 0) {
			found.push({
				file: rel,
				line: i + 1,
				message: `uses ${hosts.join(", ")} as a host. IANA says not to rely on it for testing. Use a name under .invalid, or 127.0.0.1 with a port. See docs/contributing/style-guide.md, "Example Hosts".`,
			});
		}
	}
	return found;
};

// An allow-list entry that no longer matches is dead, so it must go.
const checkAllowed = async (
	rel: string,
	reason: string,
): Promise<Problem[]> => {
	const full = join(ROOT, rel);
	let text = "";
	try {
		text = await readFile(full, "utf8");
	} catch {
		return [
			{
				file: rel,
				line: 1,
				message: `is on the allow-list (${reason}) but does not exist. Remove its entry from tools/check/hosts.ts.`,
			},
		];
	}
	if (EXAMPLE_HOST.test(text)) {
		return [];
	}
	return [
		{
			file: rel,
			line: 1,
			message: `is on the allow-list (${reason}) but names no example host. Remove its entry from tools/check/hosts.ts.`,
		},
	];
};

const trees = await Promise.all(TREES.map((tree) => walkTree(tree)));
const files = trees.flat();
const scanned = await Promise.all(files.map((full) => scanFile(full)));
const allowed = await Promise.all(
	[...ALLOWED].map(([rel, reason]) => checkAllowed(rel, reason)),
);
const problems = [...scanned.flat(), ...allowed.flat()];

if (problems.length > 0) {
	for (const p of problems) {
		console.error(`${p.file}:${p.line}: ${p.message}`);
	}
	console.error(`\n${problems.length} problem(s) found.`);
	process.exitCode = 1;
} else {
	console.info(`check-hosts: ok (${files.length} files scanned)`);
}
