// A throw-away CA and a leaf certificate for api.anthropic.com (and any extra hosts), so a local TLS server can stand in for them.
// The CA key is deleted at once; the CA reaches a child only through NODE_EXTRA_CA_CERTS.
import { rm } from "node:fs/promises";
import { join } from "node:path";

const SSL_CANDIDATES = ["/opt/homebrew/bin/openssl", "/usr/bin/openssl"];
const CA_CNF = `[req]
distinguished_name=dn
x509_extensions=v3
prompt=no
[dn]
CN=cc-inspect throw-away CA
[v3]
basicConstraints=critical,CA:TRUE
keyUsage=critical,keyCertSign,cRLSign
`;
const leafCnf = (hosts: string[]): string => `[req]
distinguished_name=dn
prompt=no
[dn]
CN=${hosts[0]}
`;
const leafExt = (hosts: string[]): string => `basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature
extendedKeyUsage=serverAuth
subjectAltName=${hosts.map((h) => `DNS:${h}`).join(",")}
`;

const findOpenssl = async (): Promise<string> => {
	const found = await Promise.all(
		SSL_CANDIDATES.map(async (p) =>
			(await Bun.file(p).exists()) ? p : undefined,
		),
	);
	const ssl = found.find((p) => p !== undefined);
	if (ssl === undefined) {
		throw new Error("openssl not found (/opt/homebrew/bin or /usr/bin)");
	}
	return ssl;
};

const EC = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1"];

type Path = (name: string) => string;

const caArgs = (f: Path): string[] => [
	"req",
	"-x509",
	...EC,
	"-nodes",
	"-keyout",
	f("ca.key"),
	"-out",
	f("ca.pem"),
	"-days",
	"2",
	"-config",
	f("ca.cnf"),
];

const leafArgs = (f: Path): string[] => [
	"req",
	"-new",
	...EC,
	"-nodes",
	"-keyout",
	f("leaf.key"),
	"-out",
	f("leaf.csr"),
	"-config",
	f("leaf.cnf"),
];

const signArgs = (f: Path): string[] => [
	"x509",
	"-req",
	"-in",
	f("leaf.csr"),
	"-CA",
	f("ca.pem"),
	"-CAkey",
	f("ca.key"),
	"-CAcreateserial",
	"-out",
	f("leaf.pem"),
	"-days",
	"2",
	"-extfile",
	f("leaf.ext"),
];

const openssl = async (
	ssl: string,
	dir: string,
	args: string[],
): Promise<void> => {
	const proc = Bun.spawn([ssl, ...args], {
		cwd: dir,
		env: { PATH: "/usr/bin:/bin", HOME: dir },
		stdout: "ignore",
		stderr: "pipe",
	});
	const [stderr, exitCode] = await Promise.all([
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`openssl ${args[0]} failed: ${stderr.slice(0, 300)}`);
	}
};

/** Make ca.pem + leaf.key + leaf.pem in `dir` with openssl (Homebrew OpenSSL, else the system LibreSSL). The leaf names api.anthropic.com and `extraHosts`. The CA key is deleted. */
export const makePki = async (
	dir: string,
	extraHosts: string[] = [],
): Promise<{ ca: string; key: string; cert: string }> => {
	const ssl = await findOpenssl();
	const sh = (args: string[]) => openssl(ssl, dir, args);
	const f = (n: string): string => join(dir, n);
	const hosts = ["api.anthropic.com", ...extraHosts];
	await Promise.all([
		Bun.write(f("ca.cnf"), CA_CNF),
		Bun.write(f("leaf.cnf"), leafCnf(hosts)),
		Bun.write(f("leaf.ext"), leafExt(hosts)),
	]);
	await sh(caArgs(f));
	await sh(leafArgs(f));
	await sh(signArgs(f));
	await rm(f("ca.key"), { force: true });
	return { ca: f("ca.pem"), key: f("leaf.key"), cert: f("leaf.pem") };
};
