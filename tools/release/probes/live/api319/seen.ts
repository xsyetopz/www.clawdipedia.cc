import { show } from "../../print/run/helpers.ts";
import { arr, obj } from "../harness.ts";

export interface Seen {
	betas: string[];
	bodyKeys: string[];
	owned: string[];
	mcp: string[];
}

const keyNames = (t: unknown): string =>
	Object.keys(obj(t)).toSorted().join("+");

/** Only beta names, body key names, tool names and the key names of ownership_metadata. */
export const seenOf = (body: unknown, betas: string): Seen => {
	const b = obj(body);
	const tools = arr(b["tools"]).map((t) => obj(t));
	return {
		betas: betas
			.split(",")
			.filter((s) => s !== "")
			.toSorted(),
		bodyKeys: Object.keys(b).toSorted(),
		mcp: tools
			.filter((t) => show(t["name"]).startsWith("mcp__"))
			.map((t) => `${show(t["name"])}:${keyNames(t)}`),
		owned: tools
			.filter((t) => "ownership_metadata" in t)
			.map((t) => `${show(t["name"])}:${keyNames(t["ownership_metadata"])}`),
	};
};
