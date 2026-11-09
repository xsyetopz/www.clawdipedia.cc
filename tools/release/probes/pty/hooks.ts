import { show } from "../print/run/helpers.ts";
// Hook probes in the interactive screen (ported from p305-pty case.sh, pc.sh, settings-h3/np1/t10 and hook.sh).
// PermissionRequest, PermissionDenied, Notification, PreCompact and Elicitation do not fire in -p, so they need the pty.
import {
	ASK,
	ELICIT_MCP,
	ESC,
	hooks,
	keysOf,
	pre,
	type PtyCase,
	type PtyGroup,
	ranFile,
	READY,
	round,
	shows,
	toolNames,
	TOUCH,
	WAIT,
} from "./harness.ts";
import { deniedCase, permissionRequest, PR_CASES } from "./hooks/permission.ts";

const notification = (cont: boolean): PtyCase => ({
	id: `hooks.notification.${cont ? "continue-false" : "permission-prompt"}`,
	settings: hooks(["Notification", "PermissionRequest"]),
	stub: TOUCH("ran-notif"),
	...(cont
		? {
				ctl: {
					Notification: {
						out: JSON.stringify({
							continue: false,
							systemMessage: "NOTIF-SYSMSG",
						}),
					},
				},
			}
		: {}),
	schedule: [
		READY,
		ASK(),
		WAIT("proceed?", "dialog"),
		cont ? { t: 14, send: "\r", label: "accept" } : ESC(14),
	],
	secs: 17,
	facts: ["hooks.notification"],
	notes: cont
		? "Notification reply continue:false plus systemMessage; the dialog is accepted after the hook ran."
		: "The dialog is held open for about 12 s, then cancelled.",
	samples: (x) => {
		const first = x.hook("Notification")[0];
		const pr = x.hook("PermissionRequest")[0];
		return {
			delaySinceRequestS: first && pr ? String(round(first.t - pr.t, 2)) : "",
		};
	},
	data: (x) => {
		const n = x.hook("Notification");
		const pr = x.hook("PermissionRequest")[0];
		const first = n[0];
		return {
			...pre(n.length > 0, "Notification hook never fired"),
			fired: n.length,
			inputKeys: keysOf(first?.json ?? {}),
			notificationType: show(first?.json["notification_type"] ?? ""),
			message: show(first?.json["message"] ?? ""),
			delayBucketS: first && pr ? round(first.t - pr.t, 0) : null,
			toolRan: ranFile(x, "ran-notif"),
			sysMsgShown: shows(x, "NOTIF-SYSMSG"),
		};
	},
});

const PRECOMPACT: { name: string; ctl?: { out?: string; exit?: number } }[] = [
	{
		name: "sysmsg",
		ctl: { out: JSON.stringify({ systemMessage: "PRECOMPACT-SYSMSG" }) },
	},
	{
		name: "block",
		ctl: { out: JSON.stringify({ decision: "block", reason: "PC-BLOCK" }) },
	},
	{ name: "exit2", ctl: { exit: 2 } },
];
const preCompact = (p: (typeof PRECOMPACT)[number]): PtyCase => ({
	id: `hooks.precompact.${p.name}`,
	settings: hooks(["PreCompact", "PostCompact"]),
	...(p.ctl ? { ctl: { PreCompact: p.ctl } } : {}),
	schedule: [
		READY,
		ASK("p1"),
		ASK("p2", 6),
		{ t: 12, send: "/compact\r", label: "compact" },
	],
	secs: 22,
	facts: ["hooks.precompact"],
	notes:
		"Two standard prompts, then the /compact slash command (a command, not a model prompt).",
	data: (x) => {
		const pc = x.hook("PreCompact");
		const first = pc[0]?.json ?? {};
		return {
			...pre(pc.length > 0, "PreCompact hook never fired"),
			fired: pc.length,
			inputKeys: keysOf(first),
			trigger: show(first["trigger"] ?? ""),
			postCompactFired: x.hook("PostCompact").length,
			postCompactKeys: keysOf(x.hook("PostCompact")[0]?.json ?? {}),
			blockedLine: shows(x, "Compaction blocked by PreCompact hook"),
			blockReasonShown: shows(x, "PC-BLOCK"),
			sysMsgShown: shows(x, "PRECOMPACT-SYSMSG"),
			notEnoughMessages: shows(x, "Not enough messages to compact"),
		};
	},
});

const elicitHook: PtyCase = {
	id: "hooks.elicitation.hook-accept",
	settings: {
		...hooks(["Elicitation", "ElicitationResult", "Notification"]),
		enableAllProjectMcpServers: true,
		permissions: { allow: ["mcp__probe"] },
	},
	projFiles: ELICIT_MCP,
	env: { ENABLE_TOOL_SEARCH: "false" },
	stub: { seq: [{ name: "mcp__probe__ask", input: {} }] },
	ctl: {
		Elicitation: {
			out: JSON.stringify({
				hookSpecificOutput: {
					hookEventName: "Elicitation",
					action: "accept",
					content: { color: "red" },
				},
			}),
		},
	},
	schedule: [READY, ASK("prompt", 6)],
	secs: 18,
	facts: ["hooks.elicitation"],
	notes:
		"A local MCP server asks a form question; the Elicitation hook answers accept, so no dialog opens.",
	data: (x) => {
		const e = x.hook("Elicitation");
		const first = e[0]?.json ?? {};
		const mcp = x.file("mcp.log");
		return {
			...pre(e.length > 0, "Elicitation hook never fired (MCP server up?)"),
			fired: e.length,
			inputKeys: keysOf(first),
			mcpServer: show(first["mcp_server_name"] ?? ""),
			mode: show(first["mode"] ?? ""),
			dialogShown: shows(x, "PROBE-ELICIT"),
			elicitationResultFired: x.hook("ElicitationResult").length,
			mcpToolsInRequests: [
				...new Set(
					x.messages.flatMap((q) =>
						toolNames(q).filter((n) => n.startsWith("mcp__")),
					),
				),
			].toSorted(),
			toolSearchInRequests: x.messages.some((q) =>
				toolNames(q).includes("ToolSearch"),
			),
			serverStarted: mcp.includes('"method":"initialize"'),
			serverGotAccept: mcp.includes('"action":"accept"'),
			serverGotRed: mcp
				.split("elicitation/create")
				.slice(1)
				.join("")
				.includes("red"),
			notificationTypes: [
				...new Set(
					x
						.hook("Notification")
						.map((n) => show(n.json["notification_type"] ?? "")),
				),
			].toSorted(),
		};
	},
};

export const hooksGroup: PtyGroup = {
	id: "hooks",
	title:
		"PermissionRequest, PermissionDenied, Notification, PreCompact, Elicitation",
	cases: () => [
		...PR_CASES.map((c) => permissionRequest(c)),
		deniedCase(false),
		deniedCase(true),
		notification(false),
		notification(true),
		...PRECOMPACT.map((c) => preCompact(c)),
		elicitHook,
	],
};
