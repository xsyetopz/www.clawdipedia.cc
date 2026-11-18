// The print-mode collector as a mock for a PTY case: some telemetry comes only from the interactive session.
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { allocPort } from "../../../release/lib/ports.ts";
import { startCollector } from "./collector.ts";
import { otel } from "./ingest.ts";
import { fakeSessionToken, otelEnv } from "./setup.ts";

/** A running collector and the env that points the program at it. */
export interface OtelMock {
	env: () => Record<string, string>;
	stop: () => Promise<void>;
}

/** Starts the collector on a free port. Its records go into the shared `otel` tally that {@link otelPaths} reads. */
export const startOtelMock = async (): Promise<OtelMock> => {
	const port = await allocPort();
	const server = startCollector(port);
	const dir = await mkdtemp(join(tmpdir(), "otel-mock-"));
	const tokenFile = join(dir, "session-ingress-token");
	await Bun.write(tokenFile, fakeSessionToken());
	return {
		env: () => ({
			...otelEnv(port),
			CLAUDE_SESSION_INGRESS_TOKEN_FILE: tokenFile,
		}),
		stop: async () => {
			await server.stop(true);
			await rm(dir, { recursive: true, force: true });
		},
	};
};

/** The tallied key paths and their JSON types under the given roots, such as `event:auth`, in the audit's raw format. */
export const otelPaths = (
	roots: string[],
): Record<string, Record<string, number>> =>
	Object.fromEntries(
		Object.entries(otel.toJSON())
			.filter(([k]) => roots.some((r) => k === r || k.startsWith(`${r}.`)))
			.map(([k, s]) => [k, s.types]),
	);
