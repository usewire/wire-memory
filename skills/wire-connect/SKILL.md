---
name: wire-connect
description: Connect Wire memory to this agent. Authenticates via browser and registers your Wire container's MCP tools.
---

# Connect Wire Memory

Run `scripts/connect.mjs` from the wire-memory plugin directory.

After the script completes, tell the user to restart their editor so the MCP tools become available. Once restarted, they'll have access to: `wire_write`, `wire_search`, `wire_explore`, `wire_analyze`, and `wire_delete`.

**Important:** Only run the script ONCE. Do not re-run it even if the output looks unusual.
