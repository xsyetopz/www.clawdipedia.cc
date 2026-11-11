// Reads the module table of a Bun single-file executable (read only) and returns each embedded module.
// Layout (Bun StandaloneModuleGraph), found by inspecting Claude Code 2.1.306:
//   [data ...][module table][...]  [Offsets: 32 bytes]  "\n---- Bun! ----\n"
//   Offsets = byte_count u64, modules {offset u32, length u32}, entry_point_id u32, argv {offset u32, length u32}, flags u32
//   Pointers are relative to base = (start of Offsets) - byte_count.
//   Each module entry is 52 bytes: name, contents, sourcemap, bytecode, module_info, bytecode_origin_path
//   (each {offset u32, length u32}) and 4 flag bytes.
/**
 * `bytes` is the raw module (a view into the part of the binary that holds the modules), for compressed
 * assets such as `*.txt.zst`. `source` is `bytes` as text, decoded on the first read.
 */
export interface BunModule {
	name: string;
	source: string;
	bytes: Buffer;
}

/** The Mod API type file the program embeds (`claude-code.d.ts-<hash>.zst`), as text. */
export const typeFile = async (
	modules: Pick<BunModule, "name" | "bytes">[],
): Promise<{ name: string; text: string }> => {
	const [found, ...more] = modules.filter((m) =>
		/\/claude-code\.d\.ts-[^/]*\.zst$/u.test(m.name),
	);
	if (!found || more.length > 0) {
		throw new Error(
			`expected one embedded type file, found ${more.length + (found ? 1 : 0)}`,
		);
	}
	return {
		name: found.name.split("/").pop() ?? found.name,
		text: new TextDecoder("utf-8", { ignoreBOM: true }).decode(
			await Bun.zstdDecompress(found.bytes),
		),
	};
};

const TRAILER = "\n---- Bun! ----\n";
const OFFSETS_SIZE = 32;
const ENTRY_SIZE = 52;
const WINDOW = 4 * 1024 * 1024;
const LAYOUT = "unexpected Bun module graph layout";

type File = ReturnType<typeof Bun.file>;
/** An `{offset, length}` pointer of the module graph. */
type Part = [offset: number, length: number];

const read = async (file: File, start: number, end: number): Promise<Buffer> =>
	Buffer.from(await file.slice(start, end).arrayBuffer());

/**
 * Where the last trailer starts, or -1. The program's data holds the trailer text too, and the real one
 * stands near the end, so the search goes backward. Each part starts inside the one before it, for a
 * trailer that lies across the two.
 */
const lastTrailer = async (file: File, end = file.size): Promise<number> => {
	const start = Math.max(0, end - WINDOW);
	const part = await read(file, start, end);
	const at = part.lastIndexOf(TRAILER);
	if (at !== -1 || start === 0) {
		return at === -1 ? -1 : start + at;
	}
	return lastTrailer(file, start + TRAILER.length - 1);
};

/** The name and contents pointers of each module, from the Offsets that end at `trailerAt`. */
const tableOf = async (
	file: File,
	trailerAt: number,
): Promise<{
	base: number;
	entryId: number;
	entries: { name: Part; contents: Part }[];
}> => {
	const at = trailerAt - OFFSETS_SIZE;
	if (at < 0) {
		throw new Error(LAYOUT);
	}
	const offsets = await read(file, at, trailerAt);
	const base = at - Number(offsets.readBigUInt64LE(0));
	const tableOffset = base + offsets.readUInt32LE(8);
	const tableLength = offsets.readUInt32LE(12);
	if (base < 0 || tableLength % ENTRY_SIZE !== 0) {
		throw new Error(LAYOUT);
	}
	const table = await read(file, tableOffset, tableOffset + tableLength);
	const part = (i: number): Part => [
		table.readUInt32LE(i),
		table.readUInt32LE(i + 4),
	];
	return {
		base,
		entryId: offsets.readUInt32LE(16),
		entries: Array.from({ length: tableLength / ENTRY_SIZE }, (_, i) => ({
			name: part(i * ENTRY_SIZE),
			contents: part(i * ENTRY_SIZE + 8),
		})),
	};
};

const moduleOf = (name: string, bytes: Buffer): BunModule => {
	let source: string | undefined;
	return {
		name,
		bytes,
		get source() {
			source ??= bytes.toString("utf8");
			return source;
		},
	};
};

/** Reads the modules of a Bun single-file executable. It reads the names and the contents, not the whole file. */
export const extractModules = async (
	binaryPath: string,
): Promise<{
	modules: BunModule[];
	entry: string;
}> => {
	const file = Bun.file(binaryPath);
	const trailerAt = await lastTrailer(file);
	if (trailerAt === -1) {
		throw new Error(
			`${binaryPath} is not a Bun single-file executable (no trailer)`,
		);
	}
	const { base, entryId, entries } = await tableOf(file, trailerAt);
	// An empty part points at no data, so it does not widen what the reader takes.
	const used = entries
		.flatMap((e) => [e.name, e.contents])
		.filter(([, length]) => length > 0);
	const lo = Math.min(...used.map(([offset]) => offset));
	const hi = Math.max(...used.map(([offset, length]) => offset + length));
	const span = await read(file, base + lo, base + hi);
	const bytes = ([offset, length]: Part): Buffer =>
		length === 0
			? Buffer.alloc(0)
			: span.subarray(offset - lo, offset - lo + length);
	const modules = entries.map((e, i) => {
		const name = bytes(e.name).toString("utf8");
		if (!name.startsWith("/$bunfs/")) {
			throw new Error(`bad module name at entry ${i}: ${JSON.stringify(name)}`);
		}
		return moduleOf(name, bytes(e.contents));
	});
	return { modules, entry: modules[entryId]?.name ?? "" };
};
