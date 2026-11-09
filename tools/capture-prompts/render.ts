// Reads captures/<version>/prompts/* (or CAPTURE_OUT), normalizes machine-specific values, and writes
//   tools/capture-prompts/out/<id>.txt        normalized prompt text
//   docs/prompts/<group>/*.md                the pages, one folder for each group
// Run by capture.ts, or alone: bun tools/capture-prompts/render.ts
import { ctx } from "./render/ctx.ts";
import { writeCategories } from "./render/groups.ts";
import { loadHand } from "./render/hand.ts";
import { indexPage } from "./render/index.ts";
import { listingPages } from "./render/listing.ts";
import { findDups, loadCaps } from "./render/load.ts";
import { toolsPage, toolsPerVariantPage } from "./render/tools.ts";
import { variantPages } from "./render/variant.ts";

await loadCaps();
await loadHand();
await writeCategories();
findDups();
await variantPages();
await toolsPerVariantPage();
await toolsPage();
await listingPages();
await indexPage();
console.info(
	`rendered ${ctx.caps.size} variants, ${ctx.dupOf.size} duplicates: ${[...ctx.dupOf].map(([a, b]) => `${a}=${b}`).join(" ")}`,
);
