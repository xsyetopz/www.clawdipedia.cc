// Run: bun test inspect/mcp/test   (needs inspect/mcp/dist/server.js; part of plugin:check)
import { expect, test } from "bun:test";
import { rm } from "node:fs/promises";
import { join } from "node:path";

import { startServer, structured } from "./server-harness.ts";

const { tmp, call } = startServer({ CC_INSPECT_IDLE_MS: "1" });

const IDLE = 500;

test("after the idle time, the server keeps no prepared index and gives the same object keys", async () => {
	const prepare = { action: "prepare", version: "9.9.9" };
	const keys = { kind: "object-keys", module: "app.js", anchor: '"Bash"' };
	const first = await call("surface", keys);
	expect(structured(first)["keys"]).toHaveProperty("tool_name");
	expect(structured(await call("code", prepare))["parsed"]).toBe(1);
	// With no cache on disk, only an index kept in memory can give `parsed: 0`.
	await rm(join(tmp, "cache", "9.9.9"), { recursive: true });
	await Bun.sleep(IDLE);
	expect(structured(await call("code", prepare))["parsed"]).toBe(1);
	await Bun.sleep(IDLE);
	expect(structured(await call("surface", keys))).toEqual(structured(first));
});
