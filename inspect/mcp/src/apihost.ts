// Lets the stub of run.ts answer `https://api.anthropic.com`: a CONNECT proxy sends that host to a TLS copy of the stub
// with a throw-away CA, and refuses every other host.
import http from "node:http";
import net from "node:net";

import { makePki } from "./pki.ts";

/** The host that `apiHost` lets the stub answer. */
export const API_HOST = "api.anthropic.com";

type Server = ReturnType<typeof Bun.serve>;
/** The servers a run starts, so the caller can stop them. */
export interface Servers {
	stub?: Server;
	tls?: Server;
	proxy?: http.Server;
}

const connectTo =
	(tlsPort: number) =>
	(req: http.IncomingMessage, sock: net.Socket, head: Buffer): void => {
		sock.on("error", () => {
			sock.destroy();
		});
		if (req.url !== `${API_HOST}:443`) {
			sock.end("HTTP/1.1 502 Bad Gateway\r\n\r\n");
			return;
		}
		const up = net.connect(tlsPort, "127.0.0.1", () => {
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
	};

const listen = (proxy: http.Server): Promise<number> =>
	new Promise<number>((resolve, reject) => {
		proxy.once("error", reject);
		proxy.listen(0, "127.0.0.1", () => {
			const addr = proxy.address();
			if (addr === null || typeof addr === "string") {
				reject(new Error("the proxy has no port"));
				return;
			}
			resolve(addr.port);
		});
	});

/** Start the TLS copy of `answer` and the CONNECT proxy, record both in `servers`, and give the proxy URL and the CA file. */
export const startApiHost = async (
	servers: Servers,
	answer: (req: Request) => Promise<Response>,
	pkiDir: string,
): Promise<{ proxyUrl: string; ca: string }> => {
	const pki = await makePki(pkiDir);
	const tls = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		tls: { key: Bun.file(pki.key), cert: Bun.file(pki.cert) },
		fetch: answer,
	});
	servers.tls = tls;
	const proxy = http.createServer((_q, r) => {
		r.statusCode = 405;
		r.end();
	});
	servers.proxy = proxy;
	proxy.on("connect", connectTo(tls.port ?? 0));
	return { proxyUrl: `http://127.0.0.1:${await listen(proxy)}`, ca: pki.ca };
};
