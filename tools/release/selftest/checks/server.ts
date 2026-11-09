import { gatewayChecks } from "./gateway.ts";
import { orchChecks } from "./orch.ts";
import { stubChecks, type StubEnv } from "./stubs.ts";

/** The stub's Messages API and runner API, then the gateway helpers and the OTLP receiver. */
export const serverChecks = async (env: StubEnv): Promise<void> => {
	await stubChecks(env);
	await orchChecks(env);
	await gatewayChecks(env.step);
};
