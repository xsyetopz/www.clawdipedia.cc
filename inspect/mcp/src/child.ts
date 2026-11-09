// Starts the program for run.ts and reads what it wrote.
import { isRecord } from "./json.ts";

const quiet = async (): Promise<string> => {
	await Bun.sleep(1000);
	return "";
};

export interface Finished {
	exit: number;
	out: string;
	stderr: string;
	timedOut: boolean;
}

export const spawnProgram = async (
	argv: string[],
	cwd: string,
	env: Record<string, string>,
	input: string | undefined,
	timeoutMs: number,
): Promise<Finished> => {
	const p = Bun.spawn(argv, {
		cwd,
		stdin: input === undefined ? "ignore" : Buffer.from(input),
		stdout: "pipe",
		stderr: "pipe",
		env,
	});
	const err = new Response(p.stderr).text();
	// Read stdout as it comes, so a killed run still shows the events before the hang.
	const seen = { out: "" };
	const dec = new TextDecoder();
	const read = (async () => {
		try {
			for await (const c of p.stdout) {
				seen.out += dec.decode(c, { stream: true });
			}
		} catch {
			// A killed child can end the stream with an error; the text read so far stays.
		}
	})();
	let timedOut = false;
	const t = setTimeout(() => {
		timedOut = true;
		p.kill("SIGKILL");
	}, timeoutMs);
	let exit: number;
	try {
		exit = await p.exited;
	} finally {
		clearTimeout(t);
	}
	// A child the program left running can hold stderr open.
	const [stderr] = await Promise.all([
		Promise.race([err, quiet()]),
		Promise.race([read, Bun.sleep(1000)]),
	]);
	return { exit, out: seen.out, stderr, timedOut };
};

export const eventsOf = (out: string): Record<string, unknown>[] =>
	out.split("\n").flatMap((l) => {
		try {
			const e: unknown = JSON.parse(l);
			return isRecord(e) ? [e] : [];
		} catch {
			return [];
		}
	});

const label = (v: unknown): string =>
	typeof v === "string" ? v : (JSON.stringify(v) ?? "undefined");

export const timeoutMessage = (
	timeoutMs: number,
	events: Record<string, unknown>[],
	stderr: string,
): string => {
	const seen = events
		.map((e) => `${label(e["type"])}/${label(e["subtype"] ?? "")}`)
		.join(" ");
	return `the program did not end in ${timeoutMs} ms; events: ${seen === "" ? "none" : seen}; stderr: ${stderr.slice(-2000)}`;
};
