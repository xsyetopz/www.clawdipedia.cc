---
title: Files, Search, and Memory
description: Every parameter of Read, Write, Edit, NotebookEdit, Glob, Grep, LSP, and the memory tools.
sidebar_position: 2
---

These tools read, write, and search files, and they store memory notes.
Use `Read` before `Edit`, because `Edit` replaces an exact string in a file.
For example, `Grep` with `output_mode` set to `files_with_matches` lists only the files that match.
[Tools](index.md#how-to-read-the-tool-tables) explains the Yes and No columns.

You can also read or edit files yourself and let Claude see the result. Deny the tool name in `permissions.deny`, or leave it out of a subagent `tools` list, to turn a tool off. The memory tools need a server-side flag.[^tools-sources]

## Example

Block reads of secret files and all edits to lock files.

```json title=".claude/settings.json"
{
  "permissions": {
    "deny": ["Read(./.env)", "Read(./secrets/**)", "Edit(./package-lock.json)"]
  }
}
```

## Tools

| Tool | Status | What It Does | How It Works | Available In | Read-Only | Parallel | Deferred |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `Read` | <Documented /> | Reads files, images, PDFs, and notebooks. | See [Read Parameters](#read-parameters). | Main session and subagents. Kept in background subagents. | ✅ | ✅ | ❌ |
| `Write` | <Documented /> | Creates or overwrites a file. | `file_path` (string, required, absolute), `content` (string, required), `machine` (optional). A deny rule wins. | Main session and subagents. Kept in background subagents. | ❌ | ❌ | ❌ |
| `Edit` | <Documented /> | Replaces an exact string in a file. | `file_path` (required), `old_string` (required), `new_string` (required, must differ), `replace_all` (boolean, default false), `machine` (optional). | Main session and subagents. Kept in background subagents. | ❌ | ❌ | ❌ |
| `NotebookEdit` | <Documented /> | Edits a cell of a Jupyter notebook. | See [NotebookEdit Parameters](#notebookedit-parameters). | Main session and subagents. Kept in background subagents. | ❌ | ❌ | ✅ |
| `Glob` | <Documented /> | Finds files by glob pattern. | `pattern` (string, required), `path` (string, optional, directory), `machine` (optional). | Main session and subagents. The docs say a subagent can get `Glob` and `Grep` when the main session lacks them (macOS, Linux, WSL). | ✅ | ✅ | ❌ |
| `Grep` | <Documented /> | Searches file contents with ripgrep. | See [Grep Parameters](#grep-parameters). | Same as `Glob`. | ✅ | ✅ | ❌ |
| `LSP` | <Documented /> | Code intelligence: definitions, references, symbols, hover, call hierarchy. | `operation`, `filePath` (required), `line` (int, 1 or more, required), `character` (int, 1 or more, required), `query` (optional, `workspaceSymbol` only). | Main session and subagents. | ✅ | ✅ | ✅ |
| `memory_read` | <Undocumented /> <Gated note="hidden server-side flag" /> | Reads a document from a memory store. | `store` (string, required), `path` (string, required). | Only when auto memory is on (`autoMemoryEnabled`, no `CLAUDE_CODE_DISABLE_AUTO_MEMORY`) and the memory mode is `tools`. The mode is `tools` when a server flag is on (default off) or organization memory is not closed. Organization memory needs a second server flag, no `CLAUDE_CODE_DISABLE_ORG_MEMORY` or `CLAUDE_MEMORY_STORES`, and the `allow_memory_sync` policy. The mode stays `files` in cloud sessions that set `CLAUDE_CODE_REMOTE_MEMORY_DIR`, and when you set `CLAUDE_COWORK_MEMORY_GUIDELINES`.[^memory-flags] | ✅ | ✅ | ❌ |
| `memory_write` | <Undocumented /> <Gated note="hidden server-side flag" /> | Saves a document to a memory store. | `store`, `path`, `content` (all strings, required), `if_version` (string, max 64, version token for compare-and-set). `content` replaces the whole document. | Same as `memory_read`. | ❌ | ❌ | ❌ |
| `memory_list` | <Undocumented /> <Gated note="hidden server-side flag" /> | Lists memory stores and their documents. | `store` (optional), `path_prefix` (optional, directory-aligned), `cursor` (optional). | Same as `memory_read`. | ✅ | ✅ | ❌ |

## `Read` Parameters

| Parameter | What It Does | Required |
| --- | --- | --- |
| `file_path` | Absolute path of the file. | ✅ |
| `offset` | Line to start from, 0 or more. | ❌ |
| `limit` | Number of lines to read, more than 0. | ❌ |
| `pages` | PDF page range such as `1-5`, at most 20 pages at a time. | ❌ |
| `allow_large` | Reads a file or range over the usual size limits, as far as the context allows. | ❌ |
| `machine` | Name of an attached machine. Offered only when machines are attached. | ❌ |

## `NotebookEdit` Parameters

| Parameter | What It Does | Required |
| --- | --- | --- |
| `notebook_path` | Absolute path of the `.ipynb` file. | ✅ |
| `new_source` | The new source of the cell. | ✅ |
| `cell_id` | Cell to edit. For `insert`, the new cell goes after it. | ❌ |
| `cell_type` | `code` or `markdown`. Required for `insert`. | ❌ |
| `edit_mode` | `replace` (default), `insert`, or `delete`. | ❌ |

## `Grep` Parameters

| Parameter | What It Does | Required |
| --- | --- | --- |
| `pattern` | The regular expression to search for. | ✅ |
| `path` | File or directory to search. | ❌ |
| `glob` | Glob filter such as `**/*.tsx`. | ❌ |
| `output_mode` | `content`, `files_with_matches` (default), or `count`. | ❌ |
| `-B` | Lines before each match. Needs `content` mode. | ❌ |
| `-A` | Lines after each match. Needs `content` mode. | ❌ |
| `-C` | Alias for `context`. | ❌ |
| `context` | Lines before and after each match. Needs `content` mode. | ❌ |
| `-n` | Shows line numbers. Needs `content` mode, default true. | ❌ |
| `-i` | Case-insensitive search. | ❌ |
| `-o` | Prints only the matched parts. Needs `content` mode. | ❌ |
| `type` | File type such as `js`, `py`, or `rust`. | ❌ |
| `head_limit` | Limits the first N entries. Default 250, `0` for no limit. | ❌ |
| `offset` | Skips the first N entries before `head_limit`. | ❌ |
| `multiline` | Lets `.` match newlines and patterns span lines. | ❌ |
| `machine` | Name of an attached machine. Offered only when machines are attached. | ❌ |

## How It Works

- `machine` is an extra optional field that Claude Code adds to a tool schema when an attached-machines feature is on.
- File tools check permissions with the rule syntax in [Permission Rules](../../configure/permissions/rules.md).
- `Read`, `Glob`, `Grep`, `Write`, and `Edit` carry `remoteExecution` metadata in the program. It marks them as runnable on a remote host.
- In a `--restricted` session, a file outside the working directories is refused for a file reference or an upload, even when a `Read` allow rule covers it.[^restricted-316]
- `Read` has no result size cap. So use `offset` and `limit` for large files.
- `Grep` sorts `content` and `count` results by file path. Paging with `head_limit` and `offset` does not repeat or skip results.[^grep-page]
- `Read` opens a Jupyter notebook that holds an output of an unknown type.[^read-nb]
- `NotebookEdit` keeps the final newline of the notebook file.[^nb-newline]
- When a file of 10 MB or more is too large to read at once, `Read` reports the real size.[^read-size]
- A message looks up only the first 100 `@` mentions as files. A message with thousands of mentions does not stall.[^at-100]

## When `Glob` And `Grep` Are Offered

When `Glob` or `Grep` is not offered, `Bash` does the work.

- A call to a tool that is not offered fails with a note. For `Glob`, the note says to find files with `find` through `Bash`. For `Grep`, it says to search file contents with `grep` through `Bash`.[^glob-grep]

## Write and Edit Limits

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| `permissions.blockWritesOutsideWorkingDirectories` | <Documented /> | `Write`, `Edit`, and `NotebookEdit` refuse a path outside the working directories in every permission mode. | No allow rule lifts it. The setting also refuses a write to a Claude Code settings file inside the working directories. It removes `EnterWorktree` and `ExitWorktree` from the tools on offer. It does not limit shell commands, MCP tools, the programs that hooks run, or the memory tools. See [Permission Rules](../../configure/permissions/rules.md). |
| Server-managed settings | <Undocumented /> | `Write` and `Edit` ask before they change the local copy of your organization's server-managed settings. | They ask in the same way for a user settings file. See [Settings](../../configure/settings/index.md). |
| Sign-in files | <Undocumented /> | `Write` and `Edit` refuse the sign-in token file, the file with the keys that identify this computer, and the lock file that Claude Code takes while it saves tokens. They also refuse a hard link to one of these files.[^signin-files] | The refusal says that Claude Code keeps these files for itself and that tools cannot write them. |
| `Edit` after compaction | <Undocumented /> | `Edit` runs on a file outside the project that Claude read in full before a compaction, if the file is unchanged. It does not fail with `File has not been read yet`.[^edit-compaction] | The file text must equal the text that Claude read. A file that Claude read in part, or a file that changed, still fails. |

## Write on a File That Claude Read Only in Part

`Write` refuses to overwrite some very large instruction files.
The files are a `CLAUDE.md` file, a rules file, or an `@`-included file that Claude Code loads for a subdirectory.[^partial-read]

| Item | Status | What it does | Notes |
| --- | --- | --- | --- |
| Size test | <Gated note="Server flag, on by default" /> | Claude Code cuts a loaded file when its text is longer than a limit. It adds the line `Only the start of this file is shown.` and marks the file as read in part. | The limit is the larger of 40,000 characters and 5% of the model context window, scaled by the bytes per token of the model. A managed file is never cut.[^size-flag] |
| `Write` refusal | <Undocumented /> | While the mark holds, `Write` on the file fails with error code 19. | The message says that Claude has only the start of the file. A `Write` could lose the rest. It tells Claude to use `Edit` to change part of it. To replace the file, Claude must first `Read` it in one call with no `offset` or `limit`. |
| Clear the mark | <Undocumented /> | A `Read` of the whole file removes the refusal. | The program tests that the stored view holds the whole file and began at line 1. |

## Errors

Each row is a family of messages. The backticked text is the start that every message in the family shares. A row marked `Various` gathers the messages of one feature that do not share one start.

| Start of Message | Status | What It Means | Cases |
| --- | --- | --- | --- |
| Various | <Undocumented /> | File tools: `Read`, `Edit`, `Write`, or `NotebookEdit` refused a call. | A Read deny rule covers the file. Claude has not read it yet. It changed since Claude last read it. It is too large. It is a pipe or device. It is a symbolic link. It is not a valid image, PDF page, or notebook. The edit does not match (string not found, no change). A `Write` call ended with `Write verification failed:` after the program saved the file. The text is `PATH is N bytes on disk, expected M` (size differs) or `PATH does not hold what was written` (bytes differ).[^write-verify] |
| `read not allowed under` | <Undocumented /> | File references and uploads: the program refused to read a file that a file reference, a Chrome file upload, or the upload screen named. The text ends with the path. | `read not allowed under --restricted: ${path}` means a `--restricted` session found the file outside the working directories and no working-directory rule covers it. A Read allow rule does not open it in this mode.[^restricted-316] `read not allowed under ${setting}: ${path}` means a read block refuses the path, or the real path behind it. `${setting}` is `permissions.blockReadsOutsideWorkingDirectories`, `permissions.blockFileToolReadsOutsideWorkingDirectories`, or both joined with ` and `.[^read-blocked] |
| `ExitWorktree stopped before it left or removed any worktree` | <Undocumented /> | `ExitWorktree`: the session entered or left a worktree while the call ran, so the tool changed nothing. | The text goes on: `this session entered or left one while the call ran. Check where the session is now before calling ExitWorktree again.` Check where the session is, then call the tool again.[^exit-worktree-stop] |
| `Refusing to read` | <Undocumented /> | File import: the gated `/import` command, which imports config from another AI coding agent ([Slash Commands](../../extend/skills-and-commands/slash-commands.md)), opened a file for a project-scope import and the opened handle is not a regular file. The text is `Refusing to read ${path}: it is not a regular file.` | The reader opens the path without following links. A file over `10485760` bytes (`IMPORT_MAX_FILE_BYTES`) fails with `file exceeds IMPORT_MAX_FILE_BYTES; refusing to load`.[^import-read] |
| `Cannot read '` | <Undocumented /> | `Read`: the tool refuses a path that names a device or process file, such as a file under `/dev` or `/proc`. A path that goes through a link into `/proc` or `/dev` gets a refusal that says the tool does not follow that link and asks for the file's own path.[^device-files] | The text is `Cannot read '<path>': this path names a device or process file that this tool does not read.` `Grep` refuses with `Refusing to search <path>: it leads to a device or process file.` |
| `Unable to compress image`, `Unable to resize image` | <Undocumented /> | An image that a tool read or a user pasted did not fit the size limit and the program could not shrink it. | The text is `Unable to compress image (<size>) to fit within <limit>. Please use a smaller image.` or the same start with a reason and advice. The `Unable to resize image` forms say that the image size could not be checked or that image processing is not available. Use a smaller image. |
| `Notebook file does not exist.` | <Undocumented /> | `NotebookEdit` found no file at `notebook_path`. | The tool checks the input first, and again when the call runs. Both stop with this text, and nothing is written. Give the path of a notebook that exists.[^notebook-checks] |
| `Notebook is not valid JSON.` | <Undocumented /> | `NotebookEdit` read the file, and its text is not JSON. | A file with the right name but other content gives this text. The program then also refuses a JSON file that is not a notebook (a separate message). Nothing is written. Repair or restore the file.[^notebook-checks] |
| `Edit rejected: the updated notebook would exceed the maximum size this tool can read` | <Undocumented /> | A `NotebookEdit` change would make the notebook larger than `Read` can open. | The tool builds the new notebook text in memory and checks its size before it writes. The text ends with the limit and `The file was left unchanged.` Use a smaller edit, or split the notebook.[^notebook-size] |

## Related Pages

- [Tools](index.md)
- [Permission Rules](../../configure/permissions/rules.md)
- [Tools Reference](https://code.claude.com/docs/en/tools-reference)

## Sources

[^tools-sources]: [Tools Reference](https://code.claude.com/docs/en/tools-reference), [Configure Permissions](https://code.claude.com/docs/en/permissions), and the program, the tool input schemas, `chunk-bzyb60p0.js:254174` (`Read`, `file_path`), `chunk-bzyb60p0.js:105616` (`Write`), and `chunk-bzyb60p0.js:285789` (`NotebookEdit`, `notebook_path`).
[^memory-flags]: The program, `chunk-p1ewvgeh.js:2982` and `chunk-p1ewvgeh.js:13307`. The first server flag is `tengu_linen_orbit`. The second is `tengu_haze_glass`.
[^restricted-316]: The program, `chunk-e1ww8aev.js:128` and `chunk-yt7wk02j.js:813`.
[^glob-grep]: The program, `chunk-bzyb60p0.js:208965` (the notes for a tool that is not offered, `Glob` and `Grep`).
[^size-flag]: The program, `chunk-bzyb60p0.js:261665` (the size test and the rule for a managed file, `Managed`), `chunk-bzyb60p0.js:12830` (the added line), and `chunk-bzyb60p0.js:261692`. The server flag is `tengu_quizzical_mango`.
[^partial-read]: The program, `chunk-bzyb60p0.js:261694` (the nested file is marked as read in part, `markStartOnly`), `chunk-bzyb60p0.js:105849` (the `Write` refusal, error code 19), and `chunk-5sjwf92x.js:107` (the mark, `markStartOnly`).
[^write-verify]: The program, `chunk-2yx6c1y2.js:938` (the size text) and `chunk-2yx6c1y2.js:938` (the bytes text, `Write verification failed: ... does not hold what was written`).
[^read-blocked]: The program, `chunk-e1ww8aev.js:128`; `chunk-pbteexar.js:337`.
[^exit-worktree-stop]: The program, `chunk-aw5nczax.js:8223`.
[^import-read]: The program, `chunk-0cp7gxnn.js:294` and `chunk-0cp7gxnn.js:113` (`IMPORT_MAX_FILE_BYTES`).
[^notebook-checks]: The program, `chunk-bzyb60p0.js:286014`, `chunk-bzyb60p0.js:286026`, `chunk-bzyb60p0.js:286069`, and `chunk-bzyb60p0.js:286077`.
[^notebook-size]: The program, `chunk-bzyb60p0.js:286154`.
[^grep-page]: The program, `chunk-zxxe6wr3.js:462` (the changelog text).
[^read-nb]: The program, `chunk-zxxe6wr3.js:463` (the changelog text).
[^nb-newline]: The program, `chunk-zxxe6wr3.js:464` (the changelog text).
[^read-size]: The program, `chunk-zxxe6wr3.js:465` (the changelog text).
[^at-100]: The program, `chunk-bzyb60p0.js:259500` (`too_many_mentions`, the check on the count) and `chunk-bzyb60p0.js:259410` (the limit of 100, `$241f52_16`).
[^signin-files]: The program, `chunk-p1ewvgeh.js:11369` (the hard-link refusal, `$e93ff7`) and `chunk-p1ewvgeh.js:11384` (the refusals, each with the message "tools cannot write").
[^device-files]: The program, `chunk-xfj2cwfv.js:6402` (the `Read` refusals and the link refusal) and `chunk-g03qj0bk.js:601` (the `Grep` refusal).
[^edit-compaction]: The program, `chunk-bzyb60p0.js:47037` (the test, `unchangedSinceReadBeforeCompaction`) and `chunk-zxxe6wr3.js:461` (the changelog text).
