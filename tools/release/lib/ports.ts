// Port allocator. OS-assigned by default; a registry dir keeps two toolkit processes from picking the same port.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { onCleanup } from "./cleanup.ts";

const REG = join(tmpdir(), "cc-release-toolkit-ports");
const mine = new Set<number>();

const alive = (pid: number): boolean => {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
};

const isExists = (error: unknown): boolean =>
	error instanceof Error && "code" in error && error.code === "EEXIST";

const readPid = async (file: string): Promise<number> => {
	try {
		return Number(await readFile(file, "utf8"));
	} catch {
		// vanished: retry
		return 0;
	}
};

const claimFrom = async (
	port: number,
	file: string,
	attempt: number,
): Promise<boolean> => {
	if (attempt >= 2) {
		return false;
	}
	try {
		await writeFile(file, String(process.pid), { flag: "wx" });
		mine.add(port);
		return true;
	} catch (error) {
		if (!isExists(error)) {
			throw error;
		}
		const pid = await readPid(file);
		if (pid > 0 && alive(pid)) {
			return false;
		}
		await rm(file, { force: true });
		return claimFrom(port, file, attempt + 1);
	}
};

/** Atomic claim (flag "wx"). A stale file (owner PID dead) is removed and retried once. Returns false if held. */
const claim = async (port: number): Promise<boolean> => {
	await mkdir(REG, { recursive: true });
	return claimFrom(port, join(REG, String(port)), 0);
};
onCleanup(async () => {
	await Promise.all(
		[...mine].map((p) => rm(join(REG, String(p)), { force: true })),
	);
});

export const inUse = (port: number): Promise<boolean> =>
	new Promise((resolve) => {
		const s = createServer();
		s.once("error", () => {
			resolve(true);
		});
		s.listen(port, "127.0.0.1", () => {
			s.close(() => {
				resolve(false);
			});
		});
	});

/** A port the OS says is free right now. Not claimed in the registry. */
export const osPort = (): Promise<number> =>
	new Promise<number>((resolve, reject) => {
		const s = createServer();
		s.once("error", reject);
		s.listen(0, "127.0.0.1", () => {
			const addr = s.address();
			if (addr === null || typeof addr === "string") {
				reject(new Error("no TCP address"));
				return;
			}
			s.close(() => {
				resolve(addr.port);
			});
		});
	});

const allocFrom = async (attempt: number): Promise<number> => {
	if (attempt >= 20) {
		throw new Error("could not allocate a free port");
	}
	const port = await osPort();
	return (await claim(port)) ? port : allocFrom(attempt + 1);
};

export const allocPort = (): Promise<number> => allocFrom(0);

const reserveFrom = async (
	p: number,
	range: [number, number],
): Promise<number> => {
	if (p > range[1]) {
		throw new Error(`no free port in ${range[0]}-${range[1]}`);
	}
	return (await claim(p)) ? p : reserveFrom(p + 1, range);
};

/** Pick an unclaimed port from a fixed range (default 18400-18499), for readable logs. Registry only; bind may still fail. */
export const reserve = (
	range: [number, number] = [18_400, 18_499],
): Promise<number> => reserveFrom(range[0], range);
