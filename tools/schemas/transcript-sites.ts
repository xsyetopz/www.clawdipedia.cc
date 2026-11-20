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
	before = ""
): boolean => {
	const ok = keys.includes("uuid") || keys.includes("toolUseID");
	const stream = keys.some((k) => k.includes("_") && streamKeys.has(k));
	const payload = before.endsWith("payload:");
	return (
		ok && !stream && !payload && (type !== "system" || keys.includes("subtype"))
	);
};

/**
 * Attachment kinds that only the display builds. The transcript view merges a run of rows into one display row:
 * Od() builds teammate_shutdown_batch and Dd() builds async_hook_response_batch (chunk-a2xjwn0h.js:97221 and
 * chunk-a2xjwn0h.js:99380 at 2.1.327). Their one caller is the render chain `Ujs(Ld(Dd(Od(...))))`
 * (chunk-a2xjwn0h.js:168458), whose result becomes the displayed rows, so no writer receives them.
 */
const DISPLAY_ONLY = new Set([
	"async_hook_response_batch",
	"teammate_shutdown_batch"
]);

const attachmentKind = (entries: readonly Entry[]): string | undefined => {
	const a = entries.find((e) => "key" in e && e.key === "attachment");
	if (a === undefined || !("val" in a) || a.val.k !== "obj") {
		return undefined;
	}
	const t = a.val.e.find((e) => "key" in e && e.key === "type");
	return t !== undefined && "val" in t && t.val.k === "str"
		? t.val.v
		: undefined;
};

/**
 * Whether a `{type:"<t>",...}` literal writes no line. The transcript writer keeps only the rows its filter passes
 * (chunk-m14bt1pz.js:696693 at 2.1.327; every insertMessageChain path goes through it). That filter drops each
 * `progress` row and each row with `"persist" in row && row.persist === false`. Examples: the tool progress rows,
 * and the `placed` system rows of plugins. A display-only attachment row (DISPLAY_ONLY) writes no line either.
 */
export const isUnpersisted = (
	type: string,
	entries: readonly Entry[]
): boolean =>
	type === "progress" ||
	(type === "attachment" && DISPLAY_ONLY.has(attachmentKind(entries) ?? "")) ||
	entries.some(
		(e) =>
			"key" in e &&
			e.key === "persist" &&
			!e.opt &&
			e.val.k === "bool" &&
			!e.val.v
	);
