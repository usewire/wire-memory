---
description: Disconnect Wire memory and remove stored credentials
allowed-tools: [Bash]
---

# Disconnect Wire Memory

Remove the Wire memory connection and clean up credentials:

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/disconnect.mjs
```

This removes stored API keys, config, and environment variables. The user will need to run `/wire-memory:connect` again to reconnect.
