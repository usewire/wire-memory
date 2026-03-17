# wire-memory

Claude Code plugin that gives AI agents persistent memory via Wire containers.

## How it works

This is a **native Claude Code plugin** — no build step, no dependencies, no CLI.

1. User runs `/wire-memory:connect` — opens browser, authenticates via Wire's nonce flow, selects a container
2. Connect script saves MCP endpoint + API key to `~/.wire-memory/config.json` (owner-only permissions)
3. Connect script writes real values directly into `.mcp.json` and marks it `--skip-worktree` to prevent accidental commits
4. After restart, agent has native access to `wire_write`, `wire_search`, `wire_explore`, `wire_analyze`, `wire_delete`
5. The `skills/memory/SKILL.md` teaches the agent when and how to use these tools for persistent memory
6. The `hooks/hooks.json` registers a `UserPromptSubmit` eval hook that prompts the agent to check memory on every prompt

## Plugin structure

```
wire-memory/
├── .claude-plugin/plugin.json   # Plugin manifest
├── .mcp.json                    # MCP server config (placeholder until connected)
├── skills/memory/SKILL.md       # Behavioral instructions for memory usage
├── hooks/hooks.json             # UserPromptSubmit eval hook registration
├── commands/connect.md          # /wire-memory:connect
├── commands/status.md           # /wire-memory:status
├── commands/disconnect.md       # /wire-memory:disconnect
├── scripts/connect.mjs          # Nonce flow (Node.js, zero deps)
├── scripts/eval-hook.mjs        # Eval hook — prompts agent to use memory tools
├── scripts/status.mjs           # Show connection info
├── scripts/disconnect.mjs       # Clean up config
├── package.json                 # @usewire/memory
└── LICENSE                      # MIT, Superloops LLC
```

## Development

Test locally:
```bash
claude --plugin-dir .
```

Then run `/wire-memory:connect` to test the flow.

## No build step

Everything is plain `.mjs` and markdown. No TypeScript, no bundler, no dependencies.
The scripts use only Node.js built-ins (crypto, fs, path, os, child_process).
