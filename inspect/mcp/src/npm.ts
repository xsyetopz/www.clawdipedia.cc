// Text lookup in the published source of an npm package, for the question "does this library own this text".
// A tarball is untrusted data: it goes into its own new folder, `tar` unpacks it, and nothing in it is run or imported.
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { extname, join } from "node:path";
import { cacheRoot } from "./prepare.ts";

const registry = () =>
  process.env["CC_INSPECT_NPM_REGISTRY"] ?? "https://registry.npmjs.org";
const slug = (name: string) => name.replace("/", "+");
/** The shortest run of static text that tells one package from another. */
const MIN_STATIC = 8;

type Meta = {
  version: string;
  dist: { tarball: string; integrity: string };
};
const getJson = async (url: string): Promise<Meta> => {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return (await r.json()) as Meta;
};

type Packument = { time: Record<string, string> };

/** Publish time of each release of `name`. The packument is kept in the cache, so a rerun sees the same list. */
const publishTimes = async (name: string): Promise<Record<string, string>> => {
  const root = join(cacheRoot(), "npm");
  mkdirSync(root, { recursive: true });
  const file = join(root, `${slug(name)}@packument.json`);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8"));
  const r = await fetch(`${registry()}/${name.replace("/", "%2f")}`);
  if (!r.ok) throw new Error(`${name}: packument HTTP ${r.status}`);
  const time = ((await r.json()) as Packument).time;
  writeFileSync(file, JSON.stringify(time));
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
    ([v, t]) => /^\d+\.\d+\.\d+$/.test(v) && t <= before,
  );
  const fit = old
    .map(([v]) => v)
    .filter((v) => ranges.every((r) => Bun.semver.satisfies(v, r)))
    .sort(Bun.semver.order);
  if (ranges.length && fit.length)
    return { version: fit.at(-1) as string, from: "range-max" };
  const last = old.sort(([, a], [, b]) => (a < b ? -1 : a > b ? 1 : 0)).at(-1);
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
    if (!/^\d+\.\d+\.\d+$/.test(v) || t > before) continue;
    const [ma, mi] = v.split(".") as [string, string];
    if (major !== undefined && ma !== major) continue;
    const line = major === undefined ? ma : mi;
    const at = top.get(line);
    if (!at || Bun.semver.order(v, at) > 0) top.set(line, v);
  }
  return [...top.entries()]
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, v]) => v);
};

/** The unpacked folder of `name@version` (`latest` is looked up once and then kept); downloads it when the cache lacks it. */
export const fetchPackage = async (
  name: string,
  version?: string,
): Promise<{ version: string; dir: string }> => {
  const root = join(cacheRoot(), "npm");
  mkdirSync(root, { recursive: true });
  const pin = join(root, `${slug(name)}@latest`);
  const v =
    version ?? (existsSync(pin) ? readFileSync(pin, "utf8") : undefined);
  const dir = (x: string) => join(root, `${slug(name)}@${x}`);
  if (v && existsSync(dir(v))) return { version: v, dir: dir(v) };
  const meta = await getJson(
    `${registry()}/${name.replace("/", "%2f")}/${v ?? "latest"}`,
  );
  if (!version) writeFileSync(pin, meta.version);
  const target = dir(meta.version);
  if (existsSync(target)) return { version: meta.version, dir: target };
  const tmp = mkdtempSync(join(root, ".tmp-"));
  try {
    const res = await fetch(meta.dist.tarball);
    if (!res.ok) throw new Error(`${meta.dist.tarball}: HTTP ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    const sum = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    if (sum !== meta.dist.integrity)
      throw new Error(`${name}@${meta.version}: tarball integrity mismatch`);
    writeFileSync(join(tmp, "package.tgz"), bytes);
    const out = join(tmp, "unpacked");
    mkdirSync(out);
    const t = Bun.spawnSync([
      "tar",
      "-xzf",
      join(tmp, "package.tgz"),
      "-C",
      out,
    ]);
    if (t.exitCode !== 0) throw new Error(`tar: ${t.stderr.toString()}`);
    // Some tarballs hold folders without the search bit (pngjs 7.0.0), which no read can enter.
    const m = Bun.spawnSync(["chmod", "-R", "u+rwX", out]);
    if (m.exitCode !== 0) throw new Error(`chmod: ${m.stderr.toString()}`);
    renameSync(out, target);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { version: meta.version, dir: target };
};

const SOURCE = new Set([".js", ".cjs", ".mjs"]);
/** Folders of a package that its code never loads: bundled tooling, examples, and tests. */
const NOT_LIBRARY = new Set([
  ".yarn",
  "examples",
  "test",
  "tests",
  "__tests__",
]);
const files = (dir: string): string[] =>
  readdirSync(dir)
    .sort()
    .flatMap((f) => {
      const p = join(dir, f);
      const s = lstatSync(p);
      return s.isDirectory()
        ? NOT_LIBRARY.has(f)
          ? []
          : files(p)
        : s.isFile() && SOURCE.has(extname(f))
          ? [p]
          : [];
    });

/** Source text as the surface shows its strings: joined `"a" + "b"` pieces, unescaped quotes, and each run of whitespace as one space. */
const plain = (s: string) =>
  s
    .replace(/["'`]\s*\+\s*["'`]/g, "")
    .replace(/\\(["'`\\])/g, "$1")
    .replace(/\\[nt]/g, " ")
    .replace(/\s+/g, " ");

/** The static pieces of a text: what lies between its `${…}` holes. A trailing `…` is the cut that the surface makes at 200 characters. */
export const fragments = (text: string): string[] =>
  text
    .replace(/…$/, "")
    .replace(/\s+/g, " ")
    .split(/\$\{[^}]*\}/)
    .filter(Boolean);

const sources = new Map<string, [string, string][]>();
const sourcesOf = (dir: string) => {
  let all = sources.get(dir);
  if (!all) {
    all = files(dir).map((f) => [f, plain(readFileSync(f, "utf8"))]);
    sources.set(dir, all);
  }
  return all;
};

/** The sentences of the fragments, also cut at long numbers. A bundler folds a constant expression such as `${MAX - 1}` into a number and inlines string constants, so a sentence of the program text can sit anywhere in the library file. */
const pieces = (parts: string[]) =>
  parts
    .flatMap((p) => p.split(/(?<=[.:]) |\d{5,}/))
    .map((p) => p.trim())
    .filter((p) => p.length >= MIN_STATIC);

/** Each start of `p` in `src` at or after `from`. */
const starts = function* (src: string, p: string, from: number) {
  for (let i = src.indexOf(p, from); i >= 0; i = src.indexOf(p, i + 1)) yield i;
};
const QUOTE = /["'`]/;

/** The first file of the folder (path order) that holds every fragment of the text, in order. Else the first that holds every piece, in any order (`loose`). With `whole`, only a match from a quote to a quote counts (no `loose`): a short text of the program can sit inside a longer library message. */
export const findText = (
  dir: string,
  text: string,
  whole = false,
): { file?: string; fragments: string[]; short: boolean; loose?: true } => {
  const parts = fragments(text);
  const short = parts.join("").length < MIN_STATIC;
  if (short) return { fragments: parts, short };
  const all = sourcesOf(dir);
  // The join step of `plain` also drops a quoted "+" in the source, so the text goes through it too.
  const want = parts.map(plain);
  const open = whole && !text.startsWith("${");
  const close = whole && !/[}…]$/.test(text);
  const head = want[0] as string;
  const mid = want.slice(1, -1);
  const last = want.length > 1 ? (want.at(-1) as string) : undefined;
  const fits = (src: string) => {
    for (const i of starts(src, head, 0)) {
      if (open && !QUOTE.test(src[i - 1] ?? "")) continue;
      let at = i + head.length;
      if (
        !mid.every((p) => {
          const j = src.indexOf(p, at);
          at = j + p.length;
          return j >= 0;
        })
      )
        return false;
      if (last === undefined) {
        if (!close || QUOTE.test(src[at] ?? "")) return true;
        continue;
      }
      for (const j of starts(src, last, at))
        if (!close || QUOTE.test(src[j + last.length] ?? "")) return true;
    }
    return false;
  };
  for (const [f, src] of all)
    if (fits(src))
      return { file: f.slice(dir.length + 1), fragments: parts, short };
  const loose = whole ? [] : pieces(want);
  if (loose.length > 1)
    for (const [f, src] of all)
      if (loose.every((p) => src.includes(p)))
        return {
          file: f.slice(dir.length + 1),
          fragments: parts,
          short,
          loose: true,
        };
  return { fragments: parts, short };
};

/** The `dependencies` of the unpacked package. */
export const dependenciesOf = (dir: string): Record<string, string> => {
  const top = readdirSync(dir)[0] as string;
  const pkg = JSON.parse(readFileSync(join(dir, top, "package.json"), "utf8"));
  return pkg.dependencies ?? {};
};
