import type { LoggedRequest } from "../../../lib/stub.ts";
import { arr, type Obj, obj, type Run } from "./types.ts";

/** JSON lines of stdout (stream-json events). */
export const events = (r: Run): Obj[] =>
	r.stdout
		.split("\n")
		.filter((l) => l !== "")
		.map((l) => {
			try {
				return obj(JSON.parse(l));
			} catch {
				return { _raw: l };
			}
		});

/** Requests that carry a messages array (the model calls). */
export const msgs = (r: Run): LoggedRequest[] =>
	r.reqs.filter(
		(x) =>
			x.path.startsWith("/v1/messages") && Boolean(obj(x.body)["messages"]),
	);

/** Most tool_result blocks seen in any one request: the tool results the program sent back to the model. */
export const toolResults = (r: Run): number =>
	Math.max(
		0,
		...msgs(r).map((q) =>
			arr(obj(q.body)["messages"]).reduce<number>(
				(n, m) =>
					n +
					arr(obj(m)["content"]).filter((b) => obj(b)["type"] === "tool_result")
						.length,
				0,
			),
		),
	);
