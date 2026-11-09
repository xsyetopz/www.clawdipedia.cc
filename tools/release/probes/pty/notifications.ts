import { show } from "../print/run/helpers.ts";
// Notification types reachable offline (ported from p305-pty settings-t10/np1 and mcp-elicit.ts).
// permission_prompt is covered by hooks.notification.*. worker_permission_prompt needs an out-of-process teammate: skipped.
import {
	ASK,
	ELICIT_MCP,
	ESC,
	hooks,
	obj,
	pre,
	type PtyCase,
	type PtyGroup,
	type PtyRun,
	READY,
	round,
	shows,
	TOUCH,
	WAIT,
	waitAny,
} from "./harness.ts";

const MCP_SETTINGS = {
	...hooks(["Notification", "Elicitation", "ElicitationResult"]),
	enableAllProjectMcpServers: true,
	permissions: { allow: ["mcp__probe"] },
};

const types = (x: PtyRun): string[] =>
	[
		...new Set(
			x
				.hook("Notification")
				.map((n) => show(n.json["notification_type"] ?? "")),
		),
	].toSorted();
const messageOf = (x: PtyRun, type: string): string =>
	show(
		x.hook("Notification").find((n) => n.json["notification_type"] === type)
			?.json["message"] ?? "",
	);

const elicitationDialog: PtyCase = {
	id: "notifications.elicitation-dialog",
	settings: MCP_SETTINGS,
	projFiles: ELICIT_MCP,
	env: { ENABLE_TOOL_SEARCH: "false" },
	stub: { seq: [{ name: "mcp__probe__ask", input: {} }] },
	schedule: [
		READY,
		ASK("prompt", 6),
		WAIT("PROBE-ELICIT", "dialog"),
		ESC(18, "cancel"),
	],
	secs: 21,
	facts: ["notifications.types"],
	notes:
		"Form elicitation with no hook answer: the dialog opens, then is cancelled.",
	data: (x) => {
		const t = types(x);
		const res = x.hook("ElicitationResult")[0]?.json ?? {};
		return {
			...pre(x.hook("Elicitation").length > 0, "Elicitation hook never fired"),
			notificationTypes: t,
			dialogMessage: messageOf(x, "elicitation_dialog"),
			responseMessage: messageOf(x, "elicitation_response"),
			resultAction: show(res["action"] ?? ""),
		};
	},
};

const elicitationUrl: PtyCase = {
	id: "notifications.elicitation-url",
	settings: MCP_SETTINGS,
	projFiles: ELICIT_MCP,
	env: { ENABLE_TOOL_SEARCH: "false" },
	stub: { seq: [{ name: "mcp__probe__askurl", input: {} }] },
	schedule: [
		READY,
		ASK("prompt", 6),
		WAIT("PROBE-URL", "dialog"),
		{ t: 18, send: "\r", label: "accept" },
	],
	secs: 24,
	facts: ["notifications.types"],
	notes:
		"URL-mode elicitation; the first option is chosen with Enter after the 6 s notification delay.",
	data: (x) => ({
		...pre(x.hook("Elicitation").length > 0, "Elicitation hook never fired"),
		notificationTypes: types(x),
		urlDialogMessage: messageOf(x, "elicitation_url_dialog"),
		responseMessage: messageOf(x, "elicitation_response"),
		completeMessage: messageOf(x, "elicitation_complete"),
		elicitationMode: show(x.hook("Elicitation")[0]?.json["mode"] ?? ""),
	}),
};

const idle: PtyCase = {
	id: "notifications.idle-prompt",
	settings: hooks(["Notification"]),
	schedule: [READY, ASK("prompt")],
	secs: 85,
	facts: ["notifications.types"],
	notes:
		"One reply, then idle. Records how long after the prompt idle_prompt fires.",
	data: (x) => {
		const n = x
			.hook("Notification")
			.find((k) => k.json["notification_type"] === "idle_prompt");
		const p = x.pty.sent.find((s) => s.label === "prompt")?.t;
		return {
			...pre(n !== undefined, "idle_prompt never fired within 85 s"),
			notificationTypes: types(x),
			message: messageOf(x, "idle_prompt"),
			// nearest 5 s: the exact delay drifts a little from run to run
			secondsAfterPrompt:
				n !== undefined && p !== undefined
					? Math.round((n.t - p) / 5) * 5
					: null,
		};
	},
	samples: (x) => {
		const n = x
			.hook("Notification")
			.find((k) => k.json["notification_type"] === "idle_prompt");
		const p = x.pty.sent.find((s) => s.label === "prompt")?.t;
		return {
			secondsAfterPromptRaw:
				n !== undefined && p !== undefined ? String(round(n.t - p, 1)) : "",
		};
	},
};

const autoMode: PtyCase = {
	id: "notifications.agent-needs-input",
	mode: "auto",
	settings: { ...hooks(["Notification"]), skipAutoPermissionPrompt: true },
	stub: TOUCH("ran-an", "curl -s http://127.0.0.1:9/x"),
	// 2.1.316 shows the billing notice where 2.1.319 shows "can't check actions"
	schedule: [
		READY,
		ASK(),
		waitAny(["can't check actions", "no longer charge"], "dialog"),
		ESC(14),
	],
	secs: 16,
	facts: ["notifications.types"],
	notes: `Auto mode with a custom base URL that does not pass the server-side check through: the dialog ("Auto mode can't check actions in this session", or the classifier billing notice) fires agent_needs_input.`,
	data: (x) => ({
		...pre(
			x.hook("Notification").length > 0,
			"no Notification hook fired in auto mode",
		),
		notificationTypes: types(x),
		message: messageOf(x, "agent_needs_input"),
	}),
};

const autoModeRefused: PtyCase = {
	...autoMode,
	id: "notifications.agent-needs-input-refused",
	args: ["--debug-file", "{HOME}/debug.log"],
	stub: { ...autoMode.stub, refuseServerCheck: true },
	schedule: [
		READY,
		ASK(),
		waitAny(["can't check actions", "no longer charge"], "dialog"),
		ESC(14),
	],
	notes:
		"Auto mode with a custom base URL that answers HTTP 400 to the dangerous-tool-use beta: which dialog the program shows, and what it logs about the server-side check.",
	data: (x) => ({
		...autoMode.data?.(x),
		serverClassifierLog: x
			.file("debug.log")
			.split("\n")
			.filter((l) => l.includes("[server-classifier]"))
			.map((l) => l.replace(/^\S+ /u, "").slice(0, 400)),
	}),
};

const autoModeLocal: PtyCase = {
	...autoMode,
	id: "notifications.auto-mode-local",
	env: { CLAUDE_CODE_AUTO_MODE_SERVER: "0" },
	schedule: [READY, ASK(), WAIT("usable answer", "outcome"), ESC(14)],
	notes:
		"Auto mode with a custom base URL and CLAUDE_CODE_AUTO_MODE_SERVER=0: the program sends its own classifier requests, and the stub gives them no usable answer.",
	data: (x) => ({
		notificationTypes: types(x),
		billingNotice: shows(x, "no longer charge"),
		serverCheckRequested: x.messages.some(
			(q) => obj(q.body)["safeguards"] !== undefined,
		),
	}),
};

export const notificationsGroup: PtyGroup = {
	id: "notifications",
	title: "notification types seen in the interactive screen",
	cases: () => [
		elicitationDialog,
		elicitationUrl,
		autoMode,
		autoModeRefused,
		autoModeLocal,
		idle,
	],
};
