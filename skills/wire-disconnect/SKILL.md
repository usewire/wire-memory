---
name: wire-disconnect
description: Disconnect Wire memory and remove stored credentials
---

# Disconnect Wire Memory

Locate and run the disconnect script with the Bash tool. The script is at `scripts/disconnect.mjs` inside this skill's own directory (`skills/wire-disconnect/scripts/disconnect.mjs` within the installed wire-memory plugin). The Bash tool's working directory may not be the skill directory — resolve to an absolute path before invoking:

```bash
SCRIPT="$(find ~/.claude/plugins ~/.cursor/plugins -path '*wire-memory*/skills/wire-disconnect/scripts/disconnect.mjs' -print -quit 2>/dev/null)"
node "$SCRIPT"
```

This removes stored API keys, config, and environment variables. The user will need to run /wire-connect again to reconnect.
