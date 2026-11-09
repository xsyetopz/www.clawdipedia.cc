import { BASE } from "../misc/shared.ts";
import {
	type CaseDef,
	msgs,
	readCfg,
	type Run,
	withRun,
} from "../run/helpers.ts";
import { diffSig, type Sig, sig } from "../sig.ts";
import { DBG, lines } from "./util.ts";

/**
 * Two plain runs with the same host variables give the noise; a third run adds the name under test.
 * The data lists the signature keys that changed beyond the noise (sig.ts: headers, body parts, init event).
 */
export const inert = (
	name: string,
	env: Record<string, string>,
	host: Record<string, string> = {},
): CaseDef => ({
	name: `inert.${name}`,
	run: async (ctx) => {
		const once = async (e: Record<string, string>): Promise<Sig> => {
			let s: Sig = {};
			await withRun(ctx, { args: [...BASE, ...DBG], env: e }, async (r) => {
				s = await sig(r);
				return { from: r, data: {} };
			});
			return s;
		};
		const a = await once(host);
		const b = await once(host);
		const noise = new Set(diffSig(a, b));
		return withRun(
			ctx,
			{ args: [...BASE, ...DBG], env: { ...host, ...env } },
			async (r) => {
				const changed = diffSig(a, await sig(r)).filter((k) => !noise.has(k));
				const log = await readCfg(r, "d.log");
				return {
					from: r,
					data: {
						precondition: msgs(r).length > 0 && r.code === 0,
						changedKeys: changed.length > 0 ? changed.join(",") : "none",
						noiseKeys: noise.size,
						exit: r.code,
					},
					samples: {
						debug: lines(log, new RegExp(Object.keys(env).join("|"), "u"), 4),
					},
				};
			},
		);
	},
});

const HOOK_SETTINGS = JSON.stringify({
	hooks: {
		UserPromptSubmit: [
			{
				hooks: [
					{ type: "command", command: "echo hook-ran >> {CFG}/hook.log" },
				],
			},
		],
	},
});

const hooksOffOut = async (r: Run) => {
	const body = JSON.stringify(msgs(r).map((m) => m.body));
	const note =
		/[^"]{0,60}own Claude Code hooks[^"]{0,260}/u.exec(body)?.[0] ?? null;
	const evLines = r.stdout
		.split("\n")
		.filter((l) => l.includes("own Claude Code hooks"));
	const hookLog = await readCfg(r, "hook.log");
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0,
			hookRan: hookLog.includes("hook-ran"),
			noteInRequest: note !== null,
			noteInOutput: evLines.length,
		},
		samples: {
			request: note ?? "",
			output: (evLines[0] ?? "").slice(0, 500),
		},
	};
};

/** CLAUDE_CODE_PERSONAL_HOOKS_OFF: the note that tells Claude and the user that their own hooks do not run. */
export const hooksOff = (
	name: string,
	value: string | undefined,
	restricted: boolean,
): CaseDef => ({
	name: `personal-hooks-off.${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				args: [...BASE],
				cfgFiles: { "settings.json": HOOK_SETTINGS },
				env: {
					...(restricted ? { CLAUDE_CODE_RESTRICT_PERSONAL_CONFIG: "1" } : {}),
					...(value === undefined
						? {}
						: { CLAUDE_CODE_PERSONAL_HOOKS_OFF: value }),
				},
			},
			hooksOffOut,
		),
});
