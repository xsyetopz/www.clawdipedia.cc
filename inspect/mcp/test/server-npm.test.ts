// Run: bun test inspect/mcp/test/server-npm.test.ts   (needs inspect/mcp/dist/server.js)
// `code` `npm` against a fake registry on localhost that serves one small tarball.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

import { startServer, structured, text } from "./server-harness.ts";

/** The marker of a hole in a query, written so that no plain string holds a template placeholder. */
const HOLE = `\${…}`;

const src = await mkdtemp(join(tmpdir(), "cc-inspect-npm-"));
await mkdir(join(src, "package", "dist"), { recursive: true });
// The fixture source holds a real template literal.
const SOURCE = `throw new Error('No certificate ' + 'authority to trust: ' + \`\${a}; set \${b} first\`);\nthrow new Error('Raw mode is off.\\nRead the guide at https://example.test/raw-mode');\n`;
await writeFile(join(src, "package", "dist", "index.js"), SOURCE);
await writeFile(
	join(src, "package", "dist", "index.d.ts"),
	"// no root certificates are left\n",
);
const tar = Bun.spawn([
	"tar",
	"-czf",
	join(src, "lib.tgz"),
	"-C",
	src,
	"package",
]);
await tar.exited;
const tgz = await Bun.file(join(src, "lib.tgz")).bytes();
const sum = `sha512-${createHash("sha512").update(tgz).digest("base64")}`;
/** One ustar entry, written by hand: only bsdtar takes modes from an mtree spec, and the CI runner has GNU tar. */
const ustar = (name: string, mode: number, type: "0" | "5", content = "") => {
	const body = Buffer.from(content);
	const head = Buffer.alloc(512);
	const put = (at: number, s: string) => head.write(s, at, "ascii");
	put(0, name);
	put(100, `${mode.toString(8).padStart(7, "0")}\0`);
	put(124, `${body.length.toString(8).padStart(11, "0")}\0`);
	put(148, " ".repeat(8));
	put(156, type);
	put(257, "ustar\u000000");
	put(
		148,
		`${head
			.reduce((a, b) => a + b, 0)
			.toString(8)
			.padStart(6, "0")}\0 `,
	);
	return Buffer.concat([head, body, Buffer.alloc(-body.length & 511)]);
};
// A folder without the search bit, as pngjs 7.0.0 ships.
const locked = await promisify(gzip)(
	Buffer.concat([
		ustar("package/", 0o644, "5"),
		ustar("package/index.js", 0o644, "0", SOURCE),
		Buffer.alloc(1024),
	]),
);
const lockedSum = `sha512-${createHash("sha512").update(locked).digest("base64")}`;

const asked: string[] = [];
const registry = Bun.serve({
	port: 0,
	fetch: (req): Response => {
		const path = new URL(req.url).pathname;
		asked.push(path);
		if (path === "/lib.tgz") {
			return new Response(tgz);
		}
		if (path === "/locked.tgz") {
			return new Response(locked);
		}
		if (path === "/@fx%2flocked/1.0.0") {
			return Response.json({
				version: "1.0.0",
				dist: { tarball: `${registry.url}locked.tgz`, integrity: lockedSum },
			});
		}
		if (path === "/@fx%2flib/1.2.3" || path === "/@fx%2flib/latest") {
			return Response.json({
				version: "1.2.3",
				dist: { tarball: `${registry.url}lib.tgz`, integrity: sum },
			});
		}
		if (path === "/@fx%2fbad/1.0.0") {
			return Response.json({
				version: "1.0.0",
				dist: { tarball: `${registry.url}lib.tgz`, integrity: "sha512-AAAA" },
			});
		}
		return new Response("no", { status: 404 });
	},
});
process.env["CC_INSPECT_NPM_REGISTRY"] = registry.url.origin;

const { tmp, call } = startServer();
afterAll(async () => {
	await registry.stop(true);
	await rm(src, { recursive: true, force: true });
});

describe("code npm", () => {
	test("finds a text by its static pieces in order, in the unpacked folder of the tarball", async () => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/lib",
			packageVersion: "1.2.3",
			query: `No certificate authority to trust: ${HOLE}; set ${HOLE} first`,
		});
		expect(r.structuredContent).toMatchObject({
			package: "@fx/lib",
			version: "1.2.3",
			file: "package/dist/index.js",
		});
		const unpacked = await Bun.file(
			join(tmp, "cache", "npm", "@fx+lib@1.2.3", "package", "dist", "index.js"),
		).text();
		expect(unpacked).toContain("authority");
	});

	test("matches a source newline as a space, and a query cut with a trailing …", async () => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/lib",
			packageVersion: "1.2.3",
			query: "Raw mode is off. Read the guide at https://example.te…",
		});
		expect(structured(r)["file"]).toBe("package/dist/index.js");
	});

	test("reads a package whose tarball holds a folder without the search bit", async () => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/locked",
			packageVersion: "1.0.0",
			query: "No certificate authority to trust",
		});
		expect(structured(r)["file"]).toBe("package/index.js");
	});

	test.each([
		[
			"pieces in the wrong order",
			`set ${HOLE} first${HOLE}No certificate authority`,
		],
		["text that is absent", "A message that the package does not hold"],
		["text in a .d.ts file", "no root certificates are left"],
	])("does not match %s", async (_name, query) => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/lib",
			packageVersion: "1.2.3",
			query,
		});
		expect(structured(r)["file"]).toBeUndefined();
	});

	test("refuses a text too short to name a package", async () => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/lib",
			packageVersion: "1.2.3",
			query: `${HOLE}: ${HOLE}`,
		});
		expect(r.structuredContent).toMatchObject({ short: true });
	});

	test("looks up latest once, keeps it, and does not ask the registry again for a cached version", async () => {
		await call("code", {
			action: "npm",
			name: "@fx/lib",
			query: "No certificate authority",
		});
		asked.length = 0;
		const r = await call("code", {
			action: "npm",
			name: "@fx/lib",
			query: "No certificate authority",
		});
		expect(r.structuredContent).toMatchObject({ version: "1.2.3" });
		expect(asked).toEqual([]);
	});

	test("rejects a tarball whose hash differs from the registry", async () => {
		const r = await call("code", {
			action: "npm",
			name: "@fx/bad",
			packageVersion: "1.0.0",
			query: "No certificate authority",
		});
		expect(r.isError).toBe(true);
		expect(text(r)).toContain("integrity");
	});
});
