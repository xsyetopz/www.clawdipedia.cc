import { expect, test } from "bun:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { withRamDisk } from "./ramdisk.ts";

test.skipIf(process.platform !== "darwin")(
  "RAM disk fills, then is removed",
  async () => {
    let dir = "";
    await withRamDisk(4096, (d) => {
      dir = d.dir;
      d.fillLeaving(64 * 1024);
      expect(d.free()).toBeLessThanOrEqual(64 * 1024);
      expect(() =>
        writeFileSync(join(d.dir, "big"), Buffer.alloc(512 * 1024)),
      ).toThrow();
    });
    expect(existsSync(dir)).toBe(false);
    expect(
      Bun.spawnSync(["sh", "-c", "mount | grep -c probe-ram"])
        .stdout.toString()
        .trim(),
    ).toBe("0");
  },
  20_000,
);
