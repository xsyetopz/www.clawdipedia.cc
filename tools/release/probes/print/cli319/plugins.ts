import { join } from "node:path";

import { listFiles } from "../run.ts";
import {
	type CaseDef,
	json,
	msgs,
	readCfg,
	type Run,
	withRun,
} from "../run/helpers.ts";

/** A debug-log line without its timestamp, cut to `n` characters. */
export const trim = (l: string, n: number): string =>
	l.replace(/^\S+\s/u, "").slice(0, n);

/** A mod that calls the four theme functions at session.start and logs each answer to the debug log. */
const THEME_MOD = `export const register = (on) => {
  on("session.start", async ($, e, next) => {
    const t = async (label, f) => {
      let out;
      try { out = { ok: await f() }; } catch (x) { out = { err: String(x && x.message) }; }
      $.ui.log("THEME " + label + " " + JSON.stringify(out), { to: "debug" });
    };
    await t("clear-first", () => $.theme.clear());
    await t("set", () => $.theme.set({ backdrop: { id: "lagoon", glass: { blur: 14, opacity: 0.55 }, colorScheme: "dark" } }));
    await t("set-again", () => $.theme.set({ backdrop: { id: "lagoon", glass: { blur: 14, opacity: 0.55 }, colorScheme: "dark" } }));
    await t("clear", () => $.theme.clear());
    await t("clear-twice", () => $.theme.clear());
    await t("bad-attr", () => $.theme.set({ palette: {} }));
    await t("no-backdrop", () => $.theme.set({}));
    await t("bad-blur", () => $.theme.set({ backdrop: { id: "a", glass: { blur: 99 } } }));
    await t("bad-scheme", () => $.theme.set({ backdrop: { id: "a", colorScheme: "grey" } }));
    await t("bad-id", () => $.theme.set({ backdrop: { id: "a b" } }));
    return next(e);
  });
};
`;

const PLUGIN_ARGS = [
	"--plugin-dir",
	"{HOME}/plug",
	"--debug-file",
	"{CFG}/d.log",
];

const plugin = (name: string, register: string) => ({
	"plug/.claude-plugin/plugin.json": json({ name, version: "1.0.0" }),
	"plug/hooks/hooks.json": json({ modules: ["./register.ts"] }),
	"plug/hooks/register.ts": register,
});

const themeOut = async (r: Run) => {
	const d = await readCfg(r, "d.log");
	const lines = d.split("\n").filter((l) => /THEME |themeprobe/u.test(l));
	return {
		from: r,
		data: {
			precondition:
				msgs(r).length > 0 && lines.some((l) => l.includes("THEME ")),
		},
		samples: { lines: lines.map((l) => trim(l, 400)).join("\n") },
	};
};

export const themeMod = (): CaseDef => ({
	name: "theme.engine",
	run: (ctx) =>
		withRun(
			ctx,
			{ homeFiles: plugin("themeprobe", THEME_MOD), args: PLUGIN_ARGS },
			themeOut,
		),
});

const watchOut = async (r: Run) => {
	const d = await readCfg(r, "d.log");
	const files = await listFiles(join(r.sb.home, "plug"));
	return {
		from: r,
		data: {
			precondition: msgs(r).length > 0 && d.length > 0,
			added: files.filter(
				(f) => !/^(\.claude-plugin\/plugin\.json|hooks\/.*)$/u.test(f),
			),
			typeRootLine: d.includes("type root of watchprobe at "),
			watchLine: d.includes("plugin-dir watch: watching "),
		},
		samples: {
			lines: d
				.split("\n")
				.filter((l) => /type root of|plugin-dir watch/u.test(l))
				.map((l) => trim(l, 400))
				.join("\n"),
		},
	};
};

/** A `--plugin-dir` mod in print mode: the files the program adds to the mod's folder, and its watch and type-root debug lines. */
export const dirWatch = (v?: string): CaseDef => ({
	name: `plugin-dir-watch.${v === undefined ? "unset" : `v${v}`}`,
	run: (ctx) =>
		withRun(
			ctx,
			{
				env: v === undefined ? {} : { CLAUDE_CODE_PLUGIN_DIR_WATCH: v },
				homeFiles: plugin("watchprobe", "export const register = () => {};\n"),
				args: PLUGIN_ARGS,
			},
			watchOut,
		),
});

export const cowork = (name: string, env: Record<string, string>): CaseDef => ({
	name: `cowork-plugin.${name}`,
	run: (ctx) =>
		withRun(ctx, { env }, (r) => ({
			from: r,
			data: {
				precondition: r.reqs.length > 0,
				env: Object.keys(env).join(","),
				listed: r.reqs.some((q) =>
					JSON.stringify(q.body).includes("cowork-plugin"),
				),
			},
		})),
});
