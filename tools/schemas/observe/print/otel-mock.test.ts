import { afterEach, expect, test } from "bun:test";

import { type OtelMock, otelPaths, startOtelMock } from "./otel-mock.ts";

let mock: OtelMock | undefined;
afterEach(async () => {
	await mock?.stop();
	mock = undefined;
});

const logBody = (name: string): object => ({
	resourceLogs: [
		{
			scopeLogs: [
				{
					logRecords: [
						{
							attributes: [
								{ key: "event.name", value: { stringValue: name } },
								{ key: "action", value: { stringValue: "logout" } },
								{ key: "success", value: { boolValue: true } }
							]
						}
					]
				}
			]
		}
	]
});

test("the mock points the program at its collector, which tallies a posted event", async () => {
	// Arrange
	mock = await startOtelMock();
	const env = mock.env();
	const base = env["OTEL_EXPORTER_OTLP_ENDPOINT"] ?? "";

	// Act
	await fetch(`${base}/v1/logs`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(logBody("mock_probe_event"))
	});

	// Assert
	expect(
		await Bun.file(env["CLAUDE_SESSION_INGRESS_TOKEN_FILE"] ?? "").exists()
	).toBe(true);
	expect(otelPaths(["event:mock_probe_event"])).toEqual({
		"event:mock_probe_event": { object: 1 },
		"event:mock_probe_event.action": { string: 1 },
		"event:mock_probe_event.event.name": { string: 1 },
		"event:mock_probe_event.success": { boolean: 1 }
	});
});

test("otelPaths keeps only the given roots and their children", () => {
	// Arrange: nothing posts an event with this prefix-sharing name.

	// Act
	const paths = otelPaths(["event:mock_probe"]);

	// Assert
	expect(
		Object.keys(paths).filter((k) => k.startsWith("event:mock_probe_"))
	).toEqual([]);
});
