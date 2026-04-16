# wire-memory

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.7.0-green.svg)](https://github.com/usewire/wire-memory)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)
[![Claude Code](https://img.shields.io/badge/Claude%20Code-plugin-purple.svg)](https://docs.anthropic.com/en/docs/claude-code)
[![Cursor](https://img.shields.io/badge/Cursor-plugin-blue.svg)](https://cursor.com)

**Persistent memory for AI coding agents.**

Every AI session starts from zero. Your agent doesn't know what you decided yesterday, what patterns you established last week, or the correction you gave it three conversations ago. wire-memory fixes that. It gives your agent a persistent memory layer that captures decisions, corrections, and patterns, then retrieves them when they're relevant.

## The problem

- **No continuity.** Your agent forgets everything between sessions.
- **Repeated corrections.** You fix the same mistake session after session.
- **Re-explaining context.** Every conversation starts with "here's how our project works..." again.
- **No cross-project awareness.** Preferences and coding style don't carry over between repos.

## How wire-memory solves it

- **Automatic logging.** Decisions, corrections, and patterns are captured as they happen.
- **Automatic retrieval.** Before responding, your agent searches past context for relevant decisions and patterns.
- **Scoped by project and user.** Every write is tagged with your current project and identity.
- **Portable.** Memory is stored in a [Wire](https://usewire.io) container, accessible from any MCP-compatible tool.

## Quick start

### Claude Code (CLI)

```bash
# Add the Wire marketplace (one-time)
/plugin marketplace add usewire/wire-plugins

# Install wire-memory
/plugin install wire-memory@wire-plugins
```

### Claude Code (Desktop)

Click **+** next to the prompt box, select **Plugins**, then **Add plugin**. Add the Wire marketplace (`usewire/wire-plugins`) if you haven't already, then install wire-memory.

### Cursor

Open **Settings** > **Plugins**, paste `https://github.com/usewire/wire-memory` in the plugin input, and install.

**On Cursor 2.5+, add `app.usewire.io` to your sandbox allowlist before running `/wire-connect`.** The agent's sandbox blocks outbound network by default, and the connect flow needs to reach Wire's API to register the connect nonce and poll for your container selection.

Add the domain via Settings > Cursor Settings > Agents > Auto-Run (`sandbox.json`), or switch Auto-Run mode from "Run in Sandbox" to "Ask Every Time" if you prefer per-prompt approval.

Same allowlist entry covers `/wire-claim`, `/wire-disconnect`, and `/wire-status`. One-time setup.

### Connect

After installing, run:

```
/wire-connect
```

This opens your browser to authenticate and select a container. No account required. The connect flow can spin up a free ephemeral container you can test for 7 days, then claim by creating an account.

After connecting, restart your editor. Your memory tools are ready.

### Choosing a scope (Claude Code)

Claude Code will ask you to choose an installation scope:

- **User scope** (default): Available in all your projects. Best for individuals working across multiple repos with one memory container.
- **Project scope**: Committed to the repo. Best for teams sharing a single container where everyone's agents contribute to the same memory.

Either way, every write is tagged with project and user context. Retrieval is scoped automatically regardless of install scope.

## What gets remembered

wire-memory works in the background. Your agent captures context as structured entries:

**Decisions** (when you pick an approach or evaluate trade-offs):
```json
{
  "type": "decision",
  "project": "my-app",
  "user": "Charlie",
  "scope": "project",
  "title": "Use React Query for server state",
  "decision": "React Query over Zustand for API data",
  "why": "Automatic cache invalidation, background refetching, request deduplication"
}
```

**Corrections** (when you fix the agent's approach):
```json
{
  "type": "correction",
  "project": "my-app",
  "user": "Charlie",
  "scope": "project",
  "title": "Don't mock the database in integration tests",
  "what_happened": "Agent suggested mocking Postgres",
  "correction": "Use real database. Mocks masked a broken migration last quarter."
}
```

**Patterns** (coding conventions and established approaches):
```json
{
  "type": "pattern",
  "project": "my-app",
  "user": "Charlie",
  "scope": "project",
  "title": "Permission checks use requirePermission middleware",
  "description": "All protected API routes use requirePermission({ resource: ['action'] })"
}
```

**Preferences** (global, cross-project):
```json
{
  "type": "preference",
  "user": "Charlie",
  "scope": "global",
  "title": "Concise responses",
  "preference": "Skip preamble, lead with action, no trailing summaries"
}
```

## What is Wire?

[Wire](https://usewire.io) is a Context as a Service platform. You create containers, add your files and context, and Wire transforms everything into structured, AI-optimized content. Every container gets its own MCP server that any AI tool can connect to.

wire-memory uses a Wire container as its storage backend. Your memory is not locked into any single AI tool. It's portable context that follows you across Claude Code, Cursor, and any MCP-compatible client.

[Learn more about Wire](https://usewire.io)

## Tools

Your agent gets these MCP tools from your Wire container:

| Tool | Purpose |
|------|---------|
| `wire_search` | Search memory by text, semantic similarity, or filters |
| `wire_write` | Save decisions, patterns, corrections, preferences |
| `wire_explore` | Browse what's stored: types, schemas, entry counts |
| `wire_delete` | Remove outdated entries |
| `wire_analyze` | Re-analyze the container's contents |

## Skills

| Skill | Description |
|-------|-------------|
| `/wire-connect` | Authenticate and connect to a Wire container |
| `/wire-configure` | Configure settings (transcript capture, etc.) |
| `/wire-status` | Show connection status and container info |
| `/wire-claim` | Claim an ephemeral container to make it permanent |
| `/wire-disconnect` | Remove credentials and disconnect |

## How it works

1. **Connect.** `/wire-connect` opens your browser to authenticate. Pick a container or create one. No account needed for the 7-day trial. During connect you'll be asked whether to enable transcript capture (Claude Code only).
2. **Configure.** The connect script writes your MCP endpoint and API key to the plugin's `.mcp.json`. Restart your editor to activate. Run `/wire-configure` anytime to change settings.
3. **Use.** Bundled skills and rules teach your agent when to search and write memory. It happens automatically as part of normal conversation.

## Transcript capture

> **Claude Code only.** Cursor does not provide transcript access to plugins.

wire-memory can automatically capture session transcripts and upload them to your Wire container. This gives your memory layer the full conversation history, not just what the agent explicitly logs, but every question, decision, and tool call.

Enable during connect or anytime via `/wire-configure`:

```
/wire-configure

Wire Memory Configuration
─────────────────────────
✓ Connected to container "Memory"

Transcript Capture
  Automatically upload session transcripts to your Wire container.
  Secrets are redacted before upload. Tool results are stripped.

  Enable transcript capture? [y/N]: y

  When to capture:
  [1] Before compaction + end of session (recommended)
  [2] Before compaction only
  [3] End of session only

  Choice [1]: 1

  Minimum session length (turns) [4]: 4

✓ Transcript capture: enabled
```

**How it works:**

- **PreCompact hook** fires before Claude compresses the context window. It captures the full, uncompressed conversation before it's lost.
- **Stop hook** fires when Claude finishes responding. It captures sessions that never hit the compaction threshold.
- If PreCompact already uploaded for a session, Stop skips the upload.
- Stop also skips sessions below the minimum turn threshold (default 4).

**What gets uploaded:**

- Native JSONL format, one turn per line. Preserves structure for search and filtering.
- Tool result lines are stripped. The returned file contents are derivative data.
- Secrets are redacted before upload. Covers ~20 patterns including API keys, tokens, passwords, and connection strings.
- Files are named `transcript-{date}-{session-id}-{trigger}.jsonl`.

**Disabled by default.** Transcript capture is opt-in. No data leaves your machine unless you explicitly enable it.

## Ephemeral containers and claiming

When you connect without an account, Wire creates an **ephemeral container**. It's fully functional but expires after 7 days. Your agent reads and writes memory, decisions are captured, and corrections stick, just like a permanent container.

The difference is the clock. After 7 days the container and its data are deleted.

**How you'll know it's ephemeral:**

- `/wire-connect` prints a warning with the expiry date
- `/wire-status` shows "Ephemeral" with a countdown
- Your agent sees a reminder at the start of each session

**To keep it permanently**, run `/wire-claim`. This opens your browser to create a Wire account. Once you sign up, your existing container and all its memory transfer to your account. Nothing is lost. The plugin detects the change automatically on the next session start.

If you claim through the Wire website directly (outside the plugin), the plugin self-heals. It checks ephemeral status on session start and updates your local config when it sees the container has been claimed.

## Plugin structure

```
wire-memory/
├── .claude-plugin/plugin.json    # Claude Code manifest
├── .cursor-plugin/plugin.json    # Cursor manifest
├── .mcp.json                     # MCP server config (placeholder until connected)
├── skills/
│   ├── wire-memory/SKILL.md            # Teaches agent when to read/write memory
│   ├── wire-connect/
│   │   ├── SKILL.md                    # /wire-connect
│   │   └── scripts/connect.mjs         # Nonce auth flow
│   ├── wire-claim/
│   │   ├── SKILL.md                    # /wire-claim
│   │   └── scripts/claim.mjs           # Claim ephemeral container
│   ├── wire-status/
│   │   ├── SKILL.md                    # /wire-status
│   │   └── scripts/status.mjs          # Connection info
│   ├── wire-disconnect/
│   │   ├── SKILL.md                    # /wire-disconnect
│   │   └── scripts/disconnect.mjs      # Cleanup
│   └── wire-configure/SKILL.md         # /wire-configure (reads config.json directly)
├── rules/                              # Cursor rules (.mdc)
│   ├── wire-memory-search.mdc          # When to search memory
│   ├── wire-memory-write.mdc           # When to write memory
│   └── wire-memory-ephemeral.mdc       # Ephemeral container warnings
├── hooks/
│   ├── hooks.json                      # Claude Code hooks (eval, transcript capture)
│   └── hooks-cursor.json               # Cursor hooks (session start context)
├── scripts/                            # Hook-invoked scripts (plugin-root)
│   ├── eval-hook.mjs                   # Claude Code: prompts memory check on each interaction
│   ├── eval-cursor                     # Cursor: writes session context file on start
│   ├── transcript-upload.mjs           # Claude Code: upload transcripts via REST
│   ├── configure.mjs                   # Transcript-capture config helper
│   └── redact.mjs                      # Secret redaction (~20 patterns)
├── package.json
└── LICENSE
```

Zero dependencies. Plain Node.js built-ins only.

## Requirements

- Node.js >= 18
- Claude Code or Cursor
- No Wire account required. The connect flow offers a free ephemeral container for 7 days. Create an account anytime to keep it permanently.

## Privacy and security

- Credentials stored locally at `~/.wire-memory/config.json` with owner-only permissions (0o600)
- `.mcp.json` marked `--skip-worktree` after connect to prevent accidental commits of your API key
- All data stored in your Wire container. You own it, you control access.
- API key is scoped to your specific container
- Transcript capture is disabled by default. Opt-in only via `/wire-configure`. Claude Code only.
- Transcripts are redacted for secrets before upload. Covers ~20 patterns including API keys, tokens, passwords, connection strings, and private keys.

## License

MIT, [Superloops LLC](https://usewire.io)
