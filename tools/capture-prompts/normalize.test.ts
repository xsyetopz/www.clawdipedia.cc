import { expect, test } from "bun:test";

import { numberUuids } from "./normalize.ts";

const page = (a: string, b: string) =>
	`{"session_id":"${a}","transcript_path":"<config-dir>/${a}.jsonl","prompt_id":"${b}"}`;

test("random ids get the same numbered placeholders in every capture", () => {
	const one = numberUuids()(
		page(
			"4ebbc133-9946-4e3f-8a6b-63a01640e962",
			"26608b04-e572-4dca-850b-07e9887bd2dc",
		),
	);
	const two = numberUuids()(
		page(
			"541dde55-ba90-49f6-812c-86e3a6a77f96",
			"52b1ff68-839a-4c34-b82a-75dd1b023629",
		),
	);
	expect(one).toBe(two);
	expect(one).toBe(page("<uuid-1>", "<uuid-2>"));
});
