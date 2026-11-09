// Local stand-in for api.anthropic.com behind a CONNECT proxy, for live runs that need a fault on one endpoint
// (/api/oauth/usage) or a look at message bodies. Ports p305-lv/mitm2.ts and p305-live/proxy.ts.
// The throw-away CA lives in a mkdtemp dir, reaches the child only through NODE_EXTRA_CA_CERTS, and is deleted on stop.
// Never touches the system keychain or trust store. Logs method, path and status only: no headers, no bodies.
import { mkdtemp, realpath, rm } from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { makePki } from "../../../inspect/mcp/src/pki.ts";
import { onCleanup } from "./cleanup.ts";

export const USAGE_PATH = "/api/oauth/usage";
export type Fault = "pass" | "429" | "429-ra" | "200-envelope";
const ENVELOPE = {
	type: "error",
	error: { type: "rate_limit_error", message: "Rate limited" },
};

export interface MitmLog {
	method: string;
	path: string;
	status: number;
	fault?: Fault;
}
export interface MitmOpts {
	/** for USAGE_PATH; default "pass" */
	fault?: Fault;
	/** Where non-faulted requests go. Default: the real https://api.anthropic.com. Dry runs pass a local answer. */
	upstream?: (req: Request, url: URL) => Response | Promise<Response>;
	/** Hosts besides api.anthropic.com that the proxy sends to the TLS stub, with the same `upstream` answer. */
	hosts?: string[];
	/** Tunnel CONNECT to hosts other than api.anthropic.com. Default true; dry runs say false (502). */
	tunnelOthers?: boolean;
	/** "Forward and log body": called with each parsed POST /v1/messages body (non-auth). Nothing else is read. */
	onMessages?: (rec: { path: string; body: unknown; betas: string }) => void;
}
export interface Mitm {
	proxyUrl: string;
	caFile: string;
	setFault: (f: Fault) => void;
	log: () => MitmLog[];
	connects: () => string[];
	stop: () => Promise<void>;
}

const live = new Set<() => Promise<void>>();
onCleanup(async () => {
	await Promise.all([...live].map((s) => s()));
});

const realUpstream = (req: Request, url: URL): Promise<Response> => {
	const h = new Headers(req.headers);
	h.delete("host");
	h.delete("accept-encoding");
	return fetch(`https://api.anthropic.com${url.pathname}${url.search}`, {
		method: req.method,
		headers: h,
		body: ["GET", "HEAD"].includes(req.method) ? null : req.body,
		redirect: "manual",
	});
};

type Upstream = NonNullable<MitmOpts["upstream"]>;
type Note = (status: number, f?: Fault) => void;

const faultResponse = (f: Fault, note: Note): Response => {
	const json = { "content-type": "application/json" };
	if (f === "200-envelope") {
		note(200, f);
		return Response.json(ENVELOPE, { status: 200, headers: json });
	}
	note(429, f);
	return Response.json(ENVELOPE, {
		status: 429,
		headers: f === "429-ra" ? { ...json, "retry-after": "1800" } : json,
	});
};

const forward = async (
	req: Request,
	url: URL,
	opts: MitmOpts,
	upstream: Upstream,
): Promise<Response> => {
	if (
		opts.onMessages === undefined ||
		req.method !== "POST" ||
		url.pathname !== "/v1/messages"
	) {
		return upstream(req, url);
	}
	const text = await req.text();
	try {
		opts.onMessages({
			path: url.pathname,
			body: JSON.parse(text),
			betas: req.headers.get("anthropic-beta") ?? "",
		});
	} catch {
		// not JSON: nothing to record
	}
	return upstream(
		new Request(req.url, {
			method: "POST",
			headers: new Headers(req.headers),
			body: text,
		}),
		url,
	);
};

interface State {
	fault: Fault;
	log: MitmLog[];
	connects: string[];
}

const serveTls = (
	pki: { key: string; cert: string },
	opts: MitmOpts,
	st: State,
): ReturnType<typeof Bun.serve> => {
	const upstream = opts.upstream ?? realUpstream;
	return Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		// long SSE streams must not be cut
		idleTimeout: 0,
		tls: { key: Bun.file(pki.key), cert: Bun.file(pki.cert) },
		async fetch(req) {
			const url = new URL(req.url);
			const note: Note = (status, f) => {
				st.log.push({
					method: req.method,
					path: url.pathname,
					status,
					...(f === undefined ? {} : { fault: f }),
				});
			};
			if (url.pathname === USAGE_PATH && st.fault !== "pass") {
				return faultResponse(st.fault, note);
			}
			let r: Response;
			try {
				r = await forward(req, url, opts, upstream);
			} catch {
				note(502);
				return new Response("upstream error", { status: 502 });
			}
			note(r.status);
			const rh = new Headers(r.headers);
			rh.delete("content-encoding");
			rh.delete("content-length");
			return new Response(r.body, { status: r.status, headers: rh });
		},
	});
};

/** Host and port of a CONNECT target: "host:443" or "[::1]:443". */
const parseTarget = (target: string): { host: string; port: string } => {
	const v6 = /^\[([^\]]+)\](?::(\d+))?$/u.exec(target);
	const [h0 = "", p0 = "443"] = target.split(":");
	return v6
		? { host: v6[1] ?? "", port: v6[2] ?? "443" }
		: { host: h0, port: p0 };
};

const makeProxy = (
	opts: MitmOpts,
	tlsPort: number,
	connects: string[],
): http.Server => {
	const proxy = http.createServer((_q, r) => {
		r.statusCode = 405;
		r.end();
	});
	proxy.on("connect", (req, sock, head) => {
		const { host, port } = parseTarget(req.url ?? "");
		connects.push(host);
		sock.on("error", () => {
			sock.destroy();
		});
		const toTls =
			host === "api.anthropic.com" || (opts.hosts ?? []).includes(host);
		if (!toTls && opts.tunnelOthers === false) {
			sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
			return;
		}
		const up = toTls
			? net.connect(tlsPort, "127.0.0.1")
			: net.connect(Number(port), host);
		up.on("connect", () => {
			sock.write("HTTP/1.1 200 OK\r\n\r\n");
			if (head.length > 0) {
				up.write(head);
			}
			sock.pipe(up);
			up.pipe(sock);
		});
		up.on("error", () => {
			sock.destroy();
		});
		sock.on("close", () => {
			up.destroy();
		});
	});
	return proxy;
};

const listen = (px: http.Server): Promise<number> =>
	new Promise<number>((resolve, reject) => {
		px.once("error", reject);
		px.listen(0, "127.0.0.1", () => {
			const addr = px.address();
			if (addr === null || typeof addr === "string") {
				reject(new Error("proxy has no TCP address"));
				return;
			}
			resolve(addr.port);
		});
	});

export const startMitm = async (opts: MitmOpts = {}): Promise<Mitm> => {
	const dir = await realpath(await mkdtemp(join(tmpdir(), "ccrel-pki-")));
	const st: State = { fault: opts.fault ?? "pass", log: [], connects: [] };
	let stopped = false;
	let tls: ReturnType<typeof Bun.serve> | undefined;
	let proxy: http.Server | undefined;
	const stop = async (): Promise<void> => {
		if (stopped) {
			return;
		}
		stopped = true;
		live.delete(stop);
		void tls?.stop(true);
		proxy?.close();
		proxy?.closeAllConnections();
		await rm(dir, { recursive: true, force: true });
	};
	live.add(stop);
	try {
		const pki = await makePki(dir, opts.hosts);
		tls = serveTls(pki, opts, st);
		proxy = makeProxy(opts, tls.port ?? 0, st.connects);
		const port = await listen(proxy);
		return {
			proxyUrl: `http://127.0.0.1:${port}`,
			caFile: pki.ca,
			setFault: (f) => {
				st.fault = f;
			},
			log: () => [...st.log],
			connects: () => [...st.connects],
			stop,
		};
	} catch (error) {
		await stop();
		throw error;
	}
};
