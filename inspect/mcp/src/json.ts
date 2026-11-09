// Type guards for values read from JSON, so callers narrow them without type assertions.

/** Whether `v` is a non-null object, an array included, read by string key. */
export const isRecord = (v: unknown): v is Record<string, unknown> =>
	typeof v === "object" && v !== null;

/** The items of `v` that are records, or an empty list when `v` is not an array. */
export const recordsOf = (v: unknown): Record<string, unknown>[] =>
	Array.isArray(v) ? v.filter((x: unknown) => isRecord(x)) : [];
