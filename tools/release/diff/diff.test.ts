import { expect, test } from "bun:test";

import type { SurfaceItem } from "../../../inspect/mcp/src/surface/index.ts";
import { type Group, groups, itemsOf } from "./diff/groups.ts";
import { diffKind } from "./diff/kind.ts";
import { pageOf } from "./diff/page.ts";
import { renderReport } from "./diff/report.ts";

const item = (kind: string, name: string, extra = {}): SurfaceItem => ({
	kind,
	name,
	module: null,
	offset: 0,
	...extra,
});

const group = (key: string): Group => {
	const g = groups(["beta"]).find((x) => x.key === key);
	if (g === undefined) {
		throw new Error(`no group ${key}`);
	}
	return g;
};

const old = {
	subcommand: [item("subcommand", "mcp")],
	"slash-command": [item("slash-command", "/help")],
	beta: [item("beta", "gone-2025-01-01")],
};
const neu = {
	subcommand: [item("subcommand", "mcp"), item("subcommand", "doctor")],
	"slash-command": [item("slash-command", "/help", { gate: "hidden" })],
	beta: [item("beta", "new-2026-01-01", { detail: "x" })],
};

test("the six legacy files come first, then one group for each other kind", () => {
	const gs = groups(["beta", "env", "subcommand"]);
	expect(gs.map((g) => g.file)).toEqual([
		"strings-env.json",
		"flags.json",
		"commands.json",
		"settings.json",
		"hooks.json",
		"gates.json",
		"beta.json",
	]);
});

test("commands join subcommands as cli:name and slash commands as /name", () => {
	const commands = group("commands");
	const items = itemsOf(commands, neu);
	expect([...items.keys()].toSorted()).toEqual([
		"/help",
		"cli:doctor",
		"cli:mcp",
	]);
	expect(items.get("/help")).toBe("gate: hidden");
});

test("an added item lists its target page under its kind in report.md", () => {
	const beta = group("beta");
	const d = diffKind(
		"beta",
		"1.0.0",
		"1.0.1",
		itemsOf(beta, old),
		itemsOf(beta, neu),
		[],
		(n) => `docs/reference/api/betas.md (no row yet) for ${n}`,
	);
	expect(d.added).toEqual(["new-2026-01-01"]);
	expect(d.removed).toEqual(["gone-2025-01-01"]);
	const report = renderReport("1.0.0", "1.0.1", [d], { beta: "Betas" });
	expect(report).toContain("## Betas");
	expect(report).toContain(
		"- `new-2026-01-01` new -> docs/reference/api/betas.md (no row yet) for new-2026-01-01",
	);
});

test("a changed detail is a changed item with old and new", () => {
	const commands = group("commands");
	const d = diffKind(
		"commands",
		"a",
		"b",
		itemsOf(commands, old),
		itemsOf(commands, neu),
		[],
	);
	expect(d.changed).toEqual([{ name: "/help", old: "", new: "gate: hidden" }]);
	expect(d.added).toEqual(["cli:doctor"]);
});

test("the page of an item: docs file, map route, exclusion, or the page of its kind", () => {
	const docs = new Map([["A", "/repo/docs/x.md"]]);
	const map = { "env:B": { route: "/r", anchor: "s" } };
	const ex = { "env:LIB_*": "library" };
	expect(pageOf("env", "B", docs, map, ex)).toBe("/r#s");
	expect(pageOf("env", "LIB_X", docs, map, ex)).toBe("excluded: library");
	expect(pageOf("env", "C", docs, map, ex)).toBe(
		"docs/configure/env-vars (no row yet)",
	);
	expect(pageOf("error", "Some text", docs, map, ex)).toBe("no page yet");
});

test("the page of an error item mapped by a prefix key is the prefix's route", () => {
	const map = { "error:$.ui.*": { route: "/ui", anchor: "errors" } };
	expect(pageOf("error", "$.ui.x: bad", new Map(), map, {})).toBe("/ui#errors");
});

test("a new minified name or chunk hash is no change, a new default is", () => {
	const a = new Map([
		[
			"/add-dir",
			"gate: isEnabled ()=>_e()&&tii(); detail: local-jsx | Add a dir",
		],
		[
			"Artifact",
			'gate: un (=import.meta.require("/$bunfs/root/chunk-f3waybkd.js").X)',
		],
		["xaaIdp", "gate: a.CLAUDE_CODE_ENABLE_XAA"],
		["tengu_walnut_tiller", "default: false"],
	]);
	const b = new Map([
		[
			"/add-dir",
			"gate: isEnabled ()=>_e()&&kdi(); detail: local-jsx | Add a dir",
		],
		[
			"Artifact",
			'gate: an (=import.meta.require("/$bunfs/root/chunk-1zefh2nd.js").X)',
		],
		["xaaIdp", "gate: i.CLAUDE_CODE_ENABLE_XAA"],
		["tengu_walnut_tiller", "default: true"],
	]);
	const d = diffKind("x", "a", "b", a, b, []);
	expect(d.changed.map((c) => c.name)).toEqual(["tengu_walnut_tiller"]);
});
