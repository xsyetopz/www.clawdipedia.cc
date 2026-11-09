import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

/** The text as `bun fmt` leaves it (the [fmt] style of bunfig.toml), for the file at `path`. Throws when `bun fmt` fails. */
export const formatText = async (
	text: string,
	path: string,
): Promise<string> => {
	const p = Bun.spawn([process.execPath, "fmt", `--stdin-filepath=${path}`], {
		cwd: ROOT,
		stdin: new Blob([text]),
		stdout: "pipe",
		stderr: "pipe",
	});
	const [out, err, code] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	if (code !== 0) {
		throw new Error(`bun fmt failed:\n${err}`);
	}
	return out;
};

/** The JSON of `value`, two-space indented, as `bun fmt` leaves it for the file at `path`. */
export const formatJson = (value: unknown, path: string): Promise<string> =>
	formatText(JSON.stringify(value, null, 2), path);
