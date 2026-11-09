// The local OTLP/JSON collector of observe/print.ts: the program posts its telemetry here.
import { promisify } from "node:util";
import { gunzip } from "node:zlib";

import { ingest, obj } from "./ingest.ts";

const gunzipAsync = promisify(gunzip);

export const startCollector = (port: number) =>
	Bun.serve({
		port,
		hostname: "127.0.0.1",
		async fetch(req) {
			const url = new URL(req.url);
			let buf: Uint8Array = new Uint8Array(await req.arrayBuffer());
			if (req.headers.get("content-encoding") === "gzip") {
				buf = await gunzipAsync(buf);
			}
			try {
				const body: unknown = JSON.parse(new TextDecoder().decode(buf));
				ingest(url.pathname, obj(body));
			} catch {
				// not JSON (protobuf): counted as nothing
			}
			return Response.json({});
		},
	});
