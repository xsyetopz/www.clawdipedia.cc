import type { Entry } from "../../inspect/mcp/src/resolve.ts";

/**
 * Whether an object literal `{type:"<t>",...}` with these top-level keys writes a transcript line.
 * Message constructors carry uuid. The stream-json output emit sites also carry uuid, so a site is dropped when
 * one of its snake_case keys is a stream-json key (session_id, compact_metadata, ...), or when it is the
 * `payload:` of a client event. A transcript line can still have a snake_case key, such as `source_uuid`.
 * `before` is the source text just before the literal.
 */
export const isTranscriptSite = (
	type: string,
	keys: string[],
	streamKeys: ReadonlySet<string>,
	before = "",
): boolean => {
	const ok = keys.includes("uuid") || keys.includes("toolUseID");
	const stream = keys.some((k) => k.includes("_") && streamKeys.has(k));
	const payload = before.endsWith("payload:");
	return (
		ok && !stream && !payload && (type !== "system" || keys.includes("subtype"))
	);
};

/**
 * Whether an object literal sets `persist: false`. The transcript writer keeps only the rows its filter passes,
 * and that filter drops each row with `"persist" in row && row.persist === false` (chunk-m14bt1pz.js:696693 at
 * 2.1.327), so such a literal is display-only and writes no line. Example: the `placed` system rows of plugins.
 */
export const isUnpersisted = (entries: readonly Entry[]): boolean =>
	entries.some(
		(e) =>
			"key" in e &&
			e.key === "persist" &&
			!e.opt &&
			e.val.k === "bool" &&
			!e.val.v,
	);
