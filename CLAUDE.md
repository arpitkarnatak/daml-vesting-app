# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Canton Network & DAML MCP

1. Use the Canton Network and DAML MCP server to answer questions about the network, DAML, and contracts in this repo.
2. If the MCP server is not available in Claude Code, install it with:
   ```
   npx @canton-network-devs/canton-mcp-server install
   ```
   Then restart Claude Code and ask the question again.

## Detailed Guides

- [Testing Strategy](docs/TESTING_STRATEGY.md) — how tests are structured, where they live, and coverage rules.
- [Contract Rules](docs/CONTRACT_RULES.md) — documentation requirements for contract changes.
