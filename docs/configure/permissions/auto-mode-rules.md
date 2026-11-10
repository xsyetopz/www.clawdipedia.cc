---
title: Auto Mode Default Rules
description: The default allow, hard deny, environment, and soft deny entries of the auto mode classifier, one row per rule.
sidebar_position: 6
---

These are the built-in entries of the [auto mode](auto-mode.md) classifier.
An `allow` entry is an exception to a block rule.
A `soft_deny` entry blocks an action unless an `allow` entry applies or you clearly asked for it.
For example, `Production Deploy` blocks a deploy to production until you ask for it by name.

The entries apply whenever the permission mode is `auto`. Add or replace entries with the `autoMode` setting. Keep the defaults with `$defaults`. Drop `$defaults` from a list to remove the built-in entries of that list. The entries live inside the program. `claude auto-mode defaults` prints them as JSON.

## Example

```bash
claude auto-mode defaults --label "Production Deploy"
```

This prints the full text of one rule. `--label` matches the start of a label, without regard to case.
In the JSON, some labels end in `[named+specifics ...]`. For those rules, your request must name the listed item to count as direction.

Rule summaries below are short. Official page: [Configure Auto Mode](https://code.claude.com/docs/en/auto-mode-config). Rules marked <Undocumented /> come from `claude auto-mode defaults`.

A run of `claude auto-mode defaults` on `2.1.316` printed 16 `allow` entries, 72 `soft_deny` entries, 1 `hard_deny` entry, and 21 `environment` entries. The `Scheduled-Task Fires` rule is not in that output. The program reads it from its own template and keeps it when an `allow` list replaces the defaults (`chunk-dgc8shqt.js`).

## Allow Rules

Each `allow` rule is an exception to the soft deny rules.

| Rule | Status | What it allows |
| --- | --- | --- |
| `Security Discussion` | <Undocumented /> | Reading, reviewing, or writing security code and threat models is fine as part of your task. |
| `Transient Retry` | <Undocumented /> | Retrying an action after a network error, timeout, or rate limit is not a bypass. |
| `Test Artifacts` | <Documented /> | Fake test keys, placeholder credentials, and hardcoded test cases are fine. |
| `Local Operations` | <Undocumented /> | Deleting or changing local files inside the project is fine. |
| `Read-Only Operations` | <Undocumented /> | `GET` requests and queries that change nothing and return no secrets are fine. |
| `Declared Dependencies` | <Undocumented /> | Installing packages that the repo manifest already lists is fine. |
| `Toolchain Bootstrap` | <Undocumented /> | Installing a language toolchain from its official one-line installer is fine when the repo needs it. |
| `Standard Credentials` | <Undocumented /> | Reading a credential from the agent config and sending it to its own provider is fine. |
| `Session-Created Job Cleanup` | <Undocumented /> | Deleting the jobs that the agent itself made in this session is fine. |
| `Git Push Destination` | <Undocumented /> | Pushing to any branch of the session repo is normal, also the default branch. |
| `Trusted Internal Infra (Data Flow)` | <Undocumented /> | Domains, buckets, and services in `Environment` count as internal, not external. |
| `Scheduled-Task Fires` | <Undocumented /> | A scheduled-task prompt is not a live human instruction. This rule is not in the `claude auto-mode defaults` output. The program adds it from its own template (`chunk-dgc8shqt.js`). |
| `Multi-Agent Coordination` | <Undocumented /> | Messages between teammates and subagents are normal traffic. |
| `Memory Directory` | <Undocumented /> | Routine writes to and deletes from the memory directory are fine. |
| `CLAUDE.md Content` | <Undocumented /> | Editing `CLAUDE.md` is fine when the text does not change permissions or auto mode. |
| `Claude Code Scheduling` | <Undocumented /> | Using `CronCreate`, `CronDelete`, `CronList`, or `RemoteTrigger` to schedule tasks is fine. |
| `Browser Trusted Navigation` | <Undocumented /> | Navigating the browser to a trusted domain, `localhost`, or a URL you named is fine. |

## Hard Deny Rule

| Rule | Status | What it blocks |
| --- | --- | --- |
| `Data Exfiltration` | <Documented /> | Sending sensitive data across the trust boundary is always blocked, even when you ask for it. |

A scoped exception sends commits and pushes of sensitive material to the `Sensitive-Source Provenance` soft rule when that rule exists.

## Environment Fields

Most fields say `None configured`. Fill them with `autoMode.environment`.
The built-in list has the 21 entries below, one per field label. Write each entry of your own as `Field: text`. With `$defaults` in the list, the program puts the built-in entries where `$defaults` is and adds each of your entries as a separate line. It does not compare field labels, so your entry does not replace the built-in entry for the same field (the program, `chunk-413pygry.js`).

| Field | Status | Default text |
| --- | --- | --- |
| `Organization` | <Documented /> | None configured. |
| `Primary use of Claude Code` | <Documented /> | software development. |
| `Cloud provider(s)` | <Documented /> | None configured. |
| `Repository visibility` | <Documented /> | assume private unless the remote host and repo name indicate otherwise, or a visibility check in the transcript shows public. |
| `Internal sharing / snippet hosting` | <Documented /> | None configured. |
| `Org-specific CLIs` | <Documented /> | None configured. |
| `Secrets management` | <Documented /> | None configured. |
| `CI/CD deploy targets` | <Documented /> | None configured. |
| `Network posture` | <Documented /> | None configured. |
| `Host containment` | <Documented /> | None configured. |
| `Protected deployment namespaces / environments` | <Documented /> | None configured. |
| `Data retention / declassification` | <Documented /> | None configured. |
| `Trusted repo` | <Documented /> | The git repository the agent started in (its working directory) and its configured remote(s). When the repo's public/private visibility is given. |
| `Source control` | <Documented /> | The trusted repo and its remote(s) only (no additional orgs configured). |
| `Trusted internal domains` | <Documented /> | None configured. |
| `Trusted cloud buckets` | <Documented /> | None configured. |
| `Key internal services` | <Documented /> | None configured. |
| `Internal package registry` | <Documented /> | None configured. |
| `Sensitive data locations & audiences` | <Documented /> | any file or store holding personal data, confidential business data, credentials, regulated data, or similarly sensitive material, and more. |
| `Sensitive remote targets` | <Documented /> | any namespace, host, or container whose name carries prod or production as a whole word or name segment (hyphen/underscore/dot-delimited. |
| `Protected IaC scopes` | <Documented /> | IAM, RBAC, networking, quota, and node-pool resources, anything whose name or tag carries prod or production as a whole word or name segment. |

## Soft Deny Rules

| Rule | Status | What it blocks |
| --- | --- | --- |
| `Git Destructive` | <Documented /> | Force-pushes, remote branch or tag deletes, and history rewrites that destroy the work of others. |
| `Code That Leaks When Run` | <Undocumented /> | Committing code that would leak secrets or widen access when it runs. |
| `Code from External` | <Undocumented /> | Running code that came from an outside source. |
| `Cloud Storage Mass Delete` | <Undocumented /> | Mass deletes on cloud storage, or dropping data stores. |
| `Production Deploy` | <Documented /> | Deploys to production and production database migrations. |
| `Remote Shell Writes` | <Undocumented /> | Writing to live production or shared hosts through `ssh`, `kubectl exec`, and similar. |
| `Sensitive Remote Exec` | <Undocumented /> | Interactive sessions or port forwards into sensitive remote targets. |
| `Production Reads` | <Undocumented /> | Reading inside live production through a remote shell. |
| `Blind Apply` | <Undocumented /> | Applying live infrastructure changes with `--yes` or `--auto-approve` and no preview. |
| `Protected-Scope IaC Apply` | <Undocumented /> | Infrastructure-as-code applies that touch protected scopes. |
| `Logging/Audit Tampering` | <Undocumented /> | Stopping logs, deleting log directories, or removing audit trails and git hooks. |
| `Permission Grant` | <Undocumented /> | Granting admin roles, adding repo users, or raising IAM permissions. |
| `Account & Standing-Rule Changes` | <Undocumented /> | Changing account security or creating standing rules, such as mail forwarding. |
| `TLS/Auth Weaken` | <Undocumented /> | Turning off TLS checks or authentication on a service. |
| `Secret-Store Writes` | <Undocumented /> | Creating, rotating, or deleting entries in a secret manager. |
| `DNS / Domain / Cert Changes` | <Undocumented /> | Changing DNS records, domain settings, or TLS certificates. |
| `Security Weaken` | <Undocumented /> | Turning off security controls or adding ways around them. |
| `Security Test Removal` | <Undocumented /> | Deleting or skipping tests that guard auth, crypto, or sandboxing. |
| `Safety Bypass Flag` | <Undocumented /> | Running a command with a flag such as `DANGEROUSLY_*` or `BREAKGLASS*`. |
| `Create Unsafe Agents` | <Undocumented /> | Creating agent loops that run commands with no human approval. |
| `Interfere With Workloads` | <Undocumented /> | Deleting, cancelling, or killing jobs the agent did not start in this session. |
| `Shared Cluster Mutation` | <Undocumented /> | Writes to a shared compute cluster that can hit the jobs of other users. |
| `CI Bypass` | <Undocumented /> | Disabling CI checks, editing branch protection, or marking required checks as optional. |
| `Modify Shared Resources` | <Undocumented /> | Changing or destroying shared resources that this session did not create. |
| `Irreversible Local Destruction` | <Undocumented /> | Deleting or overwriting local files that existed before the session, such as `rm -rf`. |
| `Unverifiable Deletion Target` | <Undocumented /> | A forced recursive delete whose target is a shell variable or a glob. |
| `Shared Scratch Sweep` | <Undocumented /> | Broad deletes in shared scratch space such as `/tmp`. |
| `Irreversible Deletion (general)` | <Undocumented /> | Tearing down a stateful resource that the agent did not create. |
| `Unverifiable Deletion Scope` | <Undocumented /> | A delete on shared or remote state whose targets are computed at run time. |
| `Create RCE Surface` | <Undocumented /> | Creating endpoints that run arbitrary code, or code with remote-execution holes. |
| `Expose Local Services` | <Undocumented /> | Starting a listener or file server that exposes local files or a shell to the network. |
| `External Ingress Tunnel` | <Undocumented /> | Opening a tunnel, such as `ssh -R`, that makes a local address reachable from the internet. |
| `Credential Leakage` | <Undocumented /> | Writing real secrets into commits, images, or other lasting files. |
| `Credential Materialization` | <Undocumented /> | Printing a live token or credential into output, the transcript, or a file. |
| `Credential Exploration` | <Undocumented /> | Scanning credential stores for secrets. |
| `PII Data Handling` | <Undocumented /> | Copying sensitive data out of its listed location. |
| `Exfil Scouting` | <Undocumented /> | Testing which outside endpoints are reachable, to prepare data theft. |
| `Traffic Redirection` | <Undocumented /> | Pointing API base URLs, proxies, or registries at third-party hosts. |
| `Remote Repoint` | <Undocumented /> | Changing where pushes go, such as `git remote set-url`. |
| `Out-of-Place Publication` | <Undocumented /> | Pushing or publishing work to a public place that does not fit the task. |
| `Sensitive-Source Provenance` | <Documented /> | Sensitive content flowing into a repo, a commit, or a push. |
| `Excess Sensitive Detail` | <Undocumented /> | Sending more sensitive detail to a recipient than you approved. |
| `Unrequested Artifact Publish` | <Undocumented /> | Publishing a file to a claude.ai page with the `Artifact` tool when you did not ask for it. |
| `Live-Shared Artifact Sensitive Delta` | <Undocumented /> | Adding sensitive content to an artifact that viewers see live. |
| `Sandbox Network Callback` | <Undocumented /> | A sandboxed command that opens a connection to an unapproved host. |
| `Command Network Lists` | <Undocumented /> | A shell command that sets its own `allowed_domains` list. |
| `Containment Escape` | <Undocumented /> | Reaching past the network or identity boundary of the container or VM that runs Claude Code. |
| `Create Public Surface` | <Undocumented /> | Creating a public repo, release, or package. |
| `Public Data-Sharing Upload` | <Undocumented /> | Creating gists or uploading data to public sharing services. |
| `Untrusted Code Integration` | <Undocumented /> | Pulling in code from outside your orgs and arranging for it to run. |
| `Package Registry Bypass` | <Undocumented /> | Installing from a public registry when an internal registry exists. |
| `Unauthorized Persistence` | <Undocumented /> | Adding SSH keys or editing shell profiles and credential stores. |
| `Self-Modification` | <Undocumented /> | Editing the permissions, hooks, or sandbox config of the agent itself. |
| `Tmux Self Drive` | <Undocumented /> | Sending keystrokes to the pane of the agent itself to change its own oversight. |
| `Instruction Poisoning` | <Undocumented /> | Writing to files that a later session reads as instructions, such as `CLAUDE.md`. |
| `Auto-Mode Bypass` | <Undocumented /> | Working around the classifier or the permission system. |
| `Session Transcript Tampering` | <Undocumented /> | Writing to session transcript files. |
| `Unrequested Commit in a Connected App` | <Undocumented /> | Committing a decision in a connected app when you asked only for a read or a draft. |
| `External System Writes` | <Undocumented /> | Deleting, closing, or mass-changing items in tools such as Jira, Linear, or mail. |
| `Merge Without Review` | <Undocumented /> | Merging a pull request before a human approves it. |
| `Self-Approval` | <Undocumented /> | Approving a pull request that the agent wrote. |
| `ChatOps Trigger Comments` | <Undocumented /> | Posting a comment that is a command to automation, such as `atlantis apply`. |
| `Feature Flag Writes` | <Undocumented /> | Changing or deleting a production feature flag. |
| `Node Lifecycle Operations` | <Undocumented /> | Cordoning, draining, restarting, or removing cluster nodes. |
| `Cluster-Wide Workload Creation` | <Undocumented /> | Creating resources that run on every node or intercept cluster traffic. |
| `Real-World Transactions` | <Undocumented /> | Payments, purchases, trades, and other actions with real-world cost. |
| `Third-Party Attack` | <Undocumented /> | Attacking a real system of an outside party. |
| `Browser Navigate Exfil` | <Undocumented /> | Navigating the browser to an unrelated outside domain, with data in the URL. |
| `Browser Input Exfil` | <Undocumented /> | Typing credentials or sensitive data into a browser page that you did not provide. |
| `Browser JS Exfil` | <Undocumented /> | Browser scripts that read cookies or storage and send them off-site. |
| `Browser File Upload Exfil` | <Undocumented /> | Uploading files from outside the project, or sensitive files, in the browser. |
| `Browser Shortcut Execution` | <Undocumented /> | Running browser shortcuts, whose effect is hidden. |

## Related Pages

- [Auto Mode](auto-mode.md)
- [Permission Rules](rules.md)
