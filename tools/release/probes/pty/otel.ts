// OpenTelemetry events that only the interactive session sends. Each case runs the print-mode collector as a mock,
// reports whether each target event arrived, and keeps the key paths and types of its events as `<case>.fields.json`
// (value-free, the format of the schema audit's --raw files).
import {
	otelPaths,
	startOtelMock,
} from "../../../schemas/observe/print/otel-mock.ts";
import type { PtyStep } from "../../lib/pty/driver.ts";
import {
	type Data,
	pre,
	type PtyCase,
	type PtyGroup,
	READY,
} from "./harness.ts";

const otelCase = (
	c: Omit<PtyCase, "data" | "artifacts" | "mock"> & { roots: string[] },
): PtyCase => ({
	...c,
	mock: startOtelMock,
	data: () => {
		const got = otelPaths(c.roots);
		return {
			...pre(
				c.roots.some((r) => r in got),
				"the collector received none of the target events",
			),
			...Object.fromEntries(
				c.roots.map((r): [string, Data] => [r, r in got ? "sent" : "absent"]),
			),
		};
	},
	artifacts: () => ({
		"fields.json": `${JSON.stringify(otelPaths(c.roots), null, 2)}\n`,
	}),
});

const type = (text: string, label: string, t = 0): PtyStep => ({
	t,
	send: `${text}\r`,
	label,
});

// /logout logs the auth event before it clears the login (chunk-qs1tec98.js:22731), then the program exits.
const authLogout = (): PtyCase =>
	otelCase({
		id: "otel.auth-logout",
		schedule: [READY, type("/logout", "logout", 1)],
		secs: 20,
		notes:
			"/logout in a sandbox with no stored login; the program exits after it.",
		roots: ["event:auth"],
	});

// CLAUDE_FORCE_DISPLAY_SURVEY opens the survey at the start of the session (chunk-cfxefa64.js:1149399), and
// CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL lets it open with telemetry on (chunk-asj6f58y.js:901002).
const feedbackSurvey = (): PtyCase =>
	otelCase({
		id: "otel.feedback-survey",
		env: {
			CLAUDE_FORCE_DISPLAY_SURVEY: "1",
			CLAUDE_CODE_ENABLE_FEEDBACK_SURVEY_FOR_OTEL: "1",
		},
		schedule: [
			READY,
			{ t: 5, send: "3", label: "answer" },
			{ t: 10, label: "settle" },
		],
		secs: 60,
		notes:
			"Forces the session survey, which opens before any prompt, answers it with 3 (Good) 5 s after the start, then waits 10 s.",
		roots: ["event:feedback_survey"],
	});

const MARKET = {
	name: "probe-market",
	owner: { name: "probe" },
	plugins: [
		{
			name: "probe",
			source: "./probe",
			version: "1.0.0",
			description: "Probe plugin.",
		},
	],
};

// A plugin from a local directory marketplace that the settings name; /plugin install logs plugin_installed with
// the ui trigger (chunk-m14bt1pz.js:5317169).
const pluginInstalled = (): PtyCase =>
	otelCase({
		id: "otel.plugin-installed",
		projFiles: {
			"mkt/.claude-plugin/marketplace.json": JSON.stringify(MARKET),
			"mkt/probe/.claude-plugin/plugin.json": JSON.stringify({
				name: "probe",
				version: "1.0.0",
				description: "Probe plugin.",
			}),
		},
		settings: {
			extraKnownMarketplaces: {
				"probe-market": { source: { source: "directory", path: "{PROJ}/mkt" } },
			},
		},
		schedule: [
			READY,
			type("/plugin install probe@probe-market", "install", 1),
			{ t: 25, label: "settle" },
		],
		secs: 40,
		notes:
			"Installs a plugin from a local directory marketplace with /plugin install.",
		roots: ["event:plugin_installed"],
	});

/** PTY cases for OpenTelemetry events that print mode never sends. */
export const otelGroup: PtyGroup = {
	id: "otel",
	title: "telemetry events that only the interactive session sends",
	cases: () => [authLogout(), feedbackSurvey(), pluginInstalled()],
};
