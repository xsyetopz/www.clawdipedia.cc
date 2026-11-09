// Argument shape for `facts` and `compare`: `compare <from> <to>` is shorthand for `--from/--to`; any other
// positional is an error (so `compare 2.1.305` or `compare 2.1.305 ../x` cannot run against the wrong version).
const VER = /^\d+\.\d+\.\d+$/u;
const VALUE_FLAGS = new Set(["--from", "--to", "--only"]);

export const normaliseArgs = (
	name: string | undefined,
	raw: string[],
): { args: string[]; error?: string } => {
	let args = raw;
	if (name === "compare" && VER.test(raw[0] ?? "") && VER.test(raw[1] ?? "")) {
		args = ["--from", raw[0] ?? "", "--to", raw[1] ?? "", ...raw.slice(2)];
	}
	if (name !== "compare" && name !== "facts") {
		return { args };
	}
	for (let i = 0; i < args.length; i++) {
		const a = args[i] ?? "";
		if (a.startsWith("--")) {
			if (VALUE_FLAGS.has(a)) {
				i++;
			}
			continue;
		}
		return {
			args,
			error: `release:${name}: unexpected argument "${a}"${name === "compare" ? " (usage: compare <from> <to> [--samples], both x.y.z)" : ""}`,
		};
	}
	return { args };
};
