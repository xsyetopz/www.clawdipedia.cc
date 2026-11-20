# Install the dependencies of the plugin servers, which keep their own lockfiles.
project-setup:
    bun install --cwd plugin/mcp {{ if env("CI", "") == "" { "" } else { "--frozen-lockfile" } }}
    bun install --cwd inspect/mcp {{ if env("CI", "") == "" { "" } else { "--frozen-lockfile" } }}

# Run the site checks `just verify` does not: docs, examples, schemas, surface, build, llms.txt, plugins, and deploy config.
project-verify:
    bun run check:docs
    bun run check:citations
    bun run check:examples
    bun run check:hosts
    bun run schemas:check
    bun run surface:check
    bun run build
    bun run llms:check
    bun run plugin:check
    bun run deploy:check
