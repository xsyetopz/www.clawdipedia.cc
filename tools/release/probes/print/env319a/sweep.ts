import type { Data } from "../../../lib/results.ts";
import type { Run } from "../run.ts";
import {
	type CaseDef,
	msgs,
	readCfg,
	type Spec,
	withRun,
} from "../run/helpers.ts";

export const DBG = ["--debug-file", "{CFG}/d.log"];

const lines = (s: string, re: RegExp): string =>
	s
		.split("\n")
		.filter((l) => re.test(l))
		.slice(0, 6)
		.map((l) => l.replace(/^\S+\s/u, "").slice(0, 160))
		.join("\n");

/** One variable, one setup, a list of values (undefined = unset); `read` turns the run into data. */
export const sweep = (
	name: string,
	envName: string,
	values: (string | undefined)[],
	spec: Spec,
	read: (r: Run) => Promise<Record<string, Data>> | Record<string, Data>,
	dbg?: RegExp,
): CaseDef[] =>
	values.map((v) => ({
		name: `${name}.${v === undefined ? "unset" : `v${v}`}`,
		run: (ctx) =>
			withRun(
				ctx,
				{
					...spec,
					env: {
						...spec.env,
						...(v === undefined ? {} : { [envName]: v }),
					},
				},
				async (r) => ({
					from: r,
					data: {
						precondition: msgs(r).length > 0 || r.code !== null,
						...(await read(r)),
					},
					samples:
						dbg === undefined
							? {}
							: { debug: lines(await readCfg(r, "d.log"), dbg) },
				}),
			),
	}));

/** Stream-json input lines, one JSON value per line. */
export const jsonl = (xs: unknown[]): string =>
	`${xs.map((l) => JSON.stringify(l)).join("\n")}\n`;

export const STREAM_ARGV = [
	"-p",
	"--input-format",
	"stream-json",
	"--output-format",
	"stream-json",
	"--verbose",
];
