import type { Data } from "../../../lib/results.ts";
import { obj } from "../run.ts";
import { json, show } from "../run/helpers.ts";

const keys = (x: unknown): string[] => Object.keys(obj(x));

const entryData = (p: string, j: Record<string, unknown>) => {
	const resp = j["tool_response"];
	const ro = obj(resp);
	const data: Record<string, Data> = {
		[`${p}.hook_keys`]: Object.keys(j),
		[`${p}.input_keys`]: keys(j["tool_input"]),
		[`${p}.response`]:
			typeof resp === "object" && resp !== null
				? Object.keys(ro)
				: json(resp).slice(0, 100),
	};
	if (typeof ro["file"] === "object" && ro["file"] !== null) {
		data[`${p}.file_keys`] = keys(ro["file"]);
	}
	if (ro["type"] !== undefined) {
		data[`${p}.type`] = show(ro["type"]);
	}
	if (ro["status"] !== undefined) {
		data[`${p}.status`] = show(ro["status"]);
	}
	if (ro["structuredPatch"] !== undefined) {
		data[`${p}.patch`] = json(ro["structuredPatch"]).slice(0, 60);
	}
	if ("originalFile" in ro) {
		data[`${p}.original_file_null`] = ro["originalFile"] === null;
	}
	return data;
};

/** Key sets of each logged PostToolUse stdin; a repeated tool name gets a `#N` suffix. */
export const hookData = (lines: string[]): Record<string, Data> => {
	const seen = new Map<string, number>();
	const data: Record<string, Data> = {};
	for (const l of lines) {
		const j = obj(JSON.parse(l));
		const tn = show(j["tool_name"]);
		const n = (seen.get(tn) ?? 0) + 1;
		seen.set(tn, n);
		Object.assign(data, entryData(n > 1 ? `${tn}#${n}` : tn, j));
	}
	return data;
};

/** Whether the PostToolUseFailure hook fired, and the shape of its first log entry. */
export const failureData = (fail: string): Record<string, Data> => {
	const data: Record<string, Data> = { "failure_hook.fired": fail !== "" };
	if (fail !== "") {
		const j = obj(JSON.parse(fail.split("\n").find((l) => l !== "") ?? "{}"));
		data["failure_hook.keys"] = Object.keys(j);
		data["failure_hook.error"] = show(j["error"] ?? "").slice(0, 120);
	}
	return data;
};
