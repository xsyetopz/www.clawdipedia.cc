import { expect, test } from "bun:test";

import { Bundle } from "../../inspect/mcp/src/ast.ts";
import { pick } from "./audit-pick.ts";
import type { Ctx } from "./audit-types.ts";

const SRC =
	'var T=[{id:"old-model-1",status:"retired"}];var live="new-model-2";fetch({url:"/api/called"});var u="/api/named";';

const ctx = async (): Promise<Ctx> => ({
	version: "0.0.0",
	root: "",
	bundle: await Bundle.parse([{ name: "/$bunfs/root/a.js", text: SRC }]),
	items: new Map(),
	sweep: {},
	endpointRows: new Map(),
	libraries: {},
});

const verdict = async (kind: string, name: string) => {
	const [check, run] = pick(await ctx(), "Not a thing to set.", {
		kind,
		name,
		module: "a.js",
		offset: SRC.indexOf(name),
	});
	const { ok } = await run();
	return { check, ok };
};

test("a model id passes only in a row with the retired status", async () => {
	expect(await verdict("model", "old-model-1")).toEqual({
		check: "model-only-in-retired-text",
		ok: true,
	});
	expect(await verdict("model", "new-model-2")).toEqual({
		check: "model-only-in-retired-text",
		ok: false,
	});
});

test("an endpoint in the options object of an HTTP call is called", async () => {
	expect(await verdict("endpoint", "/api/called")).toEqual({
		check: "endpoint-not-called",
		ok: false,
	});
	expect(await verdict("endpoint", "/api/named")).toEqual({
		check: "endpoint-not-called",
		ok: true,
	});
});
