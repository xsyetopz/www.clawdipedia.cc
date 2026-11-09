// Text lookup in the published source of an npm package, for the question "does this library own this text".
// A tarball is untrusted data: it goes into its own new folder, `tar` unpacks it, and nothing in it is run or imported.
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { join } from "node:path";

import { exists } from "./fs.ts";
import { isRecord } from "./json.ts";
import { cacheRoot } from "./prepare.ts";

export { dependenciesOf, findText, fragments } from "./npmtext.ts";

const registry = () =>
	process.env["CC_INSPECT_NPM_REGISTRY"] ?? "https://registry.npmjs.org";
const slug = (name: string) => name.replace("/", "+");
const RELEASE = /^\d+\.\d+\.\d+$/u;
const compare = (a: string, b: string) => Number(a > b) - Number(a < b);

interface Meta {
	version: string;
	dist: { tarball: string; integrity: string };
}
const isMeta = (x: unknown): x is Meta =>
	isRecord(x) &&
	typeof x["version"] === "string" &&
	isRecord(x["dist"]) &&
	typeof x["dist"]["tarball"] === "string" &&
	typeof x["dist"]["integrity"] === "string";

const getJson = async (url: string): Promise<Meta> => {
	const r = await fetch(url);
	if (!r.ok) {
		throw new Error(`${url}: HTTP ${r.status}`);
	}
	const body: unknown = await r.json();
	if (!isMeta(body)) {
		throw new Error(`${url}: no version, tarball, and integrity in the reply`);
	}
	return body;
};

const isTimes = (x: unknown): x is Record<string, string> =>
	isRecord(x) && Object.values(x).every((t) => typeof t === "string");

/** Publish time of each release of `name`. The packument is kept in the cache, so a rerun sees the same list. */
const publishTimes = async (name: string): Promise<Record<string, string>> => {
	const root = join(await cacheRoot(), "npm");
	await mkdir(root, { recursive: true });
	const file = join(root, `${slug(name)}@packument.json`);
	const cached = Bun.file(file);
	if (await cached.exists()) {
		const kept: unknown = JSON.parse(await cached.text());
		if (isTimes(kept)) {
			return kept;
		}
	}
	const r = await fetch(`${registry()}/${name.replace("/", "%2f")}`);
	if (!r.ok) {
		throw new Error(`${name}: packument HTTP ${r.status}`);
	}
	const doc: unknown = await r.json();
	const time = isRecord(doc) ? doc["time"] : undefined;
	if (!isTimes(time)) {
		throw new Error(`${name}: the packument has no publish times`);
	}
	await Bun.write(file, JSON.stringify(time));
	return time;
};

/** The release of `name` that was current at `before` (an ISO time): the highest one that every range in `ranges` admits, else the one published last. Releases with a pre-release tag are left out. */
export const versionAt = async (
	name: string,
	before: string,
	ranges: string[] = [],
): Promise<{ version: string; from: "range-max" | "dated" } | undefined> => {
	const time = await publishTimes(name);
	const old = Object.entries(time).filter(
		([v, t]) => RELEASE.test(v) && t <= before,
	);
	const best = old
		.map(([v]) => v)
		.filter((v) => ranges.every((r) => Bun.semver.satisfies(v, r)))
		.toSorted((a, b) => Bun.semver.order(a, b))
		.at(-1);
	if (ranges.length > 0 && best !== undefined) {
		return { version: best, from: "range-max" };
	}
	const last = old.toSorted(([, a], [, b]) => compare(a, b)).at(-1);
	return last ? { version: last[0], from: "dated" } : undefined;
};

/** The highest release of each major that was published before the time, oldest major first. With `major`, the highest of each minor of that major instead. */
export const linesAt = async (
	name: string,
	before: string,
	major?: string,
): Promise<string[]> => {
	const time = await publishTimes(name);
	const top = new Map<string, string>();
	for (const [v, t] of Object.entries(time)) {
		if (!RELEASE.test(v) || t > before) {
			continue;
		}
		const [ma = "", mi = ""] = v.split(".");
		if (major !== undefined && ma !== major) {
			continue;
		}
		const line = major === undefined ? ma : mi;
		const at = top.get(line);
		if (at === undefined || Bun.semver.order(v, at) > 0) {
			top.set(line, v);
		}
	}
	return [...top.entries()]
		.toSorted(([a], [b]) => Number(a) - Number(b))
		.map(([, v]) => v);
};

const run = async (cmd: string[]): Promise<void> => {
	const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" });
	const [stderr, exitCode] = await Promise.all([
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	if (exitCode !== 0) {
		throw new Error(`${cmd[0]}: ${stderr}`);
	}
};

/** Downloads the tarball of `meta`, checks its hash, unpacks it in a new folder under `root`, and moves the result to `target`. */
const download = async (
	name: string,
	meta: Meta,
	root: string,
	target: string,
): Promise<void> => {
	const tmp = await mkdtemp(join(root, ".tmp-"));
	try {
		const res = await fetch(meta.dist.tarball);
		if (!res.ok) {
			throw new Error(`${meta.dist.tarball}: HTTP ${res.status}`);
		}
		const bytes = new Uint8Array(await res.arrayBuffer());
		const sum = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
		if (sum !== meta.dist.integrity) {
			throw new Error(`${name}@${meta.version}: tarball integrity mismatch`);
		}
		const tgz = join(tmp, "package.tgz");
		await Bun.write(tgz, bytes);
		const out = join(tmp, "unpacked");
		await mkdir(out);
		await run(["tar", "-xzf", tgz, "-C", out]);
		// Some tarballs hold folders without the search bit (pngjs 7.0.0), which no read can enter.
		await run(["chmod", "-R", "u+rwX", out]);
		await rename(out, target);
	} finally {
		await rm(tmp, { recursive: true, force: true });
	}
};

/** The unpacked folder of `name@version` (`latest` is looked up once and then kept); downloads it when the cache lacks it. */
export const fetchPackage = async (
	name: string,
	version?: string,
): Promise<{ version: string; dir: string }> => {
	const root = join(await cacheRoot(), "npm");
	await mkdir(root, { recursive: true });
	const pin = join(root, `${slug(name)}@latest`);
	const pinned = Bun.file(pin);
	const v =
		version ?? ((await pinned.exists()) ? await pinned.text() : undefined);
	const dir = (x: string) => join(root, `${slug(name)}@${x}`);
	if (v !== undefined && v !== "" && (await exists(dir(v)))) {
		return { version: v, dir: dir(v) };
	}
	const meta = await getJson(
		`${registry()}/${name.replace("/", "%2f")}/${v ?? "latest"}`,
	);
	if ((version ?? "") === "") {
		await Bun.write(pin, meta.version);
	}
	const target = dir(meta.version);
	if (!(await exists(target))) {
		await download(name, meta, root, target);
	}
	return { version: meta.version, dir: target };
};
