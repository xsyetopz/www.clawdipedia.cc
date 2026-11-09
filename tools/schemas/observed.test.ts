import { describe, expect, test } from "bun:test";

import { applyObserved } from "./observed.ts";

describe("applyObserved", () => {
	test("marks only the observed field when fields share one node", async () => {
		const unk = { "x-unverified": true };
		const schema = {
			$defs: {
				a: { properties: { id: unk } },
				b: { properties: { id: unk } },
			},
		};
		const fx = { $comment: "", version: "", fields: { "a.id": { string: 3 } } };
		const out = await applyObserved("x.json", schema, fx);
		expect(out.n).toBe(1);
		expect(out.schema).toEqual({
			$defs: {
				a: {
					properties: {
						id: { "x-unverified": true, "x-observed-type": ["string"] },
					},
				},
				b: { properties: { id: { "x-unverified": true } } },
			},
		});
	});
});
