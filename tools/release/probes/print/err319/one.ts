import {
	type CaseDef,
	json,
	msgs,
	readCfg,
	type Run,
	type Spec,
	toolNames,
	toolResultTexts,
	withRun,
} from "../run/helpers.ts";

export const GI = { "connector-downloads/.gitignore": "*\n" };
const GB_ON = {
	DISABLE_TELEMETRY: "",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };

/** Env that keeps the feature flag client on and the first-party base URL assumed. */
export const CONNECTED = {
	env: { ...GB_ON, ...FIRST_PARTY },
	allowOverride: Object.keys(GB_ON),
};

export const OAUTH_CREDS = json({
	claudeAiOauth: {
		accessToken: "sk-ant-oat01-fake",
		refreshToken: "sk-ant-ort01-fake",
		expiresAt: 9_999_999_999_999,
		scopes: ["user:inference", "user:profile"],
		subscriptionType: "max",
	},
});

export const grep = async (r: Run, re: RegExp): Promise<string> => {
	const debug = await readCfg(r, "d.log");
	return [
		...r.stdout.split("\n").map((l) => `out: ${l}`),
		...r.stderr.split("\n").map((l) => `err: ${l}`),
		...toolResultTexts(r).map((l) => `tool_result: ${l}`),
		...debug.split("\n").map((l) => `debug: ${l}`),
	]
		.filter((l) => re.test(l))
		.slice(0, 8)
		.map((l) => l.slice(0, 700))
		.join("\n");
};

export const one = (name: string, spec: Spec, re: RegExp): CaseDef => ({
	name,
	run: (ctx) =>
		withRun(ctx, spec, async (r) => {
			const q = msgs(r)[0];
			return {
				from: r,
				data: {
					exit: r.code,
					requests: msgs(r).length,
					tools: q === undefined ? 0 : toolNames(q).length,
				},
				samples: { text: await grep(r, re) },
			};
		}),
});
