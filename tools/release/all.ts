// `release:all`: the automatic steps of the runbook, in order, each as its own `cli.ts` child process so every
// step records itself in run.json. Never runs probe:managed or probe:live: those are printed as "needs you".
import { join } from "node:path";

import { type Ctx, exitCodeOf } from "./util.ts";

const CLI = join(import.meta.dir, "cli.ts");

// prompts gets --no-render: render.ts rewrites docs/prompts, and `all` must not edit docs pages on its own.
// `soft` steps do not stop the run: a flaky pty case must still yield a facts worklist. They fail the run at the end.
// `facts --check` writes nothing and fails only on unmapped facts; its print.sweep warnings keep exit 0.
interface Step {
	name: string;
	extra: string[];
	soft?: boolean;
}
interface Failure {
	step: Step;
	code: number;
}
const STEPS: Step[] = [
	{ name: "check", extra: [] },
	{ name: "schemas", extra: [] },
	{ name: "diff", extra: [] },
	{ name: "clean", extra: [] },
	{ name: "prompts", extra: ["--no-render"] },
	{ name: "probe:print", extra: [], soft: true },
	{ name: "probe:pty", extra: [], soft: true },
	{ name: "facts", extra: ["--check"], soft: true },
	{ name: "facts", extra: [] },
	{ name: "compare", extra: [] },
];
const ALLOWED = new Set(["--from", "--to", "--dry"]);

const label = (s: Step) => [s.name, ...s.extra].join(" ");

const hint = (s: Step, common: string[]) => {
	let extra = "";
	if (s.name === "prompts") {
		extra = " --no-render";
	} else if (s.extra.length > 0) {
		extra = ` ${s.extra.join(" ")}`;
	}
	return `  bun run release:${s.name} -- ${common.join(" ")}${extra}`;
};

/** Returns an exit code when the arguments or the versions rule the run out. */
const refuse = (ctx: Ctx): number | undefined => {
	// --from and --to take a value, so skip the token after each
	const bad = ctx.rest.filter(
		(a, i) =>
			!ALLOWED.has(a) &&
			!(i > 0 && (ctx.rest[i - 1] === "--from" || ctx.rest[i - 1] === "--to")),
	);
	if (bad.length > 0) {
		console.error(
			`release:all: unsupported argument(s): ${bad.join(" ")}. Only --from, --to and --dry are accepted.`,
		);
		return 2;
	}
	if (ctx.to === "") {
		console.error(
			"release:all: no --to version and no installed version found",
		);
		return 1;
	}
	// The last step compares the two. Stop now, before the probes, when the defaults collapsed to one.
	if (ctx.from === ctx.to) {
		console.error(
			`release:all: --from and --to are both ${ctx.to}. Give the release before it with --from.`,
		);
		return 1;
	}
	return undefined;
};

const spawnStep = async (step: Step, common: string[]): Promise<number> => {
	const p = Bun.spawn(
		[process.execPath, CLI, step.name, ...common, ...step.extra],
		{
			cwd: join(import.meta.dir, "..", ".."),
			stdout: "inherit",
			stderr: "inherit",
		},
	);
	await p.exited;
	return exitCodeOf(label(step), p);
};

/** Runs STEPS from `i` on, one after the other. Returns the exit code of the first hard failure. */
const runSteps = async (
	i: number,
	common: string[],
	failed: Failure[],
): Promise<number | undefined> => {
	const step = STEPS[i];
	if (step === undefined) {
		return undefined;
	}
	console.info(`\n== release:all ${i + 1}/${STEPS.length}: ${label(step)} ==`);
	const code = await spawnStep(step, common);
	if (code === 0) {
		return runSteps(i + 1, common, failed);
	}
	if (step.soft === true) {
		failed.push({ step, code });
		console.error(
			`\nrelease:all: ${label(step)} exited ${code}; going on so the worklist still gets built.`,
		);
		return runSteps(i + 1, common, failed);
	}
	console.error(`\nrelease:all stopped: ${label(step)} exited ${code}.`);
	console.error("Fix it, then run the remaining steps by hand:");
	for (const s of STEPS.slice(i)) {
		console.error(hint(s, common));
	}
	return code;
};

export const runAll = async (ctx: Ctx): Promise<number> => {
	const refused = refuse(ctx);
	if (refused !== undefined) {
		return refused;
	}
	const common = [
		"--from",
		ctx.from,
		"--to",
		ctx.to,
		...(ctx.dry ? ["--dry"] : []),
	];
	const failed: Failure[] = [];
	const stopped = await runSteps(0, common, failed);
	if (stopped !== undefined) {
		return stopped;
	}
	if (failed.length > 0) {
		console.error(
			`\nrelease:all: failed steps: ${failed.map((f) => `${label(f.step)} (exit ${f.code})`).join(", ")}.`,
		);
		console.error("Fix and re-run these by hand:");
		for (const f of failed) {
			console.error(hint(f.step, common));
		}
		return failed[0]?.code ?? 1;
	}
	console.info(
		"\nrelease:all: automatic steps done. Needs you (not run by `all`):",
	);
	console.info("  bun run release:probe:managed");
	console.info("  bun run release:probe:live");
	return 0;
};
