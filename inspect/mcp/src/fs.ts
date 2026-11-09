import { access } from "node:fs/promises";

/** Whether a file or a folder exists at `path`. */
export const exists = async (path: string): Promise<boolean> => {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
};
