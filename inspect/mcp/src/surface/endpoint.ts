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
import { type NodeOf, strLit } from "../ast.ts";
import {
	type Extractor,
	scan,
	short,
	type SurfaceItem,
	unique,
} from "./common.ts";

const HOST =
	/(?:^|\.)(?:anthropic\.com|claude\.(?:ai|com)|clau\.de|ant\.dev|claude\.fedstart\.com)$/u;

const hostOf = (s: string): string | undefined => {
	try {
		return new URL(s).hostname;
	} catch {
		return undefined;
	}
};

const PATH = /^\/(?:api|v1|model)\/[\w./{}?=*%-]*$/u;

type Add = (name: string, offset: number, detail: string) => void;

const addString = (s: string, offset: number, add: Add): void => {
	if (PATH.test(s)) {
		add(s, offset, "path");
	}
	if (!s.startsWith("https://") || !HOST.test(hostOf(s) ?? "")) {
		return;
	}
	add(s, offset, "url");
	const p = new URL(s).pathname;
	if (PATH.test(p)) {
		add(p, offset, "path");
	}
};

const addTemplate = (
	n: NodeOf<"TemplateLiteral">,
	offset: number,
	add: Add,
): void => {
	const parts = n.quasis.map((q) => q.value.cooked ?? q.value.raw);
	const e = n.expressions[0];
	const base =
		e?.type === "MemberExpression" &&
		!e.computed &&
		e.property.type === "Identifier" &&
		e.property.name === "BASE_API_URL";
	// `/v1/x/${id}`, or `${base}/v1/x`; after BASE_API_URL any path counts.
	const rest = parts[0] === "" && e ? parts.slice(1) : parts;
	const path = short(rest.join(`\${}`));
	if (base ? path.startsWith("/") : PATH.test(rest[0] ?? "x")) {
		add(path, offset, "path");
	}
};

export const extractEndpoints: Extractor = async (bundle) => {
	const out: SurfaceItem[] = [];
	await scan(
		bundle,
		["https://", "BASE_API_URL", '"/api/', '"/v1/', "`/"],
		(m, n) => {
			const add: Add = (name, offset, detail) => {
				out.push({ kind: "endpoint", name, module: m.name, offset, detail });
			};
			const s = strLit(n);
			if (s !== undefined) {
				addString(s, n.start, add);
			} else if (n.type === "TemplateLiteral") {
				addTemplate(n, n.start, add);
			}
		},
	);
	return unique(out);
};
