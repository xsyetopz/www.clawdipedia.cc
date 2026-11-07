// Run: bun test inspect/mcp/test/server-npm.test.ts   (needs inspect/mcp/dist/server.js)
// `code` `npm` against a fake registry on localhost that serves one small tarball.
import { afterAll, describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startServer } from "./server-harness.ts";

const src = mkdtempSync(join(tmpdir(), "cc-inspect-npm-"));
mkdirSync(join(src, "package", "dist"), { recursive: true });
writeFileSync(
  join(src, "package", "dist", "index.js"),
  // biome-ignore lint/suspicious/noTemplateCurlyInString: the fixture source holds a real template literal
  "throw new Error('No certificate ' + 'authority to trust: ' + `${a}; set ${b} first`);\nthrow new Error('Raw mode is off.\\nRead the guide at https://example.test/raw-mode');\n",
);
writeFileSync(
  join(src, "package", "dist", "index.d.ts"),
  "// no root certificates are left\n",
);
Bun.spawnSync(["tar", "-czf", join(src, "lib.tgz"), "-C", src, "package"]);
const tgz = readFileSync(join(src, "lib.tgz"));
const sum = `sha512-${createHash("sha512").update(tgz).digest("base64")}`;
// A folder without the search bit, as pngjs 7.0.0 ships.
writeFileSync(
  join(src, "locked.mtree"),
  "#mtree\npackage type=dir mode=0644\npackage/index.js type=file mode=0644 contents=package/dist/index.js\n",
);
Bun.spawnSync(["tar", "-czf", "locked.tgz", "@locked.mtree"], { cwd: src });
const locked = readFileSync(join(src, "locked.tgz"));
const lockedSum = `sha512-${createHash("sha512").update(locked).digest("base64")}`;

const asked: string[] = [];
const registry = Bun.serve({
  port: 0,
  fetch: (req): Response => {
    const path = new URL(req.url).pathname;
    asked.push(path);
    if (path === "/lib.tgz") return new Response(tgz);
    if (path === "/locked.tgz") return new Response(locked);
    if (path === "/@fx%2flocked/1.0.0")
      return Response.json({
        version: "1.0.0",
        dist: { tarball: `${registry.url}locked.tgz`, integrity: lockedSum },
      });
    if (path === "/@fx%2flib/1.2.3" || path === "/@fx%2flib/latest")
      return Response.json({
        version: "1.2.3",
        dist: { tarball: `${registry.url}lib.tgz`, integrity: sum },
      });
    if (path === "/@fx%2fbad/1.0.0")
      return Response.json({
        version: "1.0.0",
        dist: { tarball: `${registry.url}lib.tgz`, integrity: "sha512-AAAA" },
      });
    return new Response("no", { status: 404 });
  },
});
process.env["CC_INSPECT_NPM_REGISTRY"] = registry.url.origin;

const { tmp, call } = startServer();
afterAll(() => {
  registry.stop(true);
  rmSync(src, { recursive: true, force: true });
});

describe("code npm", () => {
  test("finds a text by its static pieces in order, in the unpacked folder of the tarball", async () => {
    const r = await call("code", {
      action: "npm",
      name: "@fx/lib",
      packageVersion: "1.2.3",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${…} is the hole marker of a query
      query: "No certificate authority to trust: ${…}; set ${…} first",
    });
    expect(r.structuredContent).toMatchObject({
      package: "@fx/lib",
      version: "1.2.3",
      file: "package/dist/index.js",
    });
    expect(
      readFileSync(
        join(
          tmp,
          "cache",
          "npm",
          "@fx+lib@1.2.3",
          "package",
          "dist",
          "index.js",
        ),
        "utf8",
      ),
    ).toContain("authority");
  });

  test("matches a source newline as a space, and a query cut with a trailing …", async () => {
    const r = await call("code", {
      action: "npm",
      name: "@fx/lib",
      packageVersion: "1.2.3",
      query: "Raw mode is off. Read the guide at https://example.te…",
    });
    expect(r.structuredContent?.["file"]).toBe("package/dist/index.js");
  });

  test("reads a package whose tarball holds a folder without the search bit", async () => {
    const r = await call("code", {
      action: "npm",
      name: "@fx/locked",
      packageVersion: "1.0.0",
      query: "No certificate authority to trust",
    });
    expect(r.structuredContent?.["file"]).toBe("package/index.js");
  });

  test("does not match pieces in the wrong order, text that is absent, or text in a .d.ts file", async () => {
    for (const query of [
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${…} is the hole marker of a query
      "set ${…} first${…}No certificate authority",
      "A message that the package does not hold",
      "no root certificates are left",
    ]) {
      const r = await call("code", {
        action: "npm",
        name: "@fx/lib",
        packageVersion: "1.2.3",
        query,
      });
      expect(r.structuredContent?.["file"]).toBeUndefined();
    }
  });

  test("refuses a text too short to name a package", async () => {
    const r = await call("code", {
      action: "npm",
      name: "@fx/lib",
      packageVersion: "1.2.3",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${…} is the hole marker of a query
      query: "${…}: ${…}",
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
    expect(r.content[0]?.text).toContain("integrity");
  });
});
