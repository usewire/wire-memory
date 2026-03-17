---
description: Connect Wire memory to this agent. Authenticates via browser and registers your Wire container's MCP tools.
allowed-tools: [Bash]
---

# Connect Wire Memory

Run the connect script to authenticate with Wire and select a memory container.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/connect.mjs
```

After the script completes, tell the user to restart Claude Code so the MCP tools become available. Once restarted, they'll have access to: `wire_write`, `wire_search`, `wire_explore`, `wire_analyze`, and `wire_delete`.

**Important:** Only run the script ONCE. Do not re-run it even if the output looks unusual.
