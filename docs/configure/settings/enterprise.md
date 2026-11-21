---
title: Enterprise Settings
description: Keys that control how managed settings arrive and which Claude Code versions may run.
sidebar_position: 9
---

These keys let an administrator control how managed settings arrive and which Claude Code versions may run. Use them only if you manage a machine or organization. Put them in managed settings. `forceRemoteSettingsRefresh` and `wslInheritsWindowsSettings` are switches. For the places managed settings can come from, see the managed settings section of the index page.

## Example

### Require a Version Range

This file stops versions older than `2.1.300` from starting, except for the `update`, `install`, and `doctor` commands. It also merges all managed sources instead of using the top one alone, when two or more managed sources exist.[^version-range]

```json title="/etc/claude-code/managed-settings.json"
{
  "requiredMinimumVersion": "2.1.300",
  "managedSourcesBehavior": "merge"
}
```

## Keys

Official page: [Settings Reference](https://code.claude.com/docs/en/settings-reference) for rows marked <Documented />. For rows marked <Undocumented />, the facts come from the settings schema.[^schema] Where to Set It tells you which files may set the key. See [Settings Files and Scopes](index.md#where-settings-live).

| Key | Status | Type | Default | What It Does | Where to Set It |
| --- | --- | --- | --- | --- | --- |
| `disableReplyCheck` | <Undocumented /> <ManagedOnly /> | boolean | - | Turn off the reply check in Claude Tag sessions on a self-hosted runner. The check asks Claude again, at most four times a turn, when a turn ends without a call to one of the reply tools of Claude Tag. It is not a hook, so `disableAllHooks` does not affect it. `true` also stops two messages that the Anthropic service can request for such a session: a nudge after a long stretch of work with no visible update, and a reminder added to prompts. `false` in managed settings keeps the check on. In every other file Claude Code ignores the key and writes the debug line "disableReplyCheck is ignored in user settings: only managed settings can turn the reply check off". It has no effect on sessions that Anthropic hosts. The check trusts three tiers: the managed file always, the server-managed settings when the server confirmed them, and the plist or the Windows `HKLM` key when a user cannot write them. On macOS the managed file is `/Library/Application Support/ClaudeCode/managed-settings.json`, which needs root.[^reply-check] | Managed settings only |
| `disableWindowsBashCommandSplit` | <Undocumented /> <ManagedOnly /> | boolean | - | Windows only. `true` keeps every Bash command in one argument to bash, so that endpoint security tools that match text in process command lines see it whole. Without it, Claude Code may split a long command over several arguments. With `true`, a command of about 7,000 characters or more, or fewer if it is full of quotes, may reach bash cut short and then usually fails with a syntax error. Claude Code honors it only from managed settings. It accepts the value in user, project, local, and `--settings` sources and writes no line, but only the policy tier reads it. A string such as `"yes"` gives `disableWindowsBashCommandSplit: Expected boolean, but received string`.[^windows-split] | Managed settings only |
| `forceRemoteSettingsRefresh` | <Documented /> <ManagedOnly /> | boolean | - | Block startup until Claude Code freshly fetches server-managed settings. Claude Code exits if the fetch fails. | Managed settings only |
| `managedSourcesBehavior` | <Documented /> | enum: `first-wins`, `merge` | - | Compose every managed source you deploy instead of using the highest-priority one alone. `first-wins` (the default) uses the highest source alone. `merge` combines them. | Managed settings only |
| `parentSettingsBehavior` | <Documented /> | enum: `first-wins`, `merge` | - | Apply or drop restrictions an SDK or IDE host passes when you deploy managed settings. `first-wins` drops the parent tier. `merge` unions it in. | Managed settings only |
| `policyHelper` | <Documented /> <ManagedOnly /> | object: `path`, `timeoutMs`, `refreshIntervalMs` | - | Run an executable that computes managed settings at startup. Claude Code honors it only from admin-controlled policy sources. `timeoutMs` is at least 1000. `refreshIntervalMs` is `0` or at least 60000. A `path` of `null` counts as unset. The helper does not get environment variables from user or `--settings` files. Set what it needs in managed `env` or in the launching shell.[^helper-env] | Managed settings only |
| `policyHelper.path` | <Documented /> <ManagedOnly /> | string | - | Absolute path of the helper executable. Required when `policyHelper` is set. Official page: [`policyHelper.path`](https://code.claude.com/docs/en/settings-reference#policyhelper-path). | Managed settings only |
| `policyHelper.timeoutMs` | <Documented /> <ManagedOnly /> | integer | `10000` | How long Claude Code waits for the helper, in milliseconds. The minimum is `1000`. A timed-out run fails like a non-zero exit. Official page: [`policyHelper.timeoutMs`](https://code.claude.com/docs/en/settings-reference#policyhelper-timeoutms). | Managed settings only |
| `policyHelper.refreshIntervalMs` | <Documented /> <ManagedOnly /> | integer | unset | Re-runs the helper in the background, in milliseconds. `0` turns refresh off. Otherwise the minimum is `60000`. Official page: [`policyHelper.refreshIntervalMs`](https://code.claude.com/docs/en/settings-reference#policyhelper-refreshintervalms). | Managed settings only |
| `policyHelpers` | <Undocumented /> | object: `macos`, `linux`, `windows`, `wsl`, `default` | - | Give each platform its own policy helper or static payload (`defaultSettings`). `default` is a static payload. WSL tries its own entry, then `linux`. The first helper on the platform chain wins over `policyHelper`. If none runs, the first static payload applies, then `default`, then `policyHelper`. The key is marked `@internal`.[^internal] | Settings files |
| `policyHelpers.default` | <Undocumented /> | object | - | A static payload: a managed-settings object that Claude Code applies with no process spawned. It applies when no helper on the platform chain runs, after the entry payloads. Claude Code rejects a payload that holds `policyHelper`, `policyHelpers`, an entry field (`path`, `script`, `interpreter`, `outputBehavior`, `onFailure`, `retries`, `timeoutMs`, `refreshIntervalMs`, `defaultSettings`), a stdout envelope key (`managedSettings`, `appendSystemPrompt`), or a platform name.[^policy-default] | Settings files |
| `policyHelpers.macos.path`, `policyHelpers.linux.path`, `policyHelpers.windows.path`, `policyHelpers.wsl.path` | <Undocumented /> | string | - | Absolute path of the helper executable. The maximum length is 1024. An entry sets `path` or `script`, not both.[^policy-entry] | Settings files |
| `policyHelpers.macos.script`, `policyHelpers.linux.script`, `policyHelpers.windows.script`, `policyHelpers.wsl.script` | <Undocumented /> | string | - | Inline helper script. Claude Code sends it to the fixed interpreter over stdin and never writes it to disk. Length 1 to 65536. It needs `interpreter`.[^policy-entry] | Settings files |
| `policyHelpers.macos.interpreter`, `policyHelpers.linux.interpreter`, `policyHelpers.windows.interpreter`, `policyHelpers.wsl.interpreter` | <Undocumented /> | enum | - | The fixed interpreter for `script`. It is `sh` (`/bin/sh`) on the `macos`, `linux`, and `wsl` entries. It is `pwsh` on the `windows` entry. PowerShell runs from its fixed install locations, never from `PATH`. It needs `script`.[^policy-entry] | Settings files |
| `policyHelpers.macos.outputBehavior`, `policyHelpers.linux.outputBehavior`, `policyHelpers.windows.outputBehavior`, `policyHelpers.wsl.outputBehavior` | <Undocumented /> | enum: `replace`, `merge` | `replace` | How the helper's `managedSettings` combine with the settings of the source that delivered the entry. `replace`: the output is the policy. `merge`: Claude Code deep-merges the output over the settings of that source. Helper scalars win, arrays union, and objects merge. Some keys, such as `fallbackModel`, `forceLoginOrgUUID`, `sandbox.filesystem.allowRead`, `sandbox.credentials.awsPairs`, and the allowlists such as `allowedMcpServers`, take the helper's whole value.[^schema] | Settings files |
| `policyHelpers.macos.onFailure`, `policyHelpers.linux.onFailure`, `policyHelpers.windows.onFailure`, `policyHelpers.wsl.onFailure` | <Undocumented /> | enum: `continue`, `refuse` | `refuse` from MDM or the managed settings file; `continue` from remote managed settings | What happens when the helper fails at startup and no static payload applies. `refuse`: Claude Code does not start and names the failure. `continue`: Claude Code starts on the settings of the delivering source, with a `/status` notice. Any other value counts as `refuse`. A background refresh failure keeps the last good output.[^schema] | Settings files |
| `policyHelpers.macos.retries`, `policyHelpers.linux.retries`, `policyHelpers.windows.retries`, `policyHelpers.wsl.retries` | <Undocumented /> | integer | `0` | How many more times to run the helper when a run fails to execute. Minimum `0`. A value above `5` counts as `5`. A short random backoff separates attempts (from 250 ms, doubling, at most 4 s). Each attempt gets the full `timeoutMs`. Claude Code does not retry refused output or an invalid `path`.[^schema] | Settings files |
| `policyHelpers.macos.timeoutMs`, `policyHelpers.linux.timeoutMs`, `policyHelpers.windows.timeoutMs`, `policyHelpers.wsl.timeoutMs` | <Undocumented /> | integer | - | How long Claude Code waits for this entry's helper, in milliseconds. The minimum is `1000`. Same field as `policyHelper.timeoutMs`.[^schema] | Settings files |
| `policyHelpers.macos.refreshIntervalMs`, `policyHelpers.linux.refreshIntervalMs`, `policyHelpers.windows.refreshIntervalMs`, `policyHelpers.wsl.refreshIntervalMs` | <Undocumented /> | integer | - | Re-runs this entry's helper in the background, in milliseconds. `0` turns refresh off. Otherwise the minimum is `60000`. Same field as `policyHelper.refreshIntervalMs`.[^schema] | Settings files |
| `policyHelpers.macos.defaultSettings`, `policyHelpers.linux.defaultSettings`, `policyHelpers.windows.defaultSettings`, `policyHelpers.wsl.defaultSettings` | <Undocumented /> | object | - | A static payload for this platform: a managed-settings object. An entry can hold `defaultSettings` alone, with no helper. A `null` counts as unset. Claude Code applies it when no helper runs or the helper fails, before the top-level `default`. An entry needs `path`, or `script` with `interpreter`, or `defaultSettings`.[^policy-entry] | Settings files |
| `requiredMaximumVersion` | <Documented /> <ManagedOnly /> | string | - | Refuse to start on a version newer than your organization allows. Claude Code exits at startup with install steps. This key works in managed settings only. | Managed settings only |
| `requiredMinimumVersion` | <Documented /> <ManagedOnly /> | string | - | Refuse to start on a version older than your organization requires. Claude Code exits at startup with update steps. This key works in managed settings only. | Managed settings only |
| `wslInheritsWindowsSettings` | <Documented /> | boolean | - | Have WSL read managed settings from the Windows policy chain. Set it in an admin-only Windows source. It has no effect on native Windows. | Managed settings only |

## Approval of Server-Managed Settings

Claude Code fetches server-managed settings from Anthropic's API.[^approval] It compares them with the copy you approved before. For changed settings, it either applies them without a prompt or shows an approval dialog.

Claude Code applies them without a prompt only when all of these are true:

1. You log in with a claude.ai account (OAuth).
2. Claude Code fetched the settings for the organization of the account that is logged in now, and that account is still logged in when Claude Code decides.
3. The login does not come from a profile store.
4. No other approval review is open.
5. If an admin-owned settings file sets `forceLoginOrgUUID`, the list holds that organization, and the signature of the settings names it.

Claude Code shows the dialog when Claude Code cannot read the `forceLoginOrgUUID` pin. This occurs if an admin-owned settings file has a read error, or if the managed-settings path is overridden.

When Claude Code cannot show the dialog, it keeps the copy you approved before.
In a run that cannot ask, it prints "Your organization's managed settings need your approval, which couldn't be asked for here."
In a non-interactive run, the new settings can apply for that run only, and Claude Code does not save them as approved.
If you reject the settings in a terminal, Claude Code prints "Managed settings were not approved; exiting without applying them." and exits with code 1.

Claude Code checks the stored copy on disk before it uses it. If the copy does not verify, Claude Code treats it as absent.
Claude Code also refuses to write over a stored copy that is not a regular file, with the error "the stored copy is not a regular file".

<Undocumented /> Claude Code also sends a checksum of the managed settings that it loaded in the `x-claude-code-managed-settings-checksum` request header.[^checksum-header] The program sends it only when all of these are true: hint headers are on, `CLAUDE_CODE_GATEWAY_HINT_HEADERS` is set to a true value in the `env` block of managed settings, managed settings exist, the provider is a gateway, or the Anthropic API at a base URL whose host is not `api.anthropic.com`, and `ANTHROPIC_UNIX_SOCKET` is not set. No official page names this header. See [Request Headers](../../reference/api/endpoints.md#request-headers).

## Related Pages

- [Settings Files and Scopes](index.md) explains the scopes, precedence, and managed settings.
- [Settings Reference](https://code.claude.com/docs/en/settings-reference) is the official page for each key.
- [Deploy Managed Settings](https://code.claude.com/docs/en/managed-settings) is the guide for administrators.

## Sources

[^schema]: The program, its bundled settings schema, for example `chunk-xcgcdx61.js:7896` (`timeoutMs` and `refreshIntervalMs`), `chunk-xcgcdx61.js:7900` (`replace` and `merge`), `chunk-xcgcdx61.js:7909` (`continue` and `refuse`), and `chunk-xcgcdx61.js:7920` (`retries`).
[^reply-check]: The program, `chunk-rckksdmd.js:1962` (the debug line), `chunk-rckksdmd.js:1959` (the sources checked for `disableReplyCheck`), and `chunk-k5r71ad2.js:7945` (the "Reply gate" log line).
[^windows-split]: The settings schema. The program reads the flag only from the policy tier (`policySettings`, `chunk-bzyb60p0.js:69459`), and formats the type error as `Expected <type>, but received <type>` (`chunk-6mfepmbb.js:2164`). The schema entry is at `chunk-xcgcdx61.js:8680`. The Bash command path checks the platform (`windows`), the command length, and `policySettings.disableWindowsBashCommandSplit`. The path cannot run on macOS, so no run shows the split.
[^helper-env]: The program, `chunk-2yx6c1y2.js:5351`.
[^internal]: The program, `chunk-xcgcdx61.js:8207` (the `@internal` text of `policyHelpers`).
[^policy-default]: The program, `chunk-xcgcdx61.js:8005-9381`.
[^policy-entry]: The settings schema and the program, `chunk-xcgcdx61.js:8048-9368`.
[^approval]: The program, `chunk-w58msjm6.js:333` (the `oauth` login and the same organization), `chunk-w58msjm6.js:340` (the profile store), `chunk-w58msjm6.js:361` (the organization pin check, `org_pin_unknown` and `org_pin_mismatch`), `chunk-zs6b24vw.js:36` (no other review open, `hasOpenReview`), `chunk-zs6b24vw.js:354` ("Managed settings were not approved; exiting without applying them.") and `chunk-zs6b24vw.js:356` ("Your organization's managed settings need your approval"), `chunk-v6tczjz9.js:17` (the `forceLoginOrgUUID` pin read and its errors), and `chunk-xcgcdx61.js:5330` and `chunk-xcgcdx61.js:5339` ("the stored copy is not a regular file").
[^version-range]: The program, its bundled settings schema, `chunk-xcgcdx61.js:9308` (`requiredMinimumVersion`) and `chunk-xcgcdx61.js:8922` (`managedSourcesBehavior`), `chunk-amkshz08.js:13` (`update`, `install`, and `doctor`, which the version check skips), `chunk-amkshz08.js:16` (`requiredMinimumVersion`), and `chunk-6mfepmbb.js:5161-5162` (`managedSourcesBehavior`, merged only for two or more sources).

[^checksum-header]: The program, `chunk-gq1dr8pm.js:12513` (hint headers on) `chunk-gq1dr8pm.js:17177` (the conditions), `chunk-vyzg3yfa.js:44` (the direct `api.anthropic.com` test that stops the header), and `chunk-zhr7rpv7.js:1786` (the host test). The [gateway compatibility guide](https://code.claude.com/docs/en/llm-gateway-protocol#gateway-hint-headers) names the hint headers but not this header, and the [settings page](https://code.claude.com/docs/en/settings) and [network page](https://code.claude.com/docs/en/network-config) do not mention it.
