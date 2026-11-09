import { allocPort } from "../../../lib/ports.ts";
import {
	type LoggedRequest,
	readLog,
	startStub,
	type Stub,
} from "../../../lib/stub.ts";
import { pathExists } from "./files.ts";

let stubP: Promise<Stub> | null = null;
const startOnFreePort = async (): Promise<Stub> => startStub(await allocPort());
export const getStub = (): Promise<Stub> => {
	stubP ??= startOnFreePort();
	return stubP;
};
/** Stops the stub; returns requests that reached it without a registered case id. */
export const stopStub = async (): Promise<LoggedRequest[]> => {
	const p = stubP;
	stubP = null;
	if (p === null) {
		return [];
	}
	const stub = await p;
	return stub.stop();
};

export const readRequests = async (log: string): Promise<LoggedRequest[]> =>
	(await pathExists(log)) ? readLog(log) : [];
