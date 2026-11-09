import { asRecord } from "../../lib/stub/replies.ts";

export type Step = (name: string, ok: boolean, detail?: string) => void;

export const throws = (f: () => unknown): boolean => {
	try {
		f();
		return false;
	} catch {
		return true;
	}
};

export const rejects = async (f: () => Promise<unknown>): Promise<boolean> => {
	try {
		await f();
		return false;
	} catch {
		return true;
	}
};

/** POST with a JSON body; a string body goes out as it is. */
export const post = (
	url: string,
	body: unknown,
	headers: Record<string, string> = {},
): Promise<Response> =>
	fetch(url, {
		method: "POST",
		headers,
		body: typeof body === "string" ? body : JSON.stringify(body),
	});

export const jsonOf = async (r: Response): Promise<Record<string, unknown>> =>
	asRecord(await r.json());
