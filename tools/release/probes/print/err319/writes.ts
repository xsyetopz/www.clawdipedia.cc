import { withRamDisk } from "../../../lib/ramdisk.ts";
import { type CaseDef, json, type Spec, withRun } from "../run/helpers.ts";
import { grep, one } from "./one.ts";

const BYPASS = ["--permission-mode", "bypassPermissions"];
const VERIFY = /tool_result|verification|does not hold/u;
const READ = { name: "Read", input: { file_path: "{PROJ}/racy.txt" } };
const LONGER = {
	name: "Write",
	input: {
		file_path: "{PROJ}/racy.txt",
		content: "a longer replacement text that is not one letter",
	},
};

const racy: NonNullable<Spec["setup"]> = async (sb) => {
	await Bun.write(`${sb.proj}/racy.txt`, "start\n");
};

const fullDisk: CaseDef = {
	name: "write-verify-full-disk",
	run: (ctx) =>
		withRamDisk(4096, async (d) => {
			await d.fillLeaving(32 * 1024);
			return withRun(
				ctx,
				{
					args: BYPASS,
					stub: {
						seq: [
							{
								name: "Write",
								input: {
									file_path: `${d.dir}/new.txt`,
									content: "x".repeat(300 * 1024),
								},
							},
						],
					},
				},
				async (r) => ({
					from: r,
					data: { exit: r.code, free_before: await d.free() },
					samples: {
						text: await grep(r, /tool_result|verification|space|ENOSPC/u),
					},
				}),
			);
		}),
};

export const writeCases: CaseDef[] = [
	one(
		"write-verify-race",
		{
			setup: racy,
			args: BYPASS,
			stub: {
				seq: [
					READ,
					{
						name: "Bash",
						input: {
							command:
								"(i=0; while [ $i -lt 40000 ]; do printf 'x' > racy.txt; i=$((i+1)); done) >/dev/null 2>&1 &",
						},
					},
					LONGER,
				],
			},
		},
		VERIFY,
	),
	one(
		"write-verify-watcher",
		{
			setup: racy,
			args: BYPASS,
			stub: {
				seq: [
					READ,
					{
						name: "Bash",
						input: {
							// Rewrites the file in place with same-size other bytes as soon as its mtime moves (after the Write began).
							command: String.raw`python3 -c "import os,time\np='racy.txt'\nm=os.stat(p).st_mtime_ns\nt=time.time()+20\nwhile time.time()<t:\n  if os.stat(p).st_mtime_ns!=m:\n    n=os.stat(p).st_size\n    f=os.open(p,os.O_WRONLY)\n    os.write(f,b'Z'*n)\n    break\n" >/dev/null 2>&1 &`,
						},
					},
					LONGER,
				],
			},
		},
		VERIFY,
	),
	one(
		"write-verify-pretooluse-order",
		{
			setup: racy,
			args: BYPASS,
			cfgFiles: {
				"settings.json": json({
					hooks: {
						PreToolUse: [
							{
								matcher: "Write",
								hooks: [{ type: "command", command: "printf z >> racy.txt" }],
							},
						],
					},
				}),
			},
			stub: {
				seq: [
					READ,
					{
						name: "Write",
						input: { file_path: "{PROJ}/racy.txt", content: "replacement" },
					},
				],
			},
		},
		/tool_result|verification|does not hold|modified/u,
	),
	fullDisk,
];
