---
title: Telemetry
description: The $.telemetry noun, the telemetry.log and telemetry.mark events, and the record types.
sidebar_position: 15
---

`$.telemetry` logs analytics records.
Only a call from Claude Code or a built-in mod sends a record.
A mod you install can watch and rewrite records, but it must give its telemetry hook the filter `{ to: 'collector' }`.
Without the filter the mod fails `claude plugin validate`. `*` does not select these events.

A hook can return `{ deny }`. The built-in `cc-plugin-telemetry` sends the records. The collector is the one the operator of the session configured.

Official page: [Mods Reference](https://code.claude.com/docs/en/plugins/mods/reference). Source: the Mod API type file of the 2.1.322 program (`schemas/claude-code.d.ts`).

## Example

```javascript
on("telemetry.log", { to: "collector" }, ($, e, next) => next(e));
```

## Members

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `$.telemetry.log` | <Documented /> | Logs one record to the destination `entry.to` names. It is the event `telemetry.log`. `anthropic` is the default. | `(entry: TelemetryLogArgs) => Promise<void>`. Sends a first-party row or a collector record. The engine queues a first-party row for built-ins only. Rejects if a hook denies. | Only built-ins and the engine make records that Claude Code sends. |
| `$.telemetry.mark` | <Documented /> | Marks one use of a feature, as the CLI's own feature events do. It takes no `to` and always means `anthropic`. | `(entry: TelemetryMarkInput) => Promise<void>`. The engine does nothing with it. Built-in plugins that hook the event queue the row. | Only built-ins and the engine make records that Claude Code sends. |

## Engine Events

| Item | Status | What it does | How it works | Where it can be used |
| --- | --- | --- | --- | --- |
| `telemetry.log` | <Documented /> | Fires when a record is about to be logged to the destination `e.to` names. | Input `TelemetryLogInput`. Result `{ value: undefined }` or `{ deny }`. The type pins `e.to`. | `on('telemetry.log', ...)`. Also `$.telemetry.log(...)`. |
| `telemetry.mark` | <Documented /> | Fires when a caller marks one use of a feature. It always goes to `anthropic`, with no `to`. | Input `TelemetryMarkInput`. Result `{ value: undefined }` or `{ deny }`. `{ deny }` rejects the caller. | `on('telemetry.mark', ...)`. Also `$.telemetry.mark(...)`. |

## Types

| Item | Status | What it is for | Shape and limits |
| --- | --- | --- | --- |
| `TelemetryAttribute` | <Documented /> | One attribute of a collector record. | `string \| number \| boolean \| readonly string[]` |
| `TelemetryChoice` | <Documented /> | A string property of a first-party row: the value and the list it is chosen from, so no free text reaches a row. | Fields `value` and `of`. Every member of `of` is a lowercase token of letters, digits, `_`, and `-`. At most 32 members. `value` is one of them. |
| `TelemetryDestination` | <Documented /> | Where a record goes. | `'anthropic'` (first-party analytics) or `'collector'` (the one the operator configured). |
| `TelemetryLogArgs` | <Documented /> | What a call of `$.telemetry.log` passes. | `TelemetryRowArgs \| TelemetryRecordEntry` |
| `TelemetryLogInput` | <Documented /> | The input of `telemetry.log`. `to` is always present. The type pins it. | `TelemetryRowEntry \| TelemetryRecordEntry` |
| `TelemetryLogResult`, `TelemetryMarkResult` | <Documented /> | What a hook returns and `next(e)` resolves to. | `{ value: undefined }`, or `{ deny }`, which rejects the caller's promise. |
| `TelemetryMarkInput` | <Documented /> | The input of `telemetry.mark`. | `feature` (snake_case name), `kind` (`TelemetryMarkKind`), `reason?` (a short token), `props?` (`Readonly<Record<string, TelemetryProp>>`). |
| `TelemetryMarkKind` | <Documented /> | How one use of a feature went. | `'ok'` (the person got what they asked), `'sad'` (degraded, they still got something), `'bad'` (failed, they got nothing). |
| `TelemetryProp` | <Documented /> | One property of a first-party row or a mark. | `number \| boolean \| TelemetryChoice` |
| `TelemetryRecordEntry` | <Documented /> | A record for the collector the operator configured. | `to` (`'collector'`, pinned), `event` (leaves as `claude_code.<event>`), `attributes` (go out as they stand), `loggedAt` (ISO 8601 to the millisecond), `span?` (`TelemetrySpan`). |
| `TelemetryRowArgs` | <Documented /> | A first-party row as a call passes it. | `to?` (`'anthropic'`), `event`, `props?`. |
| `TelemetryRowEntry` | <Documented /> | A first-party row as a hook reads it. `to` is always present. | `to` (`'anthropic'`, pinned), `event`, `props?`. |
| `TelemetrySpan` | <Documented /> | The span a collector record belongs to, in W3C trace context spelling. | `traceId` (32 hex digits), `spanId` (16 hex digits), `traceFlags` (bit 0 set when the trace is sampled). |

## Related Pages

- [Mod API Overview](../index.md)
- [Files, Nouns, and Gates](../nouns-and-gates.md#built-in-mods)
