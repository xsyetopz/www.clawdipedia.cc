import { mkdtemp, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { binaryPath } from "../../../lib/env.ts";
import { DRY_TOKEN, liveToken } from "../../../lib/live/env.ts";
import { allocPort } from "../../../lib/ports.ts";
import { openRun } from "../../../lib/results.ts";
import { startStub } from "../../../lib/stub.ts";
import type { Ctx } from "../../../util.ts";
import type { LiveCtx } from "../harness.ts";

/** Refuses a mismatch of token and mode, and a missing binary. */
export const preflight = async (
	ctx: Ctx,
): Promise<{ token: string; bin: string }> => {
	if (ctx.to === "") {
		throw new Error("no --to given and no installed binary found");
	}
	const token = liveToken();
	if (ctx.dry && token !== DRY_TOKEN) {
		throw new Error(
			"--dry only runs with the fake dry token; refusing a real one",
		);
	}
	if (!ctx.dry && token === DRY_TOKEN) {
		throw new Error("the fake dry token cannot be used for a live run");
	}
	const bin = binaryPath(ctx.to);
	if (!(await Bun.file(bin).exists())) {
		throw new Error(`binary missing: ${bin}`);
	}
	return { token, bin };
};

/** Dry mode gets a temp dir and a local stub; a live run writes into captures/<v>. */
export const makeCtx = async (
	ctx: Ctx,
	token: string,
	bin: string,
): Promise<{ x: LiveCtx; tmp: string }> => {
	const tmp = ctx.dry
		? await realpath(await mkdtemp(join(tmpdir(), "ccrel-livedry-")))
		: "";
	const runDir = ctx.dry ? tmp : await openRun(ctx.to);
	const stub = ctx.dry ? await startStub(await allocPort()) : undefined;
	const x: LiveCtx = {
		version: ctx.to,
		bin,
		runDir,
		token,
		dry: ctx.dry,
		...(stub
			? {
					stub,
					stubBase: (id: string) =>
						stub.register(id, { log: join(tmp, `${id}.jsonl`) }),
				}
			: {}),
	};
	return { x, tmp };
};
