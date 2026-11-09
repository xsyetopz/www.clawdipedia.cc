// A tiny RAM disk for probes that need a full filesystem (macOS only: hdiutil, newfs_hfs, mount).
// A missing tool stops with the name of the step that fails; the disk is always unmounted and ejected.
import { mkdtemp, open, rm, stat } from "node:fs/promises";
import type { FileHandle } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const run = async (
	cmd: string[],
): Promise<{ code: number; stdout: string; stderr: string }> => {
	const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, code] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	return { code, stdout, stderr };
};

const sh = async (cmd: string[]): Promise<string> => {
	const r = await run(cmd);
	if (r.code !== 0) {
		throw new Error(`ramdisk: ${cmd.join(" ")} failed: ${r.stderr.trim()}`);
	}
	return r.stdout;
};

export interface RamDisk {
	dir: string;
	free: () => Promise<number>;
	fillLeaving: (bytes: number) => Promise<void>;
}

const statfsFree = async (dir: string): Promise<number> => {
	const df = await sh(["df", "-k", dir]);
	const out = df.trim().split("\n").pop() ?? "";
	const kb = Number(out.split(/\s+/u)[3]);
	await stat(dir);
	return kb * 1024;
};

/** File system overhead can leave more free than one write took, so measure again after each write. */
const fillFrom = async (
	fh: FileHandle,
	dir: string,
	bytes: number,
): Promise<void> => {
	const gap = (await statfsFree(dir)) - bytes;
	if (gap <= 0) {
		return;
	}
	await fh.write(Buffer.alloc(gap, 1));
	await fillFrom(fh, dir, bytes);
};

const fillLeaving = async (dir: string, bytes: number): Promise<void> => {
	const fh = await open(join(dir, "fill"), "w");
	try {
		await fillFrom(fh, dir, bytes);
	} finally {
		await fh.close();
	}
};

/** Run fn with a RAM disk of `sectors` 512-byte sectors mounted at a new temp directory. */
export const withRamDisk = async <T>(
	sectors: number,
	fn: (d: RamDisk) => Promise<T> | T,
): Promise<T> => {
	if (process.platform !== "darwin") {
		throw new Error(
			"ramdisk: needs macOS (hdiutil); this step is not available here",
		);
	}
	const attached = await sh([
		"hdiutil",
		"attach",
		"-nomount",
		`ram://${sectors}`,
	]);
	const dev = attached.replaceAll(/\s/gu, "");
	const dir = await mkdtemp(join(tmpdir(), "probe-ram-"));
	let mounted = false;
	try {
		await sh(["newfs_hfs", "-v", "probe", dev]);
		await sh(["mount", "-t", "hfs", dev, dir]);
		mounted = true;
		return await fn({
			dir,
			free: () => statfsFree(dir),
			fillLeaving: (bytes) => fillLeaving(dir, bytes),
		});
	} finally {
		if (mounted) {
			await run(["umount", "-f", dir]);
		}
		await run(["diskutil", "eject", dev]);
		await rm(dir, { recursive: true, force: true });
	}
};
