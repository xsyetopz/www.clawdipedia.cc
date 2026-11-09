// `release:clean`: cleans both installs with cc-inspect (`inspect/mcp/src/prepare.ts`) into captures/<version>/clean/.
import { extractModules } from "../../inspect/mcp/src/bunfs.ts";
import { prepare } from "../../inspect/mcp/src/prepare.ts";
import { mapSeq } from "./lib/seq.ts";
import { binaryPath, CAPTURES, type Ctx } from "./util.ts";

const cleanOne = async (v: string): Promise<void> => {
	const path = binaryPath(v);
	const extracted = await extractModules(path);
	const modules = extracted.modules.map((m) => ({
		name: m.name,
		text: m.source,
	}));
	const r = await prepare(v, path, modules, CAPTURES);
	const skipped = Object.keys(r.index.skipped);
	console.info(
		`clean ${v}: ${r.parsed ? `${r.parsed} modules cleaned` : "cached"}, ${r.index.units.length} units, ${r.ms} ms${skipped.length > 0 ? `; not JavaScript: ${skipped.join(", ")}` : ""} -> ${r.dir}`,
	);
};

export const runClean = async (ctx: Ctx): Promise<number> => {
	await mapSeq(ctx.from === ctx.to ? [ctx.from] : [ctx.from, ctx.to], cleanOne);
	return 0;
};
