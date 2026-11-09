// Reads what one print-mode run left in its temp config dir: transcript lines and .claude.json.
import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

import { claudeJson, counts, obj, transcripts } from "./ingest.ts";

const listJsonl = async (d: string): Promise<string[]> => {
	let names: string[];
	try {
		names = await readdir(d);
	} catch {
		return [];
	}
	const found = await Promise.all(
		names.map(async (e): Promise<string[]> => {
			const p = join(d, e);
			const st = await stat(p);
			if (st.isDirectory()) {
				return listJsonl(p);
			}
			return e.endsWith(".jsonl") ? [p] : [];
		}),
	);
	return found.flat();
};

const tallyTranscript = (text: string): void => {
	for (const l of text.split("\n")) {
		if (l === "") {
			continue;
		}
		try {
			const j = obj(JSON.parse(l));
			counts.transcriptLines++;
			transcripts.add(typeof j["type"] === "string" ? j["type"] : "?", j);
		} catch {
			// skip
		}
	}
};

/** Tallies the transcripts and the .claude.json of the config dir `cfg`. */
export const collectRun = async (cfg: string): Promise<void> => {
	const files = await listJsonl(join(cfg, "projects"));
	const texts = await Promise.all(files.map((f) => Bun.file(f).text()));
	for (const text of texts) {
		tallyTranscript(text);
	}
	const cj = Bun.file(join(cfg, ".claude.json"));
	if (await cj.exists()) {
		counts.claudeJsonFiles++;
		const parsed: unknown = JSON.parse(await cj.text());
		claudeJson.add("$root", parsed);
	}
};
