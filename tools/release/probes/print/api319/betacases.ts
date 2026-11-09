import type { CaseDef } from "../run/helpers.ts";
import { betaCase, FIRST_PARTY } from "./beta.ts";

const PROMPT_TOOL = ["--permission-prompt-tool", "mcp__psrv__ping"];
const SKILLS = {
	CLAUDE_CODE_REMOTE_ENVIRONMENT_TYPE: "probe",
	CLAUDE_CODE_SYNC_SKILLS: "1",
};
// Tool search off lists the deferred tools (ExitPlanMode) in the request, so the list shows the gate directly.
const DIRECT = { ENABLE_TOOL_SEARCH: "false" };
const TEAMS = { CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS: "1" };
const DENY = { permissions: { denyInsteadOfPrompting: true } };
const TEAMMATE = [
	"--agent-id",
	"probe@team",
	"--agent-name",
	"probe",
	"--team-name",
	"team",
];
const UC = { CLAUDE_CODE_PROGRAM_USE_CASE_ID: "probe-use-case" };

// A remote session profile, the first of the two tests that list the enable stubs. The second needs host launch options that no env var sets.
const PROFILE = {
	...DIRECT,
	CCR_SESSION_PROFILE: "1",
	SESSION_INGRESS_URL: "https://ingress.probe.invalid",
	CLAUDE_CODE_REMOTE_SESSION_ID: "cse_probe",
};

const POSSUM = { tengu_federated_possum: true };
const THUNDER = { tengu_merry_thunder: true };
const TRELLIS = { tengu_amber_trellis: true };

const betas: CaseDef[] = [
	betaCase("beta.plain", {}),
	betaCase("beta.plain-mcp", { mcp: true }),
	betaCase("beta.first-party", { env: FIRST_PARTY }),
	betaCase("beta.first-party-mcp", { env: FIRST_PARTY, mcp: true }),
	betaCase("beta.use-case-id", { env: { ...FIRST_PARTY, ...UC } }),
	betaCase("beta.use-case-id-flag", {
		env: { ...FIRST_PARTY, ...UC },
		gb: POSSUM,
	}),
	betaCase("beta.use-case-id-flag-no-first-party", { env: UC, gb: POSSUM }),
	betaCase("beta.first-party-experimental-off", {
		env: {
			...FIRST_PARTY,
			...UC,
			CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1",
		},
		gb: POSSUM,
		mcp: true,
	}),
	betaCase("beta.provenance.fake-key", { env: FIRST_PARTY, mcp: true }),
	betaCase("beta.side-query.title", { env: FIRST_PARTY, title: true }),
	betaCase("beta.side-query.title-no-first-party", { title: true }),
	betaCase("beta.side-query.title-experimental-off", {
		env: { ...FIRST_PARTY, CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS: "1" },
		title: true,
	}),
	betaCase("tool.wrap-up.off", {}),
	betaCase("tool.wrap-up.env", { env: { CLAUDE_CODE_ENABLE_WRAP_UP: "1" } }),
	betaCase("tool.wrap-up.env-flag", {
		env: { CLAUDE_CODE_ENABLE_WRAP_UP: "1" },
		gb: THUNDER,
	}),
	betaCase("tool.wrap-up.flag-only", { gb: THUNDER }),
];

const exitPlan: CaseDef[] = [
	betaCase("tool.exit-plan.print", {}),
	betaCase("tool.exit-plan.prompt-tool", { args: PROMPT_TOOL, mcp: true }),
	betaCase("tool.exit-plan.plan-mode", {
		args: [...PROMPT_TOOL, "--permission-mode", "plan"],
		mcp: true,
	}),
	betaCase("tool.exit-plan.prompt-tool-deny", {
		args: PROMPT_TOOL,
		mcp: true,
		user: { permissions: { denyInsteadOfPrompting: true } },
	}),
	betaCase("tool.exit-plan.plan-mode-deny", {
		args: [...PROMPT_TOOL, "--permission-mode", "plan"],
		mcp: true,
		user: { permissions: { denyInsteadOfPrompting: true } },
	}),
	betaCase("tool.exit-plan.direct", {
		env: DIRECT,
		args: PROMPT_TOOL,
		mcp: true,
	}),
	betaCase("tool.exit-plan.direct-deny", {
		env: DIRECT,
		args: PROMPT_TOOL,
		mcp: true,
		user: DENY,
	}),
	betaCase("tool.exit-plan.direct-no-prompt-tool", { env: DIRECT }),
	betaCase("tool.exit-plan.teams-env-deny", {
		env: { ...DIRECT, ...TEAMS },
		args: PROMPT_TOOL,
		mcp: true,
		user: DENY,
	}),
	betaCase("tool.exit-plan.teammate", {
		env: { ...DIRECT, ...TEAMS },
		args: [...PROMPT_TOOL, ...TEAMMATE],
		mcp: true,
	}),
	betaCase("tool.exit-plan.teammate-deny", {
		env: { ...DIRECT, ...TEAMS },
		args: [...PROMPT_TOOL, ...TEAMMATE],
		mcp: true,
		user: DENY,
	}),
	betaCase("tool.exit-plan.teammate-no-prompt-tool", {
		env: { ...DIRECT, ...TEAMS },
		args: TEAMMATE,
	}),
];

const skills: CaseDef[] = [
	betaCase("tool.propose-skills.cowork", {
		env: { ...SKILLS, CLAUDE_CODE_ENTRYPOINT: "remote_cowork" },
	}),
	betaCase("tool.propose-skills.trigger", {
		env: { ...SKILLS, CLAUDE_CODE_ENTRYPOINT: "remote_cowork_trigger" },
	}),
	betaCase("tool.propose-skills.trigger-chat", {
		env: {
			...SKILLS,
			CLAUDE_CODE_ENTRYPOINT: "remote_cowork_trigger",
			CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat",
		},
	}),
	betaCase("tool.propose-skills.chat-only", {
		env: { ...SKILLS, CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat" },
	}),
	betaCase("tool.enable-stubs.direct", { env: DIRECT }),
	betaCase("tool.enable-stubs.profile", { env: PROFILE }),
	betaCase("tool.enable-stubs.profile-bad-id", {
		env: { ...PROFILE, CLAUDE_CODE_REMOTE_SESSION_ID: "session_probe" },
	}),
	betaCase("tool.enable-stubs.profile-http-ingress", {
		env: { ...PROFILE, SESSION_INGRESS_URL: "http://ingress.probe.invalid" },
	}),
	betaCase("tool.enable-stubs.chat-flag", {
		env: { ...DIRECT, CLAUDE_CODE_SESSION_ORIGIN: "claude_ai_chat" },
		gb: { tengu_merry_tide: true },
	}),
];

export const widgetCases: CaseDef[] = [
	betaCase("tool.widget.off", {}),
	betaCase("tool.widget.remote-flag", {
		env: { CLAUDE_CODE_REMOTE: "1" },
		gb: TRELLIS,
	}),
];

export const betaCases: CaseDef[] = [...betas, ...exitPlan, ...skills];
