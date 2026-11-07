// A throw-away CA and a leaf certificate for api.anthropic.com (and any extra hosts), so a local TLS server can stand in for them.
// The CA key is deleted at once; the CA reaches a child only through NODE_EXTRA_CA_CERTS.
import { existsSync, rmSync, writeFileSync } from "node:fs";
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

/** Make ca.pem + leaf.key + leaf.pem in `dir` with openssl (Homebrew OpenSSL, else the system LibreSSL). The leaf names api.anthropic.com and `extraHosts`. The CA key is deleted. */
export const makePki = (
  dir: string,
  extraHosts: string[] = [],
): { ca: string; key: string; cert: string } => {
  const ssl = SSL_CANDIDATES.find((p) => existsSync(p));
  if (!ssl)
    throw new Error("openssl not found (/opt/homebrew/bin or /usr/bin)");
  const env = { PATH: "/usr/bin:/bin", HOME: dir };
  const sh = (...args: string[]): void => {
    const r = Bun.spawnSync([ssl, ...args], { cwd: dir, env });
    if (r.exitCode !== 0)
      throw new Error(
        `openssl ${args[0]} failed: ${r.stderr.toString().slice(0, 300)}`,
      );
  };
  const f = (n: string): string => join(dir, n);
  writeFileSync(f("ca.cnf"), CA_CNF);
  const hosts = ["api.anthropic.com", ...extraHosts];
  writeFileSync(f("leaf.cnf"), leafCnf(hosts));
  writeFileSync(f("leaf.ext"), leafExt(hosts));
  const ec = ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1"];
  sh(
    "req",
    "-x509",
    ...ec,
    "-nodes",
    "-keyout",
    f("ca.key"),
    "-out",
    f("ca.pem"),
    "-days",
    "2",
    "-config",
    f("ca.cnf"),
  );
  sh(
    "req",
    "-new",
    ...ec,
    "-nodes",
    "-keyout",
    f("leaf.key"),
    "-out",
    f("leaf.csr"),
    "-config",
    f("leaf.cnf"),
  );
  sh(
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
  );
  rmSync(f("ca.key"), { force: true });
  return { ca: f("ca.pem"), key: f("leaf.key"), cert: f("leaf.pem") };
};
