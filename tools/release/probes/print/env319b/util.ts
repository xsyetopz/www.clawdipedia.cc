import type { Run } from "../run/helpers.ts";

// Same override as err319: the memory sync needs the traffic switches off. The base URL is still the local stub.
export const GB_ON = {
	DISABLE_TELEMETRY: "",
	CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "",
};
export const DBG = ["--debug-file", "{CFG}/d.log"];

export const lines = (s: string, re: RegExp, n = 6): string =>
	s
		.split("\n")
		.filter((l) => re.test(l))
		.slice(0, n)
		.map((l) => l.slice(0, 220))
		.join("\n");

export const USER = JSON.stringify({
	type: "user",
	message: { role: "user", content: "Reply with 'OK'." },
});

export const b64u = (o: unknown): string =>
	Buffer.from(JSON.stringify(o)).toString("base64url");
export const secret = `${b64u({ alg: "none" })}.${b64u({ "ccr:pool_id": "ccpool_probe" })}.sig`;

export const readOrNull = async (path: string): Promise<string | null> => {
	const f = Bun.file(path);
	return (await f.exists()) ? f.text() : null;
};

export const uniquePaths = (r: Run, trimQuery: boolean): string =>
	[
		...new Set(r.reqs.map((q) => (trimQuery ? q.path.split("?")[0] : q.path))),
	].join(" ");
