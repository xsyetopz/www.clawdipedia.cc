import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/** Does this path exist (file or directory)? */
export const pathExists = async (p: string): Promise<boolean> => {
	try {
		await stat(p);
		return true;
	} catch {
		return false;
	}
};

const walk = async (d: string, base: string): Promise<string[]> => {
	if (!(await pathExists(d))) {
		return [];
	}
	const names = await readdir(d);
	const parts = await Promise.all(
		names.map(async (e) => {
			const f = join(d, e);
			const st = await stat(f);
			return st.isDirectory() ? walk(f, base) : [f.slice(base.length + 1)];
		}),
	);
	return parts.flat();
};

export const listFiles = async (d: string, base = d): Promise<string[]> => {
	const files = await walk(d, base);
	return files.toSorted();
};

export const readIf = async (p: string): Promise<string> => {
	if (!(await pathExists(p))) {
		return "";
	}
	return Bun.file(p).text();
};
