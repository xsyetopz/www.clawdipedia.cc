import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";

import { listInstalls, program } from "../../src/binary.ts";
import { Resolver } from "../../src/resolve.ts";
import { surface } from "../../src/surface/index.ts";
import { baseTools } from "../../src/tools.ts";
import { byCode } from "./util.ts";

const installs = await listInstalls();
const has = installs.some((i) => i.version === "2.1.309");

type Program = Awaited<ReturnType<typeof program>>;
let cached: Promise<Program> | undefined;
// The program loads on the first test that needs it, so a skipped run never reads the binary.
const prog = (): Promise<Program> => {
	cached ??= program("2.1.309");
	return cached;
};
const get = async (kind: string) => {
	const p = await prog();
	const found = await surface(await p.bundle(), kind, p.modules);
	return found.map((i) => i.name);
};

describe.skipIf(!has)("installed binary 2.1.309", () => {
	test("tool: the names of tool-gates", async () => {
		const n = await get("tool");
		const p = await prog();
		const bundle = await p.bundle();
		expect(n).toEqual(
			[
				...new Set(baseTools(bundle, new Resolver()).tools.map((t) => t.name)),
			].toSorted(byCode),
		);
		expect(n).toContain("Bash");
		expect(n).toContain("Agent");
	}, 300_000);

	test("otel-event", async () => {
		const n = await get("otel-event");
		expect(n).toContain("tool_result");
		expect(n).toContain("api_error");
	}, 300_000);

	test("mod-api", async () => {
		const n = await get("mod-api");
		expect(n).toContain("$.agent.spawn");
		expect(n).toContain("tool.check");
		expect(n.filter((x) => x.startsWith("classic."))).toHaveLength(33);
	}, 300_000);

	test("env", async () => {
		expect(await get("env")).toContain(
			"CLAUDE_CODE_DISABLE_ULTRAREVIEW_TRUST_CHECK",
		);
	}, 300_000);

	test("hook-event", async () => {
		const n = await get("hook-event");
		expect(n).toContain("PreToolUse");
		expect(n).toContain("SessionStart");
		expect(n).toHaveLength(33);
	}, 300_000);

	test("setting", async () => {
		const n = await get("setting");
		expect(n).toContain("permissions");
		expect(n).toHaveLength(194);
	}, 300_000);

	test("gate", async () => {
		const n = await get("gate");
		expect(n).toContain("tengu_calm_eagle");
		expect(new Set(n).size).toBe(1101);
	}, 300_000);

	test("flag", async () => {
		const n = await get("flag");
		expect(n).toContain("--model");
		expect(n).toContain("--debug");
	}, 300_000);

	test("subcommand", async () => {
		const n = await get("subcommand");
		expect(n).toContain("mcp");
		expect(n).toContain("auth login");
	}, 300_000);

	test("slash-command", async () => {
		const n = await get("slash-command");
		expect(n).toContain("/compact");
		expect(n).toContain("/model");
	}, 300_000);

	test("keybinding", async () => {
		const n = await get("keybinding");
		expect(n).toContain("chat:cancel");
		expect(n).toContain("Global");
	}, 300_000);

	test("model", async () => {
		const n = await get("model");
		expect(n).toContain("claude-opus-4-6");
		expect(n).toContain("claude-sonnet-4-5");
		expect(n).toContain("opusplan");
	}, 300_000);

	test("beta: the names of the docs page", async () => {
		const n = await get("beta");
		for (const beta of [
			"context-1m-2025-08-07",
			"claude-code-20250219",
			"oauth-2025-04-20",
			"interleaved-thinking-2025-05-14",
			"ccr-byoc-2025-07-29",
			"afk-mode-2026-01-31",
			"token-counting-2024-11-01",
		]) {
			expect(n).toContain(beta);
		}
		expect(n).not.toContain("bedrock-2023-05-31");
		const p = await prog();
		const found = await surface(await p.bundle(), "beta", p.modules);
		expect(found.find((i) => i.name === "context-1m-2025-08-07")?.detail).toBe(
			"long_context",
		);
	}, 300_000);

	test("endpoint", async () => {
		const n = await get("endpoint");
		expect(n).toContain("https://api.anthropic.com");
		expect(n).toContain("https://api.anthropic.com/api/event_logging/v2/batch");
		expect(n).toContain("/api/oauth/profile");
		expect(n).toContain("/api/hello");
		// Paths from the docs endpoint table (docs/reference/api/endpoints.md).
		for (const path of [
			"/v1/messages/count_tokens",
			"/api/oauth/usage",
			"/api/claude_code/policy_limits",
			"/api/event_logging/v2/batch",
			"/v1/traces",
		]) {
			expect(n).toContain(path);
		}
	}, 300_000);

	test("file", async () => {
		const n = await get("file");
		expect(n).toContain("keybindings.json");
		expect(n).toContain("history.jsonl");
		expect(n).toContain("policy-limits.json");
	}, 300_000);

	test("permission-rule: the modes of the docs page", async () => {
		expect(await get("permission-rule")).toEqual([
			"acceptEdits",
			"auto",
			"bypassPermissions",
			"default",
			"dontAsk",
			"plan",
		]);
	}, 300_000);

	test("error", async () => {
		const n = await get("error");
		expect(n).toContain("Not connected");
		expect(n.some((x) => x.startsWith("Cloud gateway"))).toBe(true);
		expect(n.filter((x) => x.length < 10)).toEqual([]);
		expect(n.filter((x) => !x.includes(" "))).toEqual([]);
	}, 300_000);
});

interface SchemaNode {
	title?: unknown;
	$defs?: unknown;
	definitions?: unknown;
	$ref?: unknown;
	anyOf?: unknown;
	oneOf?: unknown;
	allOf?: unknown;
	properties?: unknown;
	additionalProperties?: unknown;
}
const isRecord = (x: unknown): x is Record<string, unknown> =>
	typeof x === "object" && x !== null;
const isSchemaNode = (x: unknown): x is SchemaNode =>
	typeof x === "object" && x !== null;

// The generated managed-settings schema comes from running the program's zod validators, so its nested
// property paths are an oracle for the `setting-key` walk of the same version's code.
const schema: unknown = await Bun.file(
	join(
		import.meta.dir,
		"../../../../schemas/claude-code-managed-settings.json",
	),
).json();
const schemaTitle =
	isSchemaNode(schema) && typeof schema.title === "string" ? schema.title : "";
const schemaVersion = /Claude Code ([\d.]+)\)/u.exec(schemaTitle)?.[1] ?? "";
const hasSchema = installs.some((i) => i.version === schemaVersion);

const definition = (ref: string): unknown => {
	if (!isSchemaNode(schema)) {
		return undefined;
	}
	const defs = schema.$defs ?? schema.definitions;
	return isRecord(defs) ? defs[ref] : undefined;
};

const collect = (n: unknown, path: string, paths: Set<string>): void => {
	if (!isSchemaNode(n)) {
		return;
	}
	const ref = typeof n.$ref === "string" ? n.$ref.split("/").pop() : undefined;
	if (ref !== undefined && ref !== "") {
		collect(definition(ref), path, paths);
	}
	for (const list of [n.anyOf, n.oneOf, n.allOf]) {
		for (const x of Array.isArray(list) ? list : []) {
			collect(x, path, paths);
		}
	}
	const props = isRecord(n.properties) ? n.properties : {};
	for (const [k, v] of Object.entries(props)) {
		const q = path === "" ? k : `${path}.${k}`;
		if (path !== "") {
			paths.add(q);
		}
		collect(v, q, paths);
	}
	if (isRecord(n.additionalProperties)) {
		collect(n.additionalProperties, `${path}.*`, paths);
	}
};

describe.skipIf(!hasSchema)("setting-key against the generated schema", () => {
	let leaves: string[] = [];
	beforeAll(() => {
		const paths = new Set<string>();
		collect(schema, "", paths);
		leaves = [...paths]
			.filter((q) => ![...paths].some((o) => o.startsWith(`${q}.`)))
			.toSorted(byCode);
	});

	test("names every nested leaf property path of the schema, and no other", async () => {
		const p = await program(schemaVersion);
		const found = await surface(await p.bundle(), "setting-key", p.modules);
		const got = found.map((i) => i.name);
		expect(got).toEqual(leaves);
	}, 300_000);
});
