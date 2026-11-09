// Small text checks shared by the source files.

/** True for a string with at least one character. Narrows away undefined and null. */
export const present = (s: string | undefined | null): s is string =>
	s !== undefined && s !== null && s !== "";

/** True for a plain object (not null, not an array). */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null && !Array.isArray(v);
