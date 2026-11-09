// Plugin validate probes: a plugin.json with each kind of version value.
import { type CaseDef, withRun } from "../run/helpers.ts";

export const VALIDATE: [string, string, string?][] = [
	["string", '"banana"'],
	["number", "1"],
	["empty-string", '""'],
	["semver", '"1.2.3"'],
	["null", "null"],
	["array", "[1]"],
	["empty-string-with-author", '""', ',"author":{"name":"a"}'],
];
export const validateCase = ([
	name,
	ver,
	extra,
]: (typeof VALIDATE)[number]): CaseDef => ({
	name: `plugin-validate.version-${name}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				argv: ["plugin", "validate", "{HOME}/pl"],
				noPrompt: true,
				setup: async ({ home }) => {
					await Bun.write(
						`${home}/pl/.claude-plugin/plugin.json`,
						`{"name":"pp","version":${ver},"description":"x"${extra ?? ""}}`,
					);
				},
			},
			(r) => {
				const t = (r.stdout + r.stderr).replaceAll(/\s+/gu, " ");
				return {
					from: r,
					data: {
						precondition: t.includes("Validating plugin manifest"),
						exit: r.code,
						errors: /Found (\d+) errors?/u.exec(t)?.[1] ?? "0",
						warnings: /Found (\d+) warnings?/u.exec(t)?.[1] ?? "0",
						problems: /Found (\d+) problems?/u.exec(t)?.[1] ?? "0",
					},
					samples: {
						output: t.replaceAll(
							/\/\S+\/\.claude-plugin/gu,
							"<P>/.claude-plugin",
						),
					},
				};
			},
		),
});
