import { assumeCases } from "./api319/assume.ts";
import { betaCases, widgetCases } from "./api319/betacases.ts";
import { gatewayFirst, gatewayLast } from "./api319/gwcases.ts";
// Betas and tools new in 2.1.319: tool-provenance, program-use-case-ids, claude-code-side-query, request-tags, WrapUp, ReadWidgetContext.
// Each case reads every request the stub saw: the four betas, the body fields that go with them, and the tool list.
import { runCases } from "./run/helpers.ts";
import type { PrintGroup } from "./types.ts";

export { SRV } from "./api319/beta.ts";

export const api319: PrintGroup = {
	id: "api319",
	title: "Betas and tools new in 2.1.319",
	run: (ctx) =>
		runCases(ctx, "api319", [
			...betaCases,
			...gatewayFirst,
			...assumeCases,
			...gatewayLast,
			...widgetCases,
		]),
};
