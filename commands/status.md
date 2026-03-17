---
description: Show Wire memory connection status and container info
allowed-tools: [Bash]
---

# Wire Memory Status

Check the current connection:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/status.mjs
```

If not connected, suggest running `/wire-memory:connect`.
