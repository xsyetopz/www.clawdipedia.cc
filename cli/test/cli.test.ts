// Run: bun test cli/test   (runs cli/bin/clawdipedia against a local mock of the site; no network)
import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { cc, mockSite, pathExists, tmp, withSite } from "./helpers.ts";

describe("exit codes", () => {
	test("an unknown page exits 1 and stderr names the closest routes", async () => {
		const { env } = await withSite();
		const miss = await cc(["read", "no/such/page"], env);
		expect(miss.code).toBe(1);
		expect(miss.err).toContain("no/such/page");
		expect(miss.out).toBe("");
		const near = await cc(["read", "configure/hook"], env);
		expect(near.code).toBe(1);
		expect(near.err).toContain("configure/hooks");
	});

	test("a search with no hit exits 1", async () => {
		const { env } = await withSite();
		const r = await cc(["search", "zzzqqqxxx"], env);
		expect(r.code).toBe(1);
		expect(r.err).not.toBe("");
		expect(r.out).toBe("");
	});

	test("an unknown schema property exits 1", async () => {
		const { env } = await withSite();
		const r = await cc(["schema", "tools", "BashInput.decider"], env);
		expect(r.code).toBe(1);
		expect(r.err).toContain("BashInput.decider");
		expect(r.out).toBe("");
	});

	test("a usage error exits 2 and stderr ends with the usage", async () => {
		const { env } = await withSite();
		const help = await cc(["--help"]);
		const usage = help.out;
		expect(usage).not.toBe("");
		const bad = [
			["frobnicate"],
			[],
			["search"],
			["read"],
			["read", "a", "b"],
			["search", "x", "--limit", "0"],
			["search", "x", "--source", "other"],
			["search", "x", "--nope"],
			["list", "--section", "x"],
			["schema", "tools", "--source", "docs"],
			["list", "--source", "docs"],
		];
		const runs = await Promise.all(bad.map((args) => cc(args, env)));
		for (const r of runs) {
			expect(r.code).toBe(2);
			expect(r.err).toEndWith(usage);
			expect(r.out).toBe("");
		}
	});

	test("--help prints the usage on stdout and exits 0", async () => {
		const top = await cc(["--help"]);
		expect(top.code).toBe(0);
		expect(top.out).toContain("clawdipedia");
		const subs = ["search", "read", "list", "schema"];
		const runs = await Promise.all(
			subs.map(async (sub) => ({ sub, r: await cc([sub, "--help"]) })),
		);
		for (const { sub, r } of runs) {
			expect(top.out).toContain(sub);
			expect(r.code).toBe(0);
			expect(r.out).toContain(sub);
			expect(r.out).not.toBe(top.out);
			expect(r.err).toBe("");
		}
	});
});

describe("cache", () => {
	test("a page read once is served offline from the cache", async () => {
		const { site, env } = await withSite();
		const live = await cc(["read", "configure/hooks"], env);
		expect(live.out).toMatch(/Source: .*, live/u);
		await site.stop();
		const off = await cc(["read", "configure/hooks"], {
			...env,
			CLAWDIPEDIA_TTL_SCALE: "0",
		});
		expect(off.code).toBe(0);
		expect(off.out).toContain("PreToolUse");
		expect(off.out).toMatch(/Source: .*cache \(.*offline\)/u);
	});

	test("the cache folder order is CLAWDIPEDIA_CACHE_DIR, CLAUDE_PLUGIN_DATA, then the home folder", async () => {
		const site = mockSite();
		const data = await tmp();
		const a = await cc(["read", "configure/hooks"], {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAUDE_PLUGIN_DATA: data,
		});
		expect(a.code).toBe(0);
		expect(
			await pathExists(
				join(data, "cache", "site", "pages", "configure", "hooks.md"),
			),
		).toBe(true);
		const dir = await tmp();
		const data2 = await tmp();
		await cc(["read", "configure/hooks"], {
			CLAWDIPEDIA_BASE_URL: site.url,
			CLAWDIPEDIA_CACHE_DIR: dir,
			CLAUDE_PLUGIN_DATA: data2,
		});
		expect(
			await pathExists(join(dir, "site", "pages", "configure", "hooks.md")),
		).toBe(true);
		expect(await pathExists(join(data2, "cache"))).toBe(false);
		// With neither set, the cache is under the home folder (a temp HOME here).
		const home = await tmp();
		await cc(["read", "configure/hooks"], {
			CLAWDIPEDIA_BASE_URL: site.url,
			HOME: home,
			XDG_CACHE_HOME: "",
		});
		expect(
			await pathExists(
				join(
					home,
					".cache",
					"clawdipedia",
					"site",
					"pages",
					"configure",
					"hooks.md",
				),
			),
		).toBe(true);
	});
});
