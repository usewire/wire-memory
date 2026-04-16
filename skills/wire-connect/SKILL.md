---
name: wire-connect
description: Connect Wire memory to this agent. Authenticates via browser and registers your Wire container's MCP tools.
---

# Connect Wire Memory

Locate and run the connect script with the Bash tool. The script is at `scripts/connect.mjs` inside this skill's own directory (`skills/wire-connect/scripts/connect.mjs` within the installed wire-memory plugin). The Bash tool's working directory may not be the skill directory — resolve to an absolute path before invoking:

```bash
SCRIPT="$(find ~/.claude/plugins ~/.cursor/plugins -path '*wire-memory*/skills/wire-connect/scripts/connect.mjs' -print -quit 2>/dev/null)"
node "$SCRIPT"
```

If `$SCRIPT` comes back empty, the plugin isn't installed in a standard location — fall back to locating `skills/wire-connect/scripts/connect.mjs` anywhere under the plugin install path you can identify from the current session.

After the script completes, tell the user to restart their editor so the MCP tools become available. Once restarted, they'll have access to: `wire_write`, `wire_search`, `wire_explore`, `wire_analyze`, and `wire_delete`.

**Important:** Once the script has successfully completed (container selected, `.mcp.json` written), do not re-run it — a second run will reset the connection. However, if the script errors before reaching the "Connected" message (for example, `MODULE_NOT_FOUND`, network failure, or browser didn't open), it's safe to diagnose the cause and retry.
