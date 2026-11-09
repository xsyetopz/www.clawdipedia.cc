---
title: JSON Schemas
description: JSON Schemas and the Mod API type file for every Claude Code 2.1.314 payload and config file, made from the program, and how they differ from the SchemaStore copies.
sidebar_position: 6
---

This site publishes the exact fields of every Claude Code `2.1.314` payload and config file: 17 JSON Schemas and the Mod API type file.
Most are made by running the program's own validators. So they list every key that this release knows.
Paste a config file's `$schema` URL into the file. Your editor can then suggest keys and flag mistakes.

They list every field of this release. Look a field up in them before you rely on it. Build on the fields they name.

## The Schemas

| File kind | Where the file lives | `$schema` URL |
| --- | --- | --- |
| Settings | `~/.claude/settings.json`, `.claude/settings.json`, `.claude/settings.local.json` | `https://clawdipedia.cc/schemas/claude-code-settings.json` |
| Managed settings | The managed settings file of your system | `https://clawdipedia.cc/schemas/claude-code-managed-settings.json` |
| Plugin manifest | `.claude-plugin/plugin.json` | `https://clawdipedia.cc/schemas/claude-code-plugin-manifest.json` |
| Marketplace | `.claude-plugin/marketplace.json` | `https://clawdipedia.cc/schemas/claude-code-marketplace.json` |
| Plugin hooks | `hooks/hooks.json` in a plugin | `https://clawdipedia.cc/schemas/claude-code-plugin-hooks.json` |
| Keybindings | `~/.claude/keybindings.json` | `https://clawdipedia.cc/schemas/claude-code-keybindings.json` |
| MCP servers | `.mcp.json` | `https://clawdipedia.cc/schemas/claude-code-mcp.json` |
| Custom agents | The JSON of `claude --agents` | `https://clawdipedia.cc/schemas/claude-code-agents-json.json` |

### Payloads

These files describe messages, not config files, so they have no `$schema` line to paste.
Files made only of definitions have no root. Pick the definition by name, such as `BashInput`.

| Payload | Made from | URL |
| --- | --- | --- |
| Hook output (stdout JSON of a settings hook) | The program's validator | `https://clawdipedia.cc/schemas/claude-code-hook-output.json` |
| Built-in tool inputs and results | Each tool's validator | `https://clawdipedia.cc/schemas/claude-code-tools.json` |
| Headless control protocol | The program's validators | `https://clawdipedia.cc/schemas/claude-code-control-protocol.json` |
| `stream-json` messages | The program's validators | `https://clawdipedia.cc/schemas/claude-code-stream-json.json` |
| Frontmatter of skills, subagents, and output styles | The program's validators | `https://clawdipedia.cc/schemas/claude-code-frontmatter.json` |
| Status line input | The program's code | `https://clawdipedia.cc/schemas/claude-code-status-line.json` |
| Transcript lines | The program's code | `https://clawdipedia.cc/schemas/claude-code-transcript.json` |
| OpenTelemetry metrics, spans, and events | The program's code | `https://clawdipedia.cc/schemas/claude-code-otel.json` |
| `~/.claude.json` | The program's code | `https://clawdipedia.cc/schemas/claude-code-claude-json.json` |
| Mod API calls, events, types, and hook input | The program's type file, unchanged | `https://clawdipedia.cc/schemas/claude-code.d.ts` |

The generator makes a file from the program's code. It reads the object literals and key lists that build the payload.
In it, `x-unverified` marks a field whose type the code does not show, and `x-observed` marks a field that a probe saw.
A field whose type a person read by hand from the program's code has that type and no `x-unverified`. The generator checks on each run that the code it was read from is still in the program.
A field that is still `x-unverified` may carry `x-observed-type`, the JSON types that real payloads had there. It is a note and does not change what the schema accepts.
Each file's `$comment` names the strings in the program that it was read from.

The managed schema has every key of the settings schema plus the keys that only managed settings honor.
Those keys carry `"x-managed-only": true`.

### Example

```json
{
  "$schema": "https://clawdipedia.cc/schemas/claude-code-settings.json",
  "permissions": { "allow": ["Bash(bun test)"] },
  "syncClaudeAiSkills": true
}
```

## The Mod API Type File

`https://clawdipedia.cc/schemas/claude-code.d.ts` is the Mod API type file that the `2.1.314` program carries, copied unchanged with a short header.
It declares every `$` call, every event, and their types, with their doc comments.
It does not hold the fields of the built-in tools. `BuiltinToolInputs` and `BuiltinToolResults` are empty in it. The program writes them beside each mod it loads, as `claude-code-tools/index.d.ts`.
Read it for the exact fields of a payload. It names every one.
`bun run schemas` extracts it from the program. `bun run schemas:check` checks that its header names the release.

## How They Are Made

The program is a single executable that carries its JavaScript and a copy of the zod 4 validator library.
The generator in `tools/schemas/` reads the executable without changing it and writes the embedded modules to a temp folder.
It adds a capture line to the modules that hold the validators. Then it loads them in a child process with a fake API key, a closed proxy port, and a temp home folder.
Last, it calls the `toJSONSchema` function of the program on each validator. It writes the result in draft 2020-12.
For the payloads with no validator, `tools/schemas/code.ts` reads the program's code instead.
It parses each module with [meriyah](https://github.com/meriyah/meriyah). It resolves names with [eslint-scope](https://github.com/eslint/js/tree/main/packages/eslint-scope). So it follows a name to its value, a parameter to the argument of each call, and a call to what the function returns. It also follows imports between modules. It also follows computed keys like `[name]` whose value is a constant string.
The generator sends nothing over the network and uses no real credentials.

Two parts need extra steps:

- The program builds the full plugin manifest from a base object plus one object for each component. So the generator takes the merged object.
- The marketplace file reads `plugins` as a list of unknown values and checks each entry later. The generator puts the entry schema into `plugins.items`.

## Regenerate

```sh
bun run schemas        # rewrite schemas/ from the installed 2.1.314 program
bun run schemas:check  # check the files, and check the good and bad examples in tools/schemas/fixtures
```

The check runs as part of `bun run verify`.

## Limits

- The program also runs checks written as code, such as "a hooks file needs `hooks` or `modules`". A JSON Schema cannot hold them. So the schemas lack them.
- The program does not list which settings keys only work in managed settings. The generator reads that from each key's description. So a key with unusual wording can be missed. The current run found 23 top-level keys and 3 nested ones (`sandbox.bwrapPath`, `sandbox.socatPath`, `sandbox.network.allowManagedDomainsOnly`).
- The schemas allow keys they do not know in settings files, as the program does. A typo in a key name is not an error.
- The `xaaIdp` setting exists only when you set `CLAUDE_CODE_ENABLE_XAA=1` in the environment. The generator sets it. So the key is in the schema. Its description says so.
- The program uses `starts_with` and `ends_with` as `format` values for some path fields. They are not standard JSON Schema formats, so editors ignore them. They do not check those rules.
- A few values the program accepts, such as `undefined`, cannot be written in JSON. The generator drops them.

## Differences From SchemaStore

We compared the files with the copies on [SchemaStore](https://json.schemastore.org/claude-code-settings.json) on 2026-10-30. Key counts are top-level keys.

| Schema | SchemaStore | This site | Notes |
| --- | --- | --- | --- |
| Settings | 142 | 172 (195 with managed-only keys) | SchemaStore lacks `syncClaudeAiSkills`, `syncClaudeAiPlugins`, `modelSettings`, `remote`, `timeZone`, `quietHours`, and 49 more (55 keys in all, 66 when you count managed-only keys). |
| Plugin manifest | 22 | 29 | SchemaStore lacks `displayName`, `defaultEnabled`, `metadata`, `workflows`, `binaries`, `types`, `experimental`. |
| Marketplace | 9 | 10 | SchemaStore lacks `renames`. |
| Keybindings | 3 | 3 | Same keys. SchemaStore forbids unknown top-level keys. This schema does not. |
| Plugin hooks | none | 5 | SchemaStore has no schema for this file. |

SchemaStore has 25 settings keys that this site's settings schema does not. 12 of them are managed-only keys, such as `policyHelper` and `allowManagedHooksOnly`, which this site's managed schema has.
The other 13 are not in the `2.1.314` validator at all, for example `autoConnectIde`, `diffTool`, `skippedPlugins`, and `sshHostAllowlist`. Four are keys of the global config file `~/.claude.json`: `autoConnectIde`, `autoInstallIdeExtension`, `diffTool`, and `externalEditorContext`. Five are desktop-app fields that the program carries: `browserExternalPageTools`, `disableBrowserExternalNavigation`, `disableMobileSimulatorTools`, `requireCoworkFullVmSandbox`, and `sshHostAllowlist`. Four have no string in the `2.1.314` program: `permissionExplainerEnabled`, `skippedMarketplaces`, `skippedPlugins`, and `teammateDefaultModel`.

SchemaStore also has [`claude-code-launch.json`](https://json.schemastore.org/claude-code-launch.json), the Launch Preview file for preview servers in Claude Code Desktop.
This site has no copy of it. We found no validator for that file in the `claude` program. It belongs to the Desktop app. So there is nothing to export from the binary.

## Related Pages

- [Settings](../configure/settings/index.md)
- [Files on Disk](../start/files-on-disk.md)
- [Probes](probes.md)
- [OpenTelemetry Events](opentelemetry.md)
- [Undocumented Features](undocumented.md)
