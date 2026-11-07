// A tiny RAM disk for probes that need a full filesystem (macOS only: hdiutil, newfs_hfs, mount).
// A missing tool stops with the name of the step that fails; the disk is always unmounted and ejected.
import {
  closeSync,
  mkdtempSync,
  openSync,
  rmSync,
  statSync,
  writeSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const sh = (cmd: string[]): string => {
  const p = Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0)
    throw new Error(
      `ramdisk: ${cmd.join(" ")} failed: ${p.stderr.toString().trim()}`,
    );
  return p.stdout.toString();
};

export type RamDisk = {
  dir: string;
  free: () => number;
  fillLeaving: (bytes: number) => void;
};

/** Run fn with a RAM disk of `sectors` 512-byte sectors mounted at a new temp directory. */
export const withRamDisk = async <T>(
  sectors: number,
  fn: (d: RamDisk) => Promise<T> | T,
): Promise<T> => {
  if (process.platform !== "darwin")
    throw new Error(
      "ramdisk: needs macOS (hdiutil); this step is not available here",
    );
  const dev = sh(["hdiutil", "attach", "-nomount", `ram://${sectors}`]).replace(
    /\s/g,
    "",
  );
  const dir = mkdtempSync(join(tmpdir(), "probe-ram-"));
  let mounted = false;
  try {
    sh(["newfs_hfs", "-v", "probe", dev]);
    sh(["mount", "-t", "hfs", dev, dir]);
    mounted = true;
    const free = (): number => {
      const s = statfsFree(dir);
      return s;
    };
    return await fn({
      dir,
      free,
      fillLeaving: (bytes) => {
        const fd = openSync(join(dir, "fill"), "w");
        try {
          // file system overhead can leave more free than one write took, so measure again
          for (let gap = free() - bytes; gap > 0; gap = free() - bytes)
            writeSync(fd, Buffer.alloc(gap, 1));
        } finally {
          closeSync(fd);
        }
      },
    });
  } finally {
    if (mounted) Bun.spawnSync(["umount", "-f", dir]);
    Bun.spawnSync(["diskutil", "eject", dev]);
    rmSync(dir, { recursive: true, force: true });
  }
};

const statfsFree = (dir: string): number => {
  const out = sh(["df", "-k", dir]).trim().split("\n").pop() ?? "";
  const kb = Number(out.split(/\s+/)[3]);
  statSync(dir);
  return kb * 1024;
};
