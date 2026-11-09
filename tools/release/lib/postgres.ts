// A throwaway Postgres container for the `claude gateway` probes. The gateway has no dev store, so Docker is required.
import { onCleanup } from "./cleanup.ts";
import { allocPort } from "./ports.ts";

const IMAGE = "postgres:17-alpine";

interface Sh {
	exitCode: number;
	stdout: string;
	stderr: string;
}

const sh = async (argv: string[]): Promise<Sh> => {
	const p = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
	const [stdout, stderr, exitCode] = await Promise.all([
		new Response(p.stdout).text(),
		new Response(p.stderr).text(),
		p.exited,
	]);
	return { exitCode, stdout, stderr };
};

/** Fails with the install step when Docker is missing or its daemon is down. */
export const requireDocker = async (): Promise<void> => {
	if (Bun.which("docker") === null) {
		throw new Error(
			"docker is required for the gateway cases: install Docker (https://docs.docker.com/get-docker/) and start it",
		);
	}
	const info = await sh(["docker", "info"]);
	if (info.exitCode !== 0) {
		throw new Error(
			"docker is installed but its daemon is not running: start Docker",
		);
	}
};

const psql = (name: string, args: string[]): Promise<Sh> =>
	sh([
		"docker",
		"exec",
		name,
		"psql",
		"-h",
		"127.0.0.1",
		"-U",
		"postgres",
		"-d",
		"probe",
		...args,
	]);

/** The first server of the image listens on its socket only; a TCP query works once the final one is up. */
const waitReady = async (name: string, attempt: number): Promise<void> => {
	const probe = await psql(name, ["-c", "select 1"]);
	if (probe.exitCode === 0) {
		return;
	}
	if (attempt >= 60) {
		throw new Error("postgres did not accept connections in 60 s");
	}
	await Bun.sleep(1000);
	return waitReady(name, attempt + 1);
};

/** Runs `fn` with a throwaway Postgres on a loopback port. `query` runs SQL in it and returns the rows as `|` separated text. The container is removed when `fn` ends. */
export const withPostgres = async <T>(
	fn: (port: number, query: (sql: string) => Promise<string>) => Promise<T>,
): Promise<T> => {
	await requireDocker();
	const port = await allocPort();
	const name = `ccrel-pg-${process.pid}-${port}`;
	const rm = async (): Promise<void> => {
		await sh(["docker", "rm", "-f", name]);
	};
	onCleanup(rm);
	const run = await sh([
		"docker",
		"run",
		"-d",
		"--rm",
		"--name",
		name,
		"-e",
		"POSTGRES_HOST_AUTH_METHOD=trust",
		"-e",
		"POSTGRES_DB=probe",
		"-p",
		`127.0.0.1:${port}:5432`,
		IMAGE,
	]);
	if (run.exitCode !== 0) {
		throw new Error(
			`docker run ${IMAGE} failed: ${run.stderr.trim().slice(0, 200)}`,
		);
	}
	try {
		await waitReady(name, 0);
		const query = async (sql: string): Promise<string> => {
			const q = await psql(name, ["-At", "-c", sql]);
			if (q.exitCode !== 0) {
				throw new Error(`psql failed: ${q.stderr.trim()}`);
			}
			return q.stdout.trim();
		};
		return await fn(port, query);
	} finally {
		await rm();
	}
};
