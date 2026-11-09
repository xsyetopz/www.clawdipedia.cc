# Install the dependencies of the plugin servers, which keep their own lockfiles.
setup-project:
    bun install --cwd plugin/mcp {{ if env("CI", "") == "" { "" } else { "--frozen-lockfile" } }}
    bun install --cwd inspect/mcp {{ if env("CI", "") == "" { "" } else { "--frozen-lockfile" } }}

# Run the site checks `just verify` does not: docs, examples, schemas, surface, build, llms.txt, plugins, and deploy config.
verify-project:
    bun run check:docs
    bun run check:examples
    bun run check:hosts
    bun run schemas:check
    bun run surface:check
    bun run build
    bun run llms:check
    bun run plugin:check
    bun run deploy:check
