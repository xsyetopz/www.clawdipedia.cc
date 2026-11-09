import type { Data } from "../../../lib/results.ts";
import { type Case, dispose, runCase } from "../run.ts";
import {
	type Baseline,
	baselineA,
	baselineB,
	diffSample,
	diffSig,
	type Sig,
	sig,
} from "../sig.ts";

const WORKERS = 8;
const SAMPLE_CAP = 150;
const KINDS = ["A", "B"] as const;
type Kind = (typeof KINDS)[number];
const MAKE: Record<Kind, () => Case> = { A: baselineA, B: baselineB };

type Out =
	| {
			diff: string[];
			code: number | null;
			vals: Record<string, [string, string]>;
	  }
	| { err: string };

export type Bases = Record<Kind, Baseline>;
type Results = Map<string, Record<string, Out>>;

const message = (e: unknown): string =>
	e instanceof Error ? e.message : String(e);

export const errorText = message;

const dropOwn = (s: Sig, v: string): void => {
	for (const x of Object.keys(s)) {
		if (x.startsWith("henv.")) {
			s[x] = (s[x] ?? "")
				.split(",")
				.filter((n) => n !== v)
				.join(",");
		}
	}
};

const runJob = async (
	bin: string,
	bases: Bases,
	v: string,
	k: Kind,
): Promise<Out> => {
	try {
		const c = MAKE[k]();
		c.env = { [v]: "1" };
		c.timeoutMs = 40_000;
		const r = await runCase(bin, c);
		const s = await sig(r);
		await dispose(r);
		dropOwn(s, v);
		const b = bases[k];
		const diff = diffSig(b.sig, s).filter((x) => !b.noise.includes(x));
		return {
			diff,
			code: r.code,
			vals: Object.fromEntries(
				diff.map((x) => [x, diffSample(b.sig[x] ?? "", s[x] ?? "")]),
			),
		};
	} catch (error) {
		return { err: message(error).slice(0, 200) };
	}
};

/** Every name under both baselines, on a pool of workers that take the next job when one ends. */
export const runJobs = async (
	bin: string,
	bases: Bases,
	todo: string[],
): Promise<Results> => {
	const jobs = todo.flatMap((v) => KINDS.map((k) => [v, k] as const));
	const res: Results = new Map();
	let idx = 0;
	let done = 0;
	const worker = async (): Promise<void> => {
		const j = jobs[idx++];
		if (j === undefined) {
			return;
		}
		const [v, k] = j;
		const out = await runJob(bin, bases, v, k);
		const rec = res.get(v) ?? {};
		rec[k] = out;
		res.set(v, rec);
		if (++done % 200 === 0) {
			console.info(`  sweep: ${done}/${jobs.length}`);
		}
		await worker();
	};
	await Promise.all(Array.from({ length: WORKERS }, () => worker()));
	return res;
};

const addSamples = (
	samples: Record<string, string>,
	prefix: string,
	vals: Record<string, [string, string]>,
): void => {
	for (const [key, [a, b]] of Object.entries(vals)) {
		if (Object.keys(samples).length < SAMPLE_CAP) {
			samples[`${prefix}.${key}`] = `${a} => ${b}`;
		}
	}
};

export const tally = (todo: string[], res: Results) => {
	const data: Record<string, Data> = {};
	const samples: Record<string, string> = {};
	const changed: string[] = [];
	const errored: string[] = [];
	for (const v of todo) {
		for (const k of KINDS) {
			const o = res.get(v)?.[k];
			if (o === undefined) {
				continue;
			}
			if ("err" in o) {
				data[`${v}.${k}`] = [`error: ${o.err}`];
				errored.push(`${v}.${k}`);
				continue;
			}
			data[`${v}.${k}`] = o.diff;
			if (o.diff.length > 0) {
				changed.push(v);
				addSamples(samples, `${v}.${k}`, o.vals);
			}
		}
	}
	return { data, samples, changed, errored };
};
