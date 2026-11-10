// cc-inspect MCP server (stdio). Writes only its cache and the temp folders of `code` `run` (removed after); its network calls are `gh release view` for `release` `notes`, `bunx @wakaru/cli` for `code` `read` `view: "readable"`, and Bun's download of `oxc-parser` on the first start. No telemetry.
// Reads Claude Code session transcripts (sessions.ts) and the modules inside the Claude Code binary (binary.ts).
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { server } from "./mcp/app.ts";

await import("./mcp/sessions.ts");
await import("./mcp/code.ts");
await import("./mcp/surface.ts");
await import("./mcp/release.ts");
await import("./mcp/prompts.ts");

await server.connect(new StdioServerTransport());
