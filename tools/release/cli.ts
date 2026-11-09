// Usage: bun tools/release/cli.ts <command> [--from V] [--to V] [--only a,b] [--dry] [...]
// Runbook: tools/release/README.md. Design: openspec/changes/archive/2026-10-21-release-toolkit/design.md. `all` runs the automatic steps in order.
import { COMMANDS } from "./commands.ts";
import { normaliseArgs } from "./facts/args.ts";
import { parseCtx, recordCommand } from "./util.ts";

const usage = (name: string | undefined): number => {
	if (name !== undefined && name !== "") {
		console.error(`unknown command: ${name}`);
	}
	console.error(
		"usage: bun tools/release/cli.ts <command> [--from V] [--to V] [--only a,b] [--dry]",
	);
	for (const [n, c] of Object.entries(COMMANDS)) {
		console.error(`  ${n.padEnd(10)} ${c.summary}`);
	}
	return name === undefined || name === "" ? 0 : 2;
};

const main = async (): Promise<number> => {
	const [name, ...rawArgs] = process.argv.slice(2);
	const { args, error: argError } = normaliseArgs(name, rawArgs);
	if (argError !== undefined && argError !== "") {
		console.error(argError);
		return 2;
	}
	const cmd = name === undefined ? undefined : COMMANDS[name];
	if (name === undefined || name === "" || cmd === undefined) {
		return usage(name);
	}
	const ctx = await parseCtx(args);
	const startedAt = new Date().toISOString();
	let exit = 1;
	try {
		exit = await cmd.run(ctx);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(`release:${name}: ${message}`);
	}
	if (!ctx.dry && ctx.to !== "") {
		await recordCommand(ctx.to, {
			name,
			args,
			startedAt,
			endedAt: new Date().toISOString(),
			exit,
		});
	}
	return exit;
};

process.exitCode = await main();
