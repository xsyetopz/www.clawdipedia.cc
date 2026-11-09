// Readers of a pty run: request and system text, screen at a step, first-seen time, small numeric helpers.
import { renderRaw } from "../../../lib/pty/render.ts";
import type { Data } from "../../../lib/results.ts";
import type { LoggedRequest } from "../../../lib/stub.ts";
import { tolerant } from "./steps.ts";
import { arr, type Obj, obj, type PtyRun } from "./types.ts";

/** Does the --only list select this id (`pty.` prefix optional, prefix match on dotted segments both ways, or the bare case name)? */
export const selected = (only: string[] | null, id: string): boolean => {
	if (only === null) {
		return true;
	}
	return only.some((raw) => {
		const o = raw.startsWith("pty.") ? raw : `pty.${raw}`;
		// a bare case name (last dotted segment) also matches, like probe:managed
		return (
			o === id ||
			id.startsWith(`${o}.`) ||
			o.startsWith(`${id}.`) ||
			id.split(".").pop() === raw
		);
	});
};

export const isSystemMsg = (x: LoggedRequest): boolean =>
	x.path.startsWith("/v1/messages") && Boolean(obj(x.body)["messages"]);
/** The system prompt of a request as one string. */
export const sysText = (x: LoggedRequest): string =>
	JSON.stringify(obj(x.body)["system"] ?? "");
export const toolNames = (x: LoggedRequest): string[] =>
	arr(obj(x.body)["tools"]).map((t) => String(obj(t)["name"]));

const stripAnsiCount = (s: string, re: RegExp): number =>
	(s.match(re) ?? []).length;
export const count = stripAnsiCount;

export const sha8 = (s: string): string =>
	new Bun.CryptoHasher("sha1").update(s).digest("hex").slice(0, 8);

export const sentAt = (x: PtyRun, label: string): number | null =>
	x.pty.sent.find((s) => s.label === label)?.t ?? null;
/** RAW byte offset after the last read at or before the time a label was sent (null when the label was never sent). */
const offsetAt = (x: PtyRun, label: string): number | null => {
	const t = sentAt(x, label);
	if (t === null) {
		return null;
	}
	let off = 0;
	for (const i of x.pty.idx) {
		if (i.t > t) {
			break;
		}
		off = i.off;
	}
	return off;
};
/** The screen text as it was when `label` was sent (RAW up to the last read at or before that time). The whole screen when the label never fired. */
export const screenBefore = (x: PtyRun, label: string): string => {
	const off = offsetAt(x, label);
	return off === null ? x.screen : renderRaw(x.raw.subarray(0, off));
};
/** The screen text of what was drawn after `label` was sent (RAW from that offset on). Empty when the label never fired. */
export const screenAfter = (x: PtyRun, label: string): string => {
	const off = offsetAt(x, label);
	return off === null ? "" : renderRaw(x.raw.subarray(off));
};
/** Was a permission dialog still open when `label` was sent? True when its last marker ("proceed?", "Esc to cancel") on the screen before that moment has no outcome line (Allowed by, Denied by, Interrupted) after it. */
export const dialogOpenAt = (x: PtyRun, label: string): boolean => {
	const t = screenBefore(x, label);
	const last = (phrases: string[]): number =>
		Math.max(
			-1,
			...phrases.map((p) => {
				const m = [...t.matchAll(tolerant(p, "gi"))].pop();
				return m ? m.index : -1;
			}),
		);
	const d = last(["proceed?", "Esc to cancel"]);
	return d >= 0 && d > last(["Allowed by", "Denied by", "Interrupted"]);
};
/** Epoch seconds of the first read after which the rendered RAW (up to the `before` label when given) matches `re` (binary search over RAW.idx), or null. */
export const firstSeenT = (
	x: PtyRun,
	re: RegExp,
	before?: string,
): number | null => {
	const cut = before === undefined ? null : offsetAt(x, before);
	const all = x.raw;
	const raw = cut === null ? all : all.subarray(0, cut);
	const idx = cut === null ? x.pty.idx : x.pty.idx.filter((i) => i.off <= cut);
	if (idx.length === 0 || !re.test(renderRaw(raw))) {
		return null;
	}
	let lo = 0;
	let hi = idx.length - 1;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (re.test(renderRaw(raw.subarray(0, idx[mid]?.off ?? 0)))) {
			hi = mid;
		} else {
			lo = mid + 1;
		}
	}
	return idx[lo]?.t ?? null;
};
export const keysOf = (o: Obj): string[] => Object.keys(o).toSorted();
export const median = (v: number[]): number | null => {
	if (v.length === 0) {
		return null;
	}
	const a = [...v].toSorted((p, q) => p - q);
	const m = a.length >> 1;
	return a.length % 2 ? (a[m] ?? null) : ((a[m - 1] ?? 0) + (a[m] ?? 0)) / 2;
};
export const round = (n: number | null, d = 1): number | null =>
	n === null ? null : Math.round(n * 10 ** d) / 10 ** d;
export const gaps = (t: number[]): number[] =>
	t.slice(1).map((v, i) => v - (t[i] ?? 0));
/** All text of tool_result blocks in every request (what the model was told). */
export const toolResultText = (x: PtyRun): string =>
	x.messages
		.map((q) =>
			arr(obj(q.body)["messages"])
				.flatMap((m) => arr(obj(m)["content"]))
				.filter((b) => obj(b)["type"] === "tool_result")
				.map((b) => JSON.stringify(obj(b)["content"]))
				.join("\n"),
		)
		.join("\n");
export const ranFile = (x: PtyRun, name: string): boolean => name in x.files;

/** `precondition` data: true when the feature under test showed up, so a miss reads as "probe invalid". */
export const pre = (ok: boolean, detail: string): Record<string, Data> => ({
	precondition: ok,
	...(ok ? {} : { "precondition.detail": detail }),
});
