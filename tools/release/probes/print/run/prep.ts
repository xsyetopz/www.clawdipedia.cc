import { join } from "node:path";

import { type Sandbox, subst } from "../../../lib/sandbox.ts";
import type { StubCase } from "../../../lib/stub.ts";
import { eachInOrder } from "./seq.ts";
import { type Case, isSeq, obj, type Seq } from "./types.ts";

/** Every prompt the argument list or stdin would send: `-p`/`--print` values and stream-json user lines. */
export const promptsOf = (
	argv: string[],
	stdin: string | undefined,
): string[] => {
	const out: string[] = [];
	for (const [i, a] of argv.entries()) {
		const next = argv[i + 1];
		if (
			(a === "-p" || a === "--print") &&
			next !== undefined &&
			next !== "" &&
			!next.startsWith("-")
		) {
			out.push(next);
		}
	}
	for (const l of (stdin ?? "").split("\n")) {
		try {
			const j = obj(JSON.parse(l));
			const c = obj(j["message"])["content"];
			if (j["type"] === "user" && typeof c === "string") {
				out.push(c);
			}
		} catch {
			// not JSON
		}
	}
	return out;
};

export const commitFixture = async (sb: Sandbox): Promise<void> => {
	const env = {
		PATH: "/usr/bin:/bin",
		HOME: sb.home,
		GIT_CONFIG_GLOBAL: join(sb.home, ".gitconfig"),
		GIT_AUTHOR_NAME: "t",
		GIT_AUTHOR_EMAIL: "t@example.com",
		GIT_COMMITTER_NAME: "t",
		GIT_COMMITTER_EMAIL: "t@example.com",
	};
	await eachInOrder(
		[
			["add", "-A"],
			["commit", "-q", "-m", "init"],
		],
		async (c) => {
			const g = Bun.spawn(["/usr/bin/git", ...c], {
				cwd: sb.proj,
				env,
				stdout: "ignore",
				stderr: "ignore",
			});
			if ((await g.exited) !== 0) {
				throw new Error(`git ${c[0]} failed in sandbox`);
			}
		},
	);
};

const nonZero = (n: number | undefined): n is number =>
	n !== undefined && n !== 0;

const substituted = (x: unknown, sb: Sandbox): unknown =>
	x === undefined ? x : JSON.parse(subst(JSON.stringify(x), sb));

const substitutedSeq = (seq: Seq, sb: Sandbox): Seq => {
	const s = substituted(seq, sb);
	if (!isSeq(s)) {
		throw new Error("fixture sequence lost its shape");
	}
	return s;
};

export const stubCaseOf = (c: Case, sb: Sandbox, log: string): StubCase => ({
	log,
	...(c.text === undefined ? {} : { text: c.text }),
	...(c.tool === undefined ? {} : { tool: c.tool }),
	...(c.toolInput === undefined
		? {}
		: { toolInput: substituted(c.toolInput, sb) }),
	...(c.seq === undefined ? {} : { seq: substitutedSeq(c.seq, sb) }),
	...(c.respHeaders === undefined ? {} : { respHeaders: c.respHeaders }),
	...(c.safeguard === undefined ? {} : { safeguard: c.safeguard }),
	...(c.refuseServerCheck === true ? { refuseServerCheck: true } : {}),
	...(c.orchestrator === undefined ? {} : { orchestrator: c.orchestrator }),
	...(nonZero(c.tooLongOn) ? { tooLongOn: c.tooLongOn } : {}),
	...(nonZero(c.gapMs) ? { gapMs: c.gapMs } : {}),
	...(nonZero(c.deltas) ? { deltas: c.deltas } : {}),
});
