// Kind `endpoint`: network endpoints of Anthropic and Claude.
// Anchor (checked on 2.1.309, task 1.1): `"https://…"` string literals whose host is Anthropic or Claude
// (anthropic.com, claude.ai, claude.com, clau.de, ant.dev, claude.fedstart.com, and their subdomains),
// which include the URL config object `{BASE_API_URL:"https://api.anthropic.com",TOKEN_URL:…}`; and the
// paths, as the docs name endpoints: the path of such a URL, string literals and templates that start
// with `/api/`, `/v1/`, or `/model/` (also after one leading expression, `${base}/v1/traces`), and any
// path after a member `BASE_API_URL` (`${…BASE_API_URL}/api/oauth/profile`), with `${…}` parts blanked.
// `detail` is "url" or "path". A template whose path is only a variable (`${…BASE_API_URL}${h}`) is left out.
// Third-party URLs (cloud SDKs, identity providers, JSON Schema, GitHub, placeholders such as
// `example.com` and `.invalid`) are left out: they are bundled library code or links, not endpoints of
// the program's own service.
// The old `strings` heuristic has no endpoint list, so there is nothing to compare.
import {
  type Extractor,
  type SurfaceItem,
  scan,
  short,
  unique,
} from "./common.ts";

const HOST =
  /(?:^|\.)(?:anthropic\.com|claude\.(?:ai|com)|clau\.de|ant\.dev|claude\.fedstart\.com)$/;

const hostOf = (s: string): string | undefined => {
  try {
    return new URL(s).hostname;
  } catch {
    return undefined;
  }
};

const PATH = /^\/(?:api|v1|model)\/[\w./{}?=*%-]*$/;

export const extractEndpoints: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  const add = (name: string, offset: number, m: string, detail: string) =>
    out.push({ kind: "endpoint", name, module: m, offset, detail });
  scan(
    bundle,
    ["https://", "BASE_API_URL", '"/api/', '"/v1/', "`/"],
    (m, n) => {
      if (n.type === "StringLiteral") {
        const s = n.value;
        if (PATH.test(s)) add(s, n.start, m.name, "path");
        if (!s.startsWith("https://") || !HOST.test(hostOf(s) ?? "")) return;
        add(s, n.start, m.name, "url");
        const p = new URL(s).pathname;
        if (PATH.test(p)) add(p, n.start, m.name, "path");
      } else if (n.type === "TemplateLiteral") {
        const t = n.quasis.map((q) => q.value.cooked ?? q.value.raw);
        const e = n.expressions[0];
        const base =
          e?.type === "MemberExpression" &&
          !e.computed &&
          e.property.type === "Identifier" &&
          e.property.name === "BASE_API_URL";
        // `/v1/x/${id}`, or `${base}/v1/x`; after BASE_API_URL any path counts.
        const rest = t[0] === "" && e ? t.slice(1) : t;
        const path = short(rest.join(`\${}`));
        if (base ? path.startsWith("/") : PATH.test(rest[0] ?? "x"))
          add(path, n.start, m.name, "path");
      }
    },
  );
  return unique(out);
};
