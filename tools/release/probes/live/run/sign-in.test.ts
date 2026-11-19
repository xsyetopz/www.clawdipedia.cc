import { describe, expect, test } from "bun:test";

import { checkSignIn, type ProfileFetch } from "./sign-in.ts";

const answer =
	(status: number): ProfileFetch =>
	() =>
		Promise.resolve(new Response("{}", { status }));

/** The message of the error the check throws, or "" when it passes. */
const failure = async (token: string, get: ProfileFetch): Promise<string> => {
	try {
		await checkSignIn(token, get);
		return "";
	} catch (error) {
		return error instanceof Error ? error.message : String(error);
	}
};

const down: ProfileFetch = () => Promise.reject(new TypeError("offline"));

describe("checkSignIn", () => {
	test("an accepted token passes", async () => {
		expect(await failure("tok", answer(200))).toBe("");
	});

	test("a refused token stops the run and names the fix, not the token", async () => {
		const message = await failure("sk-secret-token", answer(401));
		expect(message).toMatch(
			/refused the login \(HTTP 401\); refresh CLAUDE_CODE_OAUTH_TOKEN/u,
		);
		expect(message).not.toContain("sk-secret-token");
	});

	test("a server error stops the run with its status", async () => {
		expect(await failure("tok", answer(500))).toMatch(/answered HTTP 500/u);
	});

	test("a failed request stops the run", async () => {
		expect(await failure("tok", down)).toMatch(/no answer/u);
	});

	test("sends the token as a bearer header to the profile endpoint", async () => {
		let seen: { url: string; auth: string | null } | undefined;
		const spy: ProfileFetch = (url, init) => {
			seen = { url, auth: new Headers(init.headers).get("Authorization") };
			return Promise.resolve(new Response("{}", { status: 200 }));
		};
		await checkSignIn("tok", spy);
		expect(seen).toEqual({
			url: "https://api.anthropic.com/api/oauth/profile",
			auth: "Bearer tok",
		});
	});
});
