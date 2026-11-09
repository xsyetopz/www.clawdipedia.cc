import { access } from "node:fs/promises";

/** True when the path exists, file or directory (`Bun.file(p).exists()` is false for directories). */
export const pathExists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};
