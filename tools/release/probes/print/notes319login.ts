// Shared fake login for the notes319 probes.
import { FAKE_KEY } from "../../lib/env.ts";
import { json } from "./run/helpers.ts";

export const FIRST_PARTY = { _CLAUDE_CODE_ASSUME_FIRST_PARTY_BASE_URL: "1" };
export const REFRESH_END = Date.UTC(2030, 0, 15, 12);
const ACCESS_END = Date.UTC(2030, 0, 1);

export const login = (o: Record<string, unknown> = {}, tier = "max") =>
	json({
		claudeAiOauth: {
			accessToken: FAKE_KEY,
			refreshToken: "sk-ant-ort01-fake",
			expiresAt: ACCESS_END,
			refreshTokenExpiresAt: REFRESH_END,
			scopes: ["user:inference", "user:profile"],
			subscriptionType: tier,
			...o,
		},
	});
