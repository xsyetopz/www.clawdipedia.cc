import { expect, test } from "bun:test";
import { access } from "node:fs/promises";
import { join } from "node:path";

import { failureOf } from "./failure.ts";
import { withRamDisk } from "./ramdisk.ts";

test.skipIf(process.platform !== "darwin")(
	"RAM disk fills, then is removed",
	async () => {
		let dir = "";
		await withRamDisk(4096, async (d) => {
			dir = d.dir;
			await d.fillLeaving(64 * 1024);
			expect(await d.free()).toBeLessThanOrEqual(64 * 1024);
			const full = await failureOf(
				Bun.write(join(d.dir, "big"), Buffer.alloc(512 * 1024)),
			);
			expect(full).toBeDefined();
		});
		expect(await failureOf(access(dir))).toBeDefined();
		const mounts = Bun.spawn(["sh", "-c", "mount | grep -c probe-ram"], {
			stdout: "pipe",
		});
		const count = await new Response(mounts.stdout).text();
		expect(count.trim()).toBe("0");
	},
	20_000,
);
