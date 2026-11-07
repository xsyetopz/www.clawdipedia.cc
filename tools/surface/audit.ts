// Usage: CC_INSPECT_CACHE=$PWD/captures bun tools/surface/audit.ts [--version <v>] [--root <dir>]   (also: bun run surface:audit)
// Runs every entry of tools/surface/exclusions.json through one check, chosen by the kind and the reason of the entry,
// and writes captures/<version>/exclusions-audit.json: key, reason, read site, check, result, evidence.
// An entry covers the items of surface.json that its key names (a trailing `*` is a prefix); it passes when each item does.
// Library checks fetch the published source of the library from the npm registry (cc-inspect `code` `npm`).
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { isFn, type Module, type Node } from "../../inspect/mcp/src/ast.ts";
import { program } from "../../inspect/mcp/src/binary.ts";
import {
  dependenciesOf,
  fetchPackage,
  findText,
  linesAt,
  versionAt,
} from "../../inspect/mcp/src/npm.ts";
import type { SurfaceItem } from "../../inspect/mcp/src/surface/common.ts";
import { CLAUDE_CODE_VERSION } from "../../src/version.ts";
import { assertSafeEnv } from "../release/lib/env.ts";
import { docsNames, exclusionOf } from "./coverage.ts";

const ROOT = join(import.meta.dir, "..", "..");

type Evidence = Record<string, unknown>;
type Verdict = { ok: boolean; evidence: Evidence };

const AWS = [
  "@aws-sdk/",
  "@smithy/",
  "@aws-crypto/",
  "@aws-sdk/credential-providers",
];
const GOOGLE = ["google-auth-library", "gaxios", "gcp-metadata"];
const OTEL = [
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/resources",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/sdk-metrics",
  "@opentelemetry/sdk-logs",
  "@opentelemetry/otlp-exporter-base",
  "@opentelemetry/otlp-transformer",
  "@opentelemetry/exporter-trace-otlp-http",
];
/** Reason of an entry to the npm packages whose published source must hold its text. A name ending in `/` is every bundled package of that scope. */
const LIBS: [RegExp, string[]][] = [
  [/AWS SDK and Smithy/, AWS],
  [/jose/, ["jose"]],
  [/Google auth library|google-auth-library/, GOOGLE],
  [/Zod/, ["zod"]],
  [/helper library/, ["turndown", "@mixmark-io/domino"]],
  [
    /MCP SDK v2/,
    ["@modelcontextprotocol/client", "@modelcontextprotocol/server"],
  ],
  [/MCP SDK/, ["@modelcontextprotocol/sdk"]],
  [/gRPC/, ["@grpc/grpc-js", "@grpc/proto-loader"]],
  [/protobuf and CEL/, ["@bufbuild/protobuf", "@bufbuild/cel"]],
  [
    /Azure SDK|Azure identity/,
    [
      "@azure/identity",
      "@azure/core-rest-pipeline",
      "@azure/core-client",
      "@azure/core-tracing",
      "@azure/msal-node",
      "@azure/msal-common",
    ],
  ],
  [/Standard Webhooks/, ["standardwebhooks"]],
  [/bundled Agent SDK/, ["@anthropic-ai/claude-agent-sdk"]],
  [/Vertex client/, ["@anthropic-ai/vertex-sdk"]],
  [/embedded Anthropic SDK client/, ["@anthropic-ai/sdk"]],
  [/Anthropic SDK/, ["@anthropic-ai/sdk"]],
  [
    /Anthropic cloud-provider SDKs/,
    [
      "@anthropic-ai/bedrock-sdk",
      "@anthropic-ai/vertex-sdk",
      "@anthropic-ai/foundry-sdk",
      "@anthropic-ai/aws-sdk",
    ],
  ],
  [/Ajv/, ["ajv", "ajv-formats"]],
  [/pngjs/, ["pngjs"]],
  [/QR code/, ["qrcode"]],
  [/lodash/, ["lodash"]],
  [/base64-js/, ["base64-js"]],
  [/OpenTelemetry SDK/, OTEL],
  [/p-map and OpenTelemetry exporter/, ["p-map", ...OTEL]],
  [/vscode-jsonrpc/, ["vscode-jsonrpc"]],
  [/execa/, ["execa"]],
  [/commander/, ["commander"]],
  [/lru-cache/, ["lru-cache"]],
  [/undici/, ["undici"]],
  [/tslib/, ["tslib"]],
  [/GrowthBook/, ["@growthbook/growthbook"]],
  [/diff library/, ["diff"]],
  [/Ink and ow/, ["ink", "ow"]],
  [/jsonc-parser/, ["jsonc-parser"]],
  [/chokidar/, ["chokidar", "readdirp", "anymatch"]],
  [/Markdown extension registration/, ["marked"]],
  [/path of the bundled AWS SDK/, AWS],
  [/bundled Google auth library/, GOOGLE],
  [/bundled cloud SDK/, [...AWS, ...GOOGLE]],
  [
    /HTTP proxy-agent library/,
    [
      "agent-base",
      "http-proxy-agent",
      "https-proxy-agent",
      "socks-proxy-agent",
      "socks",
    ],
  ],
];

/** A reason that starts "Bundled <package>" names the package: its first word when that is a package name, else the first scoped name in the reason. */
const bundledName = (reason: string): string[] | undefined => {
  const word = /^Bundled (@[\w.-]+\/[\w.-]+|[a-z][\w.-]*)/.exec(reason)?.[1];
  const scoped = /^Bundled .*?(@[\w.-]+\/[\w.-]+)/.exec(reason)?.[1];
  const name = word ?? scoped;
  return name ? [name] : undefined;
};

type Ctx = {
  version: string;
  root: string;
  bundle: ReturnType<typeof program>["bundle"];
  items: Map<string, SurfaceItem>;
  sweep: Record<string, unknown>;
  endpointRows: Map<string, string>;
  /** The library package -> { version, source } that the audit used. */
  libraries: Record<string, Found>;
};

const reEscape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const allText = (c: Ctx) => [...c.bundle.modules.values()];

type Found = {
  version: string;
  from: "embedded" | "range-max" | "dated";
  source: string;
  /** Other releases the program may hold: the floor of each range, or for a dated pick the highest release of each of the last four minors of its major. */
  also?: string[];
};

/** The ranges of a package that dependency lists in the bundle demand, with the place of the first. */
const rangesOf = (c: Ctx, name: string) => {
  const re = new RegExp(
    `"${reEscape(name)}":"([\\^~>=]+\\d+\\.\\d+\\.\\d+)"`,
    "g",
  );
  const ranges = new Set<string>();
  let site = "";
  for (const m of allText(c))
    for (const h of m.text.matchAll(re)) {
      ranges.add(h[1] as string);
      site ||= `${m.name}@${h.index}`;
    }
  return { ranges: [...ranges].sort(), site };
};

/** The user agent that a client builds from a version constant X. */
const USER_AGENTS: Record<string, RegExp> = {
  "@anthropic-ai/sdk": /Anthropic\/JS \$\{(\w+)\}/,
  axios: /"axios\/"\+(\w+)/,
};

/** A version the program states: an embedded package.json (`name`, `version`), an exact pin in a dependency list, or zod's version object. */
const embedded = (c: Ctx, name: string): Omit<Found, "from"> | undefined => {
  const q = reEscape(name);
  const exact = new RegExp(
    `name:"${q}",(?:description:"[^"]*",)?version:"(\\d[^"]*)"`,
  );
  const pin = new RegExp(`"${q}":"(\\d+\\.\\d+\\.\\d+)"`);
  const agent = USER_AGENTS[name];
  if (agent) {
    // The client sends its version in the user agent; X is a `var X="1.2.3"` in some module.
    for (const m of allText(c)) {
      const x = agent.exec(m.text)?.[1];
      if (!x) continue;
      const decl = new RegExp(`var ${x}="(\\d+\\.\\d+\\.\\d+)";`);
      for (const d of allText(c)) {
        const h = decl.exec(d.text);
        if (h?.[1])
          return {
            version: h[1],
            source: `user-agent constant ${x} in ${d.name}@${h.index}`,
          };
      }
    }
  }
  for (const m of allText(c)) {
    if (!m.text.includes(name)) continue;
    const e = exact.exec(m.text)?.[1];
    if (e) return { version: e, source: `package.json in ${m.name}` };
    const z =
      name === "zod"
        ? /major:(\d+),minor:(\d+),patch:(\d+)/.exec(m.text)
        : null;
    if (z)
      return {
        version: z.slice(1, 4).join("."),
        source: `zod version object in ${m.name}@${z.index}`,
      };
    const p = pin.exec(m.text)?.[1];
    if (p) return { version: p, source: `exact pin in ${m.name}` };
  }
  return undefined;
};

/** The release time of the program: its BUILD_TIME constant. */
const builtAt = (c: Ctx) => {
  for (const m of allText(c)) {
    const t = /BUILD_TIME:"(\d{4}-[^"]+)"/.exec(m.text)?.[1];
    if (t) return t;
  }
  throw new Error("no BUILD_TIME in the program");
};

const gone = (e: Error) => {
  if (/HTTP 404/.test(e.message)) return undefined;
  throw e;
};

/** `given` are ranges from the package.json of a package that depends on this one. */
const library = async (c: Ctx, name: string, given: string[] = []) => {
  let known: Found | undefined = c.libraries[name];
  if (!known) {
    const e = embedded(c, name);
    if (e) known = { ...e, from: "embedded" };
    else {
      const inBundle = rangesOf(c, name);
      const ranges = [...inBundle.ranges, ...given];
      const site = inBundle.site || "a dependent package.json";
      const v = await versionAt(name, builtAt(c), ranges).catch(gone);
      if (v) {
        // A bundled copy lags its dated pick by a minor or two, and a long major (AWS SDK v3 has hundreds of minors) costs one download per line.
        const also =
          v.from === "range-max"
            ? ranges.map((r) => r.replace(/^[\^~>=]+/, ""))
            : (await linesAt(name, builtAt(c), v.version.split(".")[0])).slice(
                -4,
              );
        known = {
          version: v.version,
          from: v.from,
          source:
            v.from === "range-max"
              ? `highest release in ${ranges.join(" ")} (${site}) published before the build`
              : "last release published before the build",
          also: [...new Set(also)].filter((a) => a !== v.version).reverse(),
        };
      }
    }
  }
  if (!known) return undefined;
  const pkg = await fetchPackage(name, known.version);
  c.libraries[name] = known;
  return { name, ...pkg, from: known.from };
};

const bundledScope = (c: Ctx, scope: string) => {
  const re = new RegExp(`"(${reEscape(scope)}[a-z0-9.-]+)":"`, "g");
  const names = new Set<string>();
  for (const m of allText(c))
    for (const h of m.text.matchAll(re)) names.add(h[1] as string);
  const kept = [...names].filter((n) => !/\/client-|\.$/.test(n));
  // Client packages ship their own package.json object in the bundle.
  const clients = new RegExp(
    `name:"(${reEscape(scope)}client-[a-z0-9-]+)",description:`,
    "g",
  );
  for (const m of allText(c))
    for (const h of m.text.matchAll(clients)) kept.push(h[1] as string);
  return [...new Set(kept)].sort();
};

const packagesOf = async (c: Ctx, names: string[]) => {
  const list = names.flatMap((n) =>
    n.endsWith("/") ? bundledScope(c, n) : [n],
  );
  const out = await Promise.all(list.map((n) => library(c, n)));
  return {
    pkgs: out.filter((p) => p !== undefined),
    gaps: list.filter((n) => !c.libraries[n]).sort(),
  };
};

const libCheck = async (
  c: Ctx,
  names: string[],
  text: string,
  majors = true,
  exact = false,
): Promise<Verdict> => {
  const { pkgs, gaps } = await packagesOf(c, names);
  const tried: string[] = [];
  const look = (name: string, version: string, from: string, dir: string) => {
    const r = findText(dir, text, exact);
    if (!r.file) {
      tried.push(`${name}@${version} (${from})`);
      return undefined;
    }
    return {
      ok: true,
      evidence: {
        package: `${name}@${version}`,
        versionFrom: from,
        file: r.file,
        ...(r.loose ? { match: "sentences in any order" } : {}),
      },
    };
  };
  // The packages, the other releases they may be, then their own dependencies, which the bundle names no version of.
  const seen = new Set(pkgs.map((p) => p.name));
  const deps: NonNullable<Awaited<ReturnType<typeof library>>>[] = [];
  for (const level of [pkgs, deps])
    for (const p of level) {
      const hit = look(p.name, p.version, p.from, p.dir);
      if (hit) return hit;
      for (const v of c.libraries[p.name]?.also ?? []) {
        const pkg = await fetchPackage(p.name, v).catch(gone);
        const alt = pkg && look(p.name, v, "also", pkg.dir);
        if (alt) return alt;
      }
      if (level === deps) continue;
      for (const [d, r] of Object.entries(dependenciesOf(p.dir))) {
        if (seen.has(d) || !/^[\^~]?\d+\.\d+\.\d+$/.test(r)) continue;
        seen.add(d);
        const q = await library(c, d, [r]);
        if (q) deps.push(q);
      }
    }
  // Another major than the one the program holds may carry the text, e.g. a second copy of the library.
  for (const p of majors ? pkgs : []) {
    for (const v of await linesAt(p.name, builtAt(c))) {
      if (v === p.version) continue;
      // A release in the time list can be gone from the registry.
      const pkg = await fetchPackage(p.name, v).catch(gone);
      const hit = pkg && look(p.name, v, "major-latest", pkg.dir);
      if (hit) return hit;
    }
  }
  return { ok: false, evidence: { notIn: tried, gaps } };
};

const sweepOf = (c: Ctx, name: string): Evidence & { state: string } => {
  const skipped = c.sweep["skipped"] as string[];
  const [a, b] = [c.sweep[`${name}.A`], c.sweep[`${name}.B`]] as (
    | string[]
    | undefined
  )[];
  if (skipped.includes(name)) return { state: "skipped" };
  if (!a || !b) {
    try {
      assertSafeEnv({ [name]: "1" });
    } catch {
      return { state: "skipped" };
    }
    return { state: "not swept" };
  }
  if ([...a, ...b].some((k) => k.startsWith("error:")))
    return { state: "run errored" };
  return [...a, ...b].length
    ? { state: "changed", A: a, B: b }
    : { state: "unchanged" };
};

/** Where the bundle reads the variable by name: `.NAME`, `["NAME"]`, or `.get("NAME")`. A name inside a list or a registry is not a read. */
const envReadSites = (c: Ctx, name: string) => {
  const prefix = name.endsWith("*");
  const q = reEscape(prefix ? name.slice(0, -1) : name);
  const end = prefix ? "[A-Z0-9_]*" : "\\b";
  const re = new RegExp(
    `\\.${q}${end}(?!:)|\\[["'\`]${q}${end}["'\`]\\]|\\.get\\(["'\`]${q}${end}["'\`]\\)`,
    "g",
  );
  const sites: string[] = [];
  for (const m of allText(c)) {
    if (!m.text.includes(q.replaceAll("\\", ""))) continue;
    for (const h of m.text.matchAll(re)) sites.push(`${m.name}@${h.index}`);
  }
  return sites;
};
/** The reason names the variable only in lists: no read by name, and no change in the sweep. */
const envListed = (c: Ctx, i: SurfaceItem): Verdict => {
  const s = sweepOf(c, i.name);
  const reads = envReadSites(c, i.name);
  return {
    ok: !reads.length && s.state !== "changed",
    evidence: { detail: i.detail ?? null, reads: reads.slice(0, 3), sweep: s },
  };
};
/** The reason says the program reads the variable but shows no effect: a read by name or a typed read, and no change in the sweep. */
const envEffect = (c: Ctx, i: SurfaceItem): Verdict => {
  const s = sweepOf(c, i.name);
  const reads = envReadSites(c, i.name);
  return {
    ok:
      (reads.length > 0 || (i.detail !== "listed" && i.module !== null)) &&
      s.state !== "changed",
    evidence: { detail: i.detail ?? null, reads: reads.slice(0, 3), sweep: s },
  };
};

const fnAround = (m: Module, offset: number): Node | undefined => {
  for (let n: Node | undefined = m.nodeAt(offset); n; n = m.parent(n))
    if (isFn(n)) return n;
  return undefined;
};
const NAMES = (c: Ctx, kind: string) =>
  new Set(
    [...c.items.keys()]
      .filter((k) => k.startsWith(`${kind}:`))
      .map((k) => k.slice(kind.length + 1)),
  );

const internalError = async (
  c: Ctx,
  i: SurfaceItem,
  pool: string[],
): Promise<Verdict> => {
  // Only the versions the program holds, and whole matches: a short phrase of the program's own often turns up in some old major or inside a longer library message, and a loose match can pair a number of the program with a library constant of another value.
  const lib = await libCheck(c, pool, i.name, false, true);
  const m = i.module && i.offset !== null ? c.bundle.get(i.module) : undefined;
  const fn = m && i.offset !== null ? fnAround(m, i.offset) : undefined;
  const reads =
    fn && m ? /process\.(env|argv)\b/.exec(m.src(fn))?.[0] : undefined;
  const envs = NAMES(c, "env");
  const flags = NAMES(c, "flag");
  const names = [
    ...(i.name.match(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g) ?? []).filter((n) =>
      envs.has(n),
    ),
    ...(i.name.match(/(?<![\w-])--[a-z][a-z0-9-]+/g) ?? []).filter((n) =>
      flags.has(n),
    ),
  ];
  return {
    ok: !lib.ok && !reads && names.length === 0,
    evidence: {
      inLibrary: lib.ok ? lib.evidence : null,
      functionReads: reads ?? null,
      textNames: names,
    },
  };
};

const HTTP = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "request",
  "fetch",
  "head",
]);
/** Whether the literal at the site is, through `+`, template, `?:` or an options object, an argument of an HTTP verb call. */
const endpointCalled = (c: Ctx, i: SurfaceItem): Verdict => {
  const m = i.module && i.offset !== null ? c.bundle.get(i.module) : undefined;
  if (!m || i.offset === null) return { ok: false, evidence: { site: "none" } };
  let n: Node = m.nodeAt(i.offset);
  for (let p = m.parent(n); p; n = p, p = m.parent(p)) {
    if (p.type === "CallExpression") {
      const f = p.callee;
      const callee =
        f.type === "Identifier"
          ? f.name
          : f.type === "MemberExpression" && f.property.type === "Identifier"
            ? f.property.name
            : "";
      const isArg = (p.arguments as Node[]).includes(n);
      return {
        ok: !(isArg && HTTP.has(callee)),
        evidence: { callee, argument: isArg },
      };
    }
    if (
      ![
        "TemplateLiteral",
        "BinaryExpression",
        "ConditionalExpression",
        "LogicalExpression",
        "ObjectProperty",
        "ObjectExpression",
        "TemplateElement",
        "StringLiteral",
      ].includes(p.type)
    )
      break;
  }
  return { ok: true, evidence: { callee: null } };
};

const occurrences = (c: Ctx, re: RegExp) => {
  let n = 0;
  for (const m of allText(c)) n += m.text.match(re)?.length ?? 0;
  return n;
};

/** The print captures of the release that list the tool: the program can build a tool name at run time, so no name literal does not mean no tool. */
const listedBy = (c: Ctx, name: string) => {
  const dir = join(c.root, "captures", c.version, "print");
  const re = new RegExp(`\\\\?"${reEscape(name)}\\\\?"`);
  return existsSync(dir)
    ? readdirSync(dir).filter((f) =>
        re.test(readFileSync(join(dir, f), "utf8")),
      )
    : [];
};

/** The check of one item: [name, run]. `reason` and the kind decide. */
const pick = (
  c: Ctx,
  reason: string,
  i: SurfaceItem,
): [string, () => Promise<Verdict> | Verdict] => {
  const lib = LIBS.find(([re]) => re.test(reason))?.[1] ?? bundledName(reason);
  // The Agent SDK ships the program's own code, so every text of the program is in it.
  const all = [...new Set(LIBS.flatMap(([, p]) => p))].filter(
    (p) => p !== "@anthropic-ai/claude-agent-sdk",
  );
  switch (i.kind) {
    case "error":
      return lib
        ? ["library-text", () => libCheck(c, lib, i.name)]
        : ["internal-error", () => internalError(c, i, all)];
    case "endpoint": {
      if (lib) return ["library-text", () => libCheck(c, lib, i.name)];
      const row = /^Covered by the `([^`]+)` row/.exec(reason)?.[1];
      if (row)
        return [
          "docs-row",
          () => ({
            ok: c.endpointRows.has(row),
            evidence: { row, file: c.endpointRows.get(row) ?? null },
          }),
        ];
      return ["endpoint-not-called", () => endpointCalled(c, i)];
    }
    case "env":
      if (/Read only by a library bundled/.test(reason))
        return ["library-text", () => libCheck(c, all, i.name)];
      if (/^Changes /.test(reason))
        return [
          "env-sweep-changed",
          () => {
            const sweep = sweepOf(c, i.name);
            return { ok: sweep.state === "changed", evidence: { sweep } };
          },
        ];
      return /^Variable of the OS or another tool\. Claude Code only names|^Named in the program's table|^Only a name/.test(
        reason,
      )
        ? ["env-listed", () => envListed(c, i)]
        : ["env-effect", () => envEffect(c, i)];
    case "file": {
      // A reason that starts "Named in a message" claims the opposite of "only a name": a sentence of the program names the file.
      const named = /^Named in a message/.test(reason);
      return [
        named ? "file-named-in-text" : "file-unmentioned",
        () => {
          // The name as a whole path part inside a sentence: after `.claude/`, `~/`, `CLAUDE_CONFIG_DIR/` or a `${…}/` hole, or before a `/`, for a plain word; any boundary for a dotted file name.
          const n = reEscape(i.name);
          const token = i.name.includes(".")
            ? `(?<![\\w.-])${n}(?![\\w-])`
            : `(?:(?:\\.claude|~|CLAUDE_CONFIG_DIR|\\})/${n}(?![\\w.-])|(?<![\\w./-])${n}/[\\w.{$])`;
          const re = new RegExp(
            `["'\`][^"'\`\\n]*${token}[^"'\`\\n]*["'\`]`,
            "g",
          );
          const hits: string[] = [];
          for (const m of allText(c))
            for (const h of m.text.matchAll(re))
              if (h[0].includes(" "))
                hits.push(`${m.name}@${h.index}: ${h[0].slice(0, 100)}`);
          return {
            ok: named ? hits.length > 0 : hits.length === 0,
            evidence: { textsNamingIt: hits.length, first: hits.slice(0, 2) },
          };
        },
      ];
    }
    case "model":
      return [
        "model-only-in-retired-text",
        () => {
          const bad: string[] = [];
          let n = 0;
          for (const m of allText(c)) {
            let at = m.text.indexOf(i.name);
            if (at < 0) continue;
            for (; at >= 0; at = m.text.indexOf(i.name, at + 1)) {
              n++;
              const node = m.nodeAt(at);
              // A table row is an object with `status:"retired"`; prose says "retired" in its own text.
              let row: Node | undefined = node;
              while (row && row.type !== "ObjectExpression")
                row = m.parent(row);
              if (
                !["StringLiteral", "TemplateElement"].includes(node.type) ||
                !(
                  /retired/i.test(m.src(node)) ||
                  (row && /\bstatus:"retired"/.test(m.src(row)))
                )
              )
                bad.push(`${m.name}@${at}`);
            }
          }
          return {
            ok: n > 0 && bad.length === 0,
            evidence: { occurrences: n, outsideRetiredText: bad.slice(0, 3) },
          };
        },
      ];
    case "setting": {
      return [
        "setting-unread",
        () => {
          const reads = occurrences(
            c,
            new RegExp(`\\.${reEscape(i.name)}\\b`, "g"),
          );
          return {
            ok: reads === 0,
            evidence: { memberReads: reads, detail: i.detail ?? null },
          };
        },
      ];
    }
    case "flag":
      return [
        "flag-unread",
        () => {
          const camel = i.name
            .replace(/^--/, "")
            .replace(/-(.)/g, (_, x: string) => x.toUpperCase());
          const reads = occurrences(c, new RegExp(`\\.${camel}\\b`, "g"));
          return {
            ok: i.gate === "hidden" && reads === 0,
            evidence: {
              gate: i.gate ?? null,
              memberReads: reads,
              property: camel,
            },
          };
        },
      ];
    case "slash-command":
      return [
        "command-state",
        () => {
          const g = i.gate ?? "";
          const d = i.detail ?? "";
          const ok = /always returns false/.test(reason)
            ? /isEnabled \(\)=>!1/.test(g)
            : /\(removed\)/.test(reason)
              ? g.startsWith("hidden") && d.includes("(removed)")
              : /renamed/.test(reason)
                ? g.startsWith("hidden") && d.includes("Renamed to")
                : g.startsWith("hidden") && !d.includes(" | ");
          return { ok, evidence: { gate: g, detail: d } };
        },
      ];
    case "tool":
      return [
        "tool-not-defined",
        () => {
          const defs = occurrences(
            c,
            new RegExp(`\\bname:\\s*"${reEscape(i.name)}"`, "g"),
          );
          const listed = listedBy(c, i.name);
          return {
            ok: defs === 0 && listed.length === 0,
            evidence: { nameLiterals: defs, listedBy: listed },
          };
        },
      ];
    case "gate":
      return [
        "gate-read-site",
        () => ({
          ok: i.module !== null && i.offset !== null,
          evidence: { limit: "read site only; no run sets a GrowthBook value" },
        }),
      ];
    default:
      return [
        "unknown-kind",
        () => ({ ok: false, evidence: { kind: i.kind } }),
      ];
  }
};

export const audit = async (version: string, root: string) => {
  const surface = JSON.parse(
    readFileSync(join(root, "captures", version, "surface.json"), "utf8"),
  ) as { kinds: Record<string, SurfaceItem[]> };
  const exclusions = JSON.parse(
    readFileSync(join(root, "tools", "surface", "exclusions.json"), "utf8"),
  ) as Record<string, string>;
  const items = new Map<string, SurfaceItem>();
  for (const [kind, list] of Object.entries(surface.kinds))
    for (const i of list) items.set(`${kind}:${i.name}`, i);
  const c: Ctx = {
    version,
    root,
    bundle: program(version).bundle,
    items,
    sweep: (
      JSON.parse(
        readFileSync(
          join(root, "captures", version, "print", "sweep.json"),
          "utf8",
        ),
      ) as { data: Record<string, unknown> }
    ).data,
    endpointRows: docsNames(root, ["docs/reference/api/endpoints.md"]),
    libraries: {},
  };
  const entries = [];
  for (const [key, reason] of Object.entries(exclusions)) {
    const covered = [...items]
      .filter(([k]) => exclusionOf(k, { [key]: reason }) !== undefined)
      .map(([, i]) => i);
    if (!covered.length) {
      entries.push({
        key,
        reason,
        site: null,
        check: "stale",
        result: "fail",
        evidence: { note: "no item of surface.json matches the key" },
      });
      continue;
    }
    let check = "";
    const bad: { item: string; evidence: Evidence }[] = [];
    let first: Evidence = {};
    for (const i of covered) {
      const [name, run] = pick(c, reason, i);
      check = name;
      const v = await run();
      if (!v.ok) bad.push({ item: i.name, evidence: v.evidence });
      else if (!Object.keys(first).length) first = v.evidence;
    }
    const at = (i: SurfaceItem) =>
      i.module ? `${i.module}@${i.offset}` : null;
    entries.push({
      key,
      reason,
      site: at(covered[0] as SurfaceItem),
      check,
      result: bad.length ? "fail" : "pass",
      evidence: {
        items: covered.length,
        ...(bad.length
          ? { failed: bad.length, firstFailed: bad.slice(0, 3) }
          : first),
      },
    });
  }
  entries.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  return {
    version,
    libraries: Object.fromEntries(Object.entries(c.libraries).sort()),
    entries,
  };
};

if (import.meta.main) {
  const { values: a } = parseArgs({
    options: { version: { type: "string" }, root: { type: "string" } },
  });
  const version = a.version ?? CLAUDE_CODE_VERSION;
  const result = await audit(version, a.root ?? ROOT);
  const file = join(
    a.root ?? ROOT,
    "captures",
    version,
    "exclusions-audit.json",
  );
  mkdirSync(dirname(file), { recursive: true });
  const body = `{\n"version": ${JSON.stringify(result.version)},\n"libraries": ${JSON.stringify(result.libraries)},\n"entries": [\n${result.entries.map((e) => JSON.stringify(e)).join(",\n")}\n]\n}\n`;
  writeFileSync(file, body);
  const by = new Map<string, [number, number]>();
  for (const e of result.entries) {
    const g = by.get(`${e.check} | ${e.reason.slice(0, 70)}`) ?? [0, 0];
    g[e.result === "pass" ? 0 : 1]++;
    by.set(`${e.check} | ${e.reason.slice(0, 70)}`, g);
  }
  for (const [g, [p, f]] of [...by].sort())
    console.log(`pass ${p} fail ${f}  ${g}`);
  console.log(
    `${file}: ${result.entries.length} entries, ${result.entries.filter((e) => e.result === "fail").length} fail`,
  );
}
