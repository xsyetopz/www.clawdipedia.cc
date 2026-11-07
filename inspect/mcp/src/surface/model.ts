// Kind `model`: model ids and aliases.
// Anchor (checked on 2.1.309, task 1.1): ids are string literals that are a whole model id:
// `claude-[<n>-]<family>[-<part>…][@<date>][[1m]]` with the family opus, sonnet, haiku, fable, or mythos
// (`claude-sonnet-4-5`, `claude-3-5-haiku-20241022`, `claude-opus-4-1@20250805`). Strings that only hold an
// id inside other text, and prefixes that end in a dash (`claude-3-`), are not ids. `detail` is "id".
// Aliases: the all-string array that holds "opusplan" and "sonnet"
// (`["sonnet","opus","haiku","fable","best",…,"opusplan"]`); `detail` is "alias".
// The old `strings` heuristic has no model list, so there is nothing to compare.
import {
  type Extractor,
  type SurfaceItem,
  scan,
  strings,
  unique,
} from "./common.ts";

const ID =
  /^claude-(?:\d[\d-]*-)?(?:opus|sonnet|haiku|fable|mythos)(?:-[a-z0-9]+)*(?:@\d+)?(?:\[1m\])?$/;

export const extractModels: Extractor = (bundle) => {
  const out: SurfaceItem[] = [];
  let aliases: { m: string; start: number; names: string[] } | undefined;
  scan(bundle, ['"claude-', '"opusplan"'], (m, n) => {
    if (n.type === "StringLiteral" && ID.test(n.value))
      out.push({
        kind: "model",
        name: n.value,
        module: m.name,
        offset: n.start,
        detail: "id",
      });
    if (n.type !== "ArrayExpression") return;
    const s = strings(m, n);
    if (
      s?.includes("opusplan") &&
      s.includes("sonnet") &&
      (!aliases || s.length > aliases.names.length)
    )
      aliases = { m: m.name, start: n.start, names: s };
  });
  for (const name of aliases?.names ?? [])
    out.push({
      kind: "model",
      name,
      module: aliases?.m ?? null,
      offset: aliases?.start ?? null,
      detail: "alias",
    });
  return unique(out);
};
