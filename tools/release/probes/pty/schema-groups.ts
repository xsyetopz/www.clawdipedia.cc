// The PTY groups that sample schema field types: each case keeps the value-free types it saw as `<case>.fields.json`.
import type { PtyGroup } from "./harness.ts";
import { otelGroup } from "./otel.ts";
import { transcriptGroup } from "./transcript.ts";

/** The groups that sample transcript and OpenTelemetry field types. */
export const SCHEMA_GROUPS: PtyGroup[] = [transcriptGroup, otelGroup];
