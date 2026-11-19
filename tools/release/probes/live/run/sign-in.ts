// The program checks a token with GET /api/oauth/profile (`TA`, chunk-xethrx83.js:324748 in 2.1.328).
// A live run makes the same request first: with a refused login every case gets HTTP 401 from the
// server, and the cases would still record results that look valid.
const PROFILE_URL = "https://api.anthropic.com/api/oauth/profile";
const TIMEOUT_MS = 10_000;

/** A fetch with the signature the check needs; tests pass a fake. */
export type ProfileFetch = (
	url: string,
	init: RequestInit,
) => Promise<Response>;

/** Throws unless the server accepts the token. The message names the status only, never the token. */
export const checkSignIn = async (
	token: string,
	get: ProfileFetch = fetch,
): Promise<void> => {
	let status: number;
	try {
		const res = await get(PROFILE_URL, {
			headers: {
				Authorization: `Bearer ${token}`,
				"Content-Type": "application/json",
				"Cache-Control": "no-cache",
			},
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		status = res.status;
	} catch (error) {
		throw new Error(`sign-in check: no answer from ${PROFILE_URL}`, {
			cause: error,
		});
	}
	if (status === 401 || status === 403) {
		throw new Error(
			`sign-in check: the server refused the login (HTTP ${status}); refresh CLAUDE_CODE_OAUTH_TOKEN in .env, for example with "claude setup-token"`,
		);
	}
	if (status < 200 || status >= 300) {
		throw new Error(`sign-in check: ${PROFILE_URL} answered HTTP ${status}`);
	}
};
