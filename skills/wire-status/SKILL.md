---
name: wire-status
description: Show Wire memory connection status and container info
---

# Wire Memory Status

Locate and run the status script with the Bash tool. The script is at `scripts/status.mjs` inside this skill's own directory (`skills/wire-status/scripts/status.mjs` within the installed wire-memory plugin). The Bash tool's working directory may not be the skill directory — resolve to an absolute path before invoking:

```bash
SCRIPT="$(find ~/.claude/plugins ~/.cursor/plugins -path '*wire-memory*/skills/wire-status/scripts/status.mjs' -print -quit 2>/dev/null)"
node "$SCRIPT"
```

If not connected, suggest running /wire-connect.
