// Request details of the plain and the tool+plugin+hooks runs: headers, betas, body keys, system, tools, init event.
// Built on sig.ts; two identical runs give the noise keys, which are left out of the data.
import { createHash } from "node:crypto";

import type { Data } from "../../lib/results.ts";
import { baseResult, dispose, oneCase, runCase } from "./run.ts";
import { baselineA, baselineB, sig, stableBaseline } from "./sig.ts";
import type { PrintGroup } from "./types.ts";

const LONG = 200;

const one = (
	ctx: Parameters<PrintGroup["run"]>[0],
	name: "baseline-a" | "baseline-b",
) =>
	oneCase(ctx, `print.request.${name}`, async () => {
		const mk = name === "baseline-a" ? baselineA : baselineB;
		const b = await stableBaseline(ctx.bin, mk, name === "baseline-b");
		const r = await runCase(ctx.bin, mk());
		try {
			const s = await sig(r);
			const data: Record<string, Data> = {
				precondition:
					b.valid &&
					s["code"] === "0" &&
					(s["events"] ?? "").includes("system/init") &&
					(name === "baseline-a" || (s["cfgfiles"] ?? "").includes("hook.log")),
				"precondition.detail": b.why,
				noise: b.noise,
			};
			const samples: Record<string, string> = {};
			for (const [k, v] of Object.entries(s)) {
				if (b.noise.includes(k)) {
					continue;
				}
				if (v.length > LONG) {
					data[k] =
						`sha1:${createHash("sha1").update(v).digest("hex").slice(0, 10)} len=${v.length}`;
					samples[k] = v;
				} else {
					data[k] = v;
				}
			}
			return baseResult(ctx, `print.request.${name}`, r, {
				data,
				samples,
				notes:
					"Long values are a hash in data and full text in samples. Keys that differ between two identical runs are listed in noise and left out.",
			});
		} finally {
			await dispose(r);
		}
	});

export const requestGroup: PrintGroup = {
	id: "request",
	title: "Request details (headers, betas, body, init event)",
	run: async (ctx) => {
		const a = await one(ctx, "baseline-a");
		const b = await one(ctx, "baseline-b");
		return [...a, ...b];
	},
};
