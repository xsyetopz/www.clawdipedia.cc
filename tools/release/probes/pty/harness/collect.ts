// Reads what a pty run left behind: request log, hook logs, files under the sandbox home, and the raw bytes.
import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import type { PtyResult } from "../../../lib/pty/driver.ts";
import type { Sandbox } from "../../../lib/sandbox.ts";
import { readLog } from "../../../lib/stub.ts";
import { pathExists } from "../../print/run/files.ts";
import { eachInOrder } from "../../print/run/seq.ts";
import { isSystemMsg } from "./read.ts";
import {
	type Obj,
	obj,
	type PtyCase,
	type PtyCtx,
	type PtyRun,
} from "./types.ts";

const parseLog = (text: string): { t: number; json: Obj; line: string }[] =>
	text
		.split("\n")
		.filter((line) => line !== "")
		.map((line) => {
			const i = line.indexOf(" ");
			let json: Obj = {};
			try {
				json = obj(JSON.parse(line.slice(i + 1)));
			} catch {
				// keep an empty object
			}
			return { t: Number(line.slice(0, i)), json, line };
		});

const readTree = (root: string): Promise<string[]> =>
	Array.fromAsync(
		new Bun.Glob("**/*").scan({ cwd: root, dot: true, onlyFiles: true }),
	);

/** Every file under a sandbox dir, read once after the run so the case readers stay synchronous. */
const readDir = async (
	root: string,
	dir: string,
	tree: string[],
): Promise<Record<string, string>> => {
	const names = tree
		.filter((n) => n.startsWith(`${dir}/`))
		.map((n) => n.slice(dir.length + 1));
	const texts = await Promise.all(
		names.map((n) =>
			Bun.file(join(root, dir, n))
				.text()
				.catch(() => ""),
		),
	);
	return Object.fromEntries(names.map((n, i) => [n, texts[i] ?? ""]));
};

export const buildRun = async (
	sb: Sandbox,
	pty: PtyResult,
	log: string,
): Promise<PtyRun> => {
	const reqs = (await pathExists(log)) ? await readLog(log) : [];
	const tree = await readTree(sb.root);
	const files = await readDir(sb.root, "home", tree);
	const cfg = await readDir(sb.root, "cfg", tree);
	return {
		pty,
		screen: pty.screen,
		reqs,
		sb,
		tree,
		files,
		raw: await Bun.file(pty.rawPath).bytes(),
		hook: (e) => parseLog(files[`hooklog/${e}.log`] ?? ""),
		file: (rel) => files[rel] ?? "",
		cfgFile: (rel) => cfg[rel] ?? "",
		messages: reqs.filter((r) => isSystemMsg(r)),
	};
};

/** Keeps the raw bytes, byte offsets and rendered screen beside the JSON (never diffed), plus the case's own artifacts. */
export const archive = async (
	ctx: PtyCtx,
	c: PtyCase,
	run: PtyRun,
): Promise<void> => {
	const dest = join(ctx.runDir, "pty");
	await mkdir(dest, { recursive: true });
	const stem = join(dest, c.id);
	const raw = run.pty.rawPath;
	await eachInOrder(
		[
			[raw, `${stem}.raw`],
			[`${raw}.idx`, `${stem}.idx`],
			[`${raw}.sent`, `${stem}.sent`],
			[`${raw}.screen.txt`, `${stem}.screen.txt`],
		] as const,
		async ([from, to]) => {
			if (await pathExists(from)) {
				await copyFile(from, to);
			}
		},
	);
	await eachInOrder(
		Object.entries(c.artifacts?.(run) ?? {}),
		async ([name, text]) => {
			await Bun.write(`${stem}.${name}`, text);
		},
	);
};
