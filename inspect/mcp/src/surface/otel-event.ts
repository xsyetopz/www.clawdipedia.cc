// Kind `otel-event`: the OpenTelemetry events (log records), from `eventSites` (events.ts, the
// `event-keys` source). Anchor (checked on 2.1.309, task 1.1): the emitter module, the one that holds
// `"event.sequence"`. Names have no `claude_code.` prefix, as in the docs. eventSites gives no offsets.
// The old `strings` heuristic has no event list, so there is nothing to compare.
import { eventSites } from "../events.ts";
import { Resolver } from "../resolve.ts";
import { type Extractor, unique } from "./common.ts";

export const extractOtelEvents: Extractor = (bundle) => {
	const module = bundle.withText('"event.sequence"')[0]?.name ?? null;
	return unique(
		[...eventSites(bundle, new Resolver())].map(([name, sites]) => ({
			kind: "otel-event",
			name,
			module,
			offset: null,
			detail: `${sites.length} call sites`,
		})),
	);
};
