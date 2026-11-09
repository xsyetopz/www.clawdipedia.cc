import { join } from "node:path";

import { pathExists } from "../print/run.ts";
import { MANAGED_DIR, MARKER, VARIANT_FILE } from "./fixtures.ts";

export type FolderState = "absent" | "ours" | "foreign";

/** Read-only check of the managed folder. "foreign" = exists without our marker: never probe, never remove. */
export const folderState = async (dir = MANAGED_DIR): Promise<FolderState> => {
	if (!(await pathExists(dir))) {
		return "absent";
	}
	return (await pathExists(join(dir, MARKER))) ? "ours" : "foreign";
};

/** Read-only: which variant the root script says is installed ("" if none). */
export const installedVariant = async (): Promise<string> => {
	const text = await Bun.file(join(MANAGED_DIR, VARIANT_FILE))
		.text()
		.catch(() => "");
	return text.trim();
};

export const waitFor = (
	ok: () => Promise<boolean>,
	ms: number,
): Promise<boolean> => {
	const end = Date.now() + ms;
	const poll = async (): Promise<boolean> => {
		if (await ok()) {
			return true;
		}
		if (Date.now() >= end) {
			return false;
		}
		await Bun.sleep(500);
		return poll();
	};
	return poll();
};
