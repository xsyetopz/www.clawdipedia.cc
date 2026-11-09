// Reads the module table of a Bun single-file executable (read only) and returns each embedded module.
// Layout (Bun StandaloneModuleGraph), found by inspecting Claude Code 2.1.306:
//   [data ...][module table][...]  [Offsets: 32 bytes]  "\n---- Bun! ----\n"
//   Offsets = byte_count u64, modules {offset u32, length u32}, entry_point_id u32, argv {offset u32, length u32}, flags u32
//   Pointers are relative to base = (start of Offsets) - byte_count.
//   Each module entry is 52 bytes: name, contents, sourcemap, bytecode, module_info, bytecode_origin_path
//   (each {offset u32, length u32}) and 4 flag bytes.
/** `bytes` is the raw module (a view into the binary), for compressed assets such as `*.txt.zst`. */
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
const ENTRY_SIZE = 52;

export const extractModules = async (
	binaryPath: string,
): Promise<{
	modules: BunModule[];
	entry: string;
}> => {
	const buf = Buffer.from(await Bun.file(binaryPath).arrayBuffer());
	const trailerAt = buf.lastIndexOf(TRAILER);
	if (trailerAt === -1) {
		throw new Error(
			`${binaryPath} is not a Bun single-file executable (no trailer)`,
		);
	}
	const at = trailerAt - 32;
	const byteCount = Number(buf.readBigUInt64LE(at));
	const tableOffset = buf.readUInt32LE(at + 8);
	const tableLength = buf.readUInt32LE(at + 12);
	const entryId = buf.readUInt32LE(at + 16);
	const base = at - byteCount;
	if (base < 0 || tableLength % ENTRY_SIZE !== 0) {
		throw new Error("unexpected Bun module graph layout");
	}
	const text = (offset: number, length: number) =>
		buf.toString("utf8", base + offset, base + offset + length);
	const modules: BunModule[] = [];
	for (let i = 0; i < tableLength / ENTRY_SIZE; i++) {
		const e = base + tableOffset + i * ENTRY_SIZE;
		const name = text(buf.readUInt32LE(e), buf.readUInt32LE(e + 4));
		if (!name.startsWith("/$bunfs/")) {
			throw new Error(`bad module name at entry ${i}: ${JSON.stringify(name)}`);
		}
		const [off, len] = [buf.readUInt32LE(e + 8), buf.readUInt32LE(e + 12)];
		modules.push({
			name,
			source: text(off, len),
			bytes: buf.subarray(base + off, base + off + len),
		});
	}
	return { modules, entry: modules[entryId]?.name ?? "" };
};
