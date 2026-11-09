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
