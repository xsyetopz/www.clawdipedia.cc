// A local HTTPS server that answers for Anthropic host names, behind a CONNECT proxy that sends every tunnel to it.
// The child trusts the throwaway certificate through NODE_EXTRA_CA_CERTS and reaches the proxy through HTTPS_PROXY.
// The program checks some host names (an Anthropic API or MCP proxy host) before it sends a request, so a plain
// local HTTP stub cannot stand in for them.
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

/** A running TLS server and its proxy. */
export interface TlsProxy {
	/** HTTPS_PROXY, NO_PROXY, and NODE_EXTRA_CA_CERTS for the child. */
	env: Record<string, string>;
	/** Stops both servers and removes the certificate. */
	stop: () => Promise<void>;
}

const makeCert = async (
	dir: string,
	names: string[]
): Promise<{ key: string; cert: string }> => {
	const key = join(dir, "key.pem");
	const cert = join(dir, "cert.pem");
	const san = `subjectAltName=${names.map((n) => `DNS:${n}`).join(",")}`;
	await Bun.$`openssl req -x509 -newkey rsa:2048 -nodes -keyout ${key} -out ${cert} -days 2 -subj /CN=${names[0] ?? "localhost"} -addext ${san}`.quiet();
	return { key, cert };
};

// Sends each CONNECT tunnel to the local TLS server, whatever host the child asked for.
const startProxy = async (target: number): Promise<net.Server> => {
	const proxy = net.createServer((c) => {
		c.once("data", () => {
			const up = net.connect(target, "127.0.0.1", () => {
				c.write("HTTP/1.1 200 Connection Established\r\n\r\n");
				c.pipe(up);
				up.pipe(c);
			});
			up.on("error", () => {
				c.destroy();
			});
			c.on("error", () => {
				up.destroy();
			});
		});
	});
	await new Promise<void>((resolve) => {
		proxy.listen(0, "127.0.0.1", () => {
			resolve();
		});
	});
	return proxy;
};

const portOf = (proxy: net.Server): number => {
	const addr = proxy.address();
	if (addr === null || typeof addr === "string") {
		throw new Error("proxy has no TCP address");
	}
	return addr.port;
};

/** Starts a TLS server for `names` (the first is the CN) that answers with `fetch`, and a proxy in front of it. */
export const startTlsProxy = async (
	names: string[],
	fetch: (req: Request) => Response | Promise<Response>
): Promise<TlsProxy> => {
	const dir = await mkdtemp(join(tmpdir(), "tlsmock-"));
	const { key, cert } = await makeCert(dir, names);
	const tls = Bun.serve({
		port: 0,
		hostname: "127.0.0.1",
		idleTimeout: 0,
		tls: { key: Bun.file(key), cert: Bun.file(cert) },
		fetch
	});
	const proxy = await startProxy(tls.port ?? 0);
	return {
		env: {
			HTTPS_PROXY: `http://127.0.0.1:${portOf(proxy)}`,
			NO_PROXY: "127.0.0.1",
			NODE_EXTRA_CA_CERTS: cert
		},
		stop: async () => {
			proxy.close();
			await tls.stop(true);
			await rm(dir, { recursive: true, force: true });
		}
	};
};
