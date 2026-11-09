// The host checks of release:check: ports, the managed folder, the parent env, the captures sizes.
import { readdir, stat } from "node:fs/promises";
import { platform } from "node:os";
import { join } from "node:path";

import { pathExists } from "../lib/fs.ts";
import { inUse, osPort } from "../lib/ports.ts";
import { CAPTURES } from "../util.ts";
import type { Check } from "./tools.ts";

export const MANAGED_DIR =
	platform() === "darwin"
		? "/Library/Application Support/ClaudeCode"
		: "/etc/claude-code";

const dirSize = async (p: string): Promise<number> => {
	const entries = await readdir(p, { withFileTypes: true });
	const sizes = await Promise.all(
		entries.map(async (e) => {
			const q = join(p, e.name);
			if (e.isDirectory()) {
				return dirSize(q);
			}
			if (!e.isFile()) {
				return 0;
			}
			const st = await stat(q);
			return st.size;
		}),
	);
	let total = 0;
	for (const n of sizes) {
		total += n;
	}
	return total;
};

export const portChecks = async (): Promise<{
	checks: Check[];
	ports: number[];
	busy: number[];
}> => {
	const ports = await Promise.all([osPort(), osPort(), osPort()]);
	const range = Array.from({ length: 100 }, (_, i) => 18_400 + i);
	const used = await Promise.all(range.map((p) => inUse(p)));
	const busy = range.filter((_, i) => used[i] === true);
	return {
		ports,
		busy,
		checks: [
			{
				id: "ports.dynamic",
				level: "ok",
				detail: `OS-assigned ports bind: ${ports.join(", ")}`,
			},
			{
				id: "ports.fixed-range",
				level: busy.length > 0 ? "warn" : "ok",
				detail:
					busy.length > 0
						? `in use in 18400-18499: ${busy.join(", ")} (the toolkit does not need them)`
						: "18400-18499 free",
			},
		],
	};
};

export const managedCheck = async (): Promise<{
	check: Check;
	managed: boolean;
}> => {
	const managed = await pathExists(MANAGED_DIR);
	const names = managed ? await readdir(MANAGED_DIR) : [];
	return {
		managed,
		check: {
			id: "managed.folder",
			level: managed ? "warn" : "ok",
			detail: managed
				? `${MANAGED_DIR} exists: ${names.length > 0 ? names.join(", ") : "(empty)"}. It changes every run unless it is the expected fixture.`
				: `${MANAGED_DIR} absent`,
		},
	};
};

export const parentEnvCheck = (): Check[] => {
	const leaked = Object.entries(process.env)
		.filter(
			([k, v]) => k.startsWith("CLAUDE_CODE_") && v !== undefined && v !== "",
		)
		.map(([k]) => k);
	return leaked.length > 0
		? [
				{
					id: "parent-env",
					level: "warn",
					detail: `${leaked.length} CLAUDE_CODE_* names set in this shell (${leaked.join(", ")}); the toolkit never passes them on`,
				},
			]
		: [];
};

export const capturesSizes = async (): Promise<Record<string, number>> => {
	if (!(await pathExists(CAPTURES))) {
		return {};
	}
	const entries = await readdir(CAPTURES, { withFileTypes: true });
	const dirs = entries.filter(
		(e) => e.isDirectory() && /^\d+\.\d+\.\d+$/u.test(e.name),
	);
	return Object.fromEntries(
		await Promise.all(
			dirs.map(
				async (e) => [e.name, await dirSize(join(CAPTURES, e.name))] as const,
			),
		),
	);
};
