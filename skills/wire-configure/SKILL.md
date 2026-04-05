---
name: wire-configure
description: Configure Wire memory settings (transcript capture, etc.)
---

# Configure Wire Memory

Read `~/.wire-memory/config.json`. If it doesn't exist, tell the user to run /wire-connect first and stop.

Display the current transcript capture settings:

- **Enabled:** true/false
- **Hooks:** which events trigger capture (PreCompact, Stop, or both)
- **Min turns:** minimum session length before capturing

Ask the user what they'd like to change:

- **Enable/disable transcript capture** - automatically uploads session transcripts to the Wire container. Secrets are redacted, tool results are stripped.
- **When to capture** - before compaction + end of session (recommended), before compaction only, or end of session only
- **Minimum session length** in turns (default: 4)

**Note:** Transcript capture is only available on Claude Code. Cursor does not provide transcript file access to hooks.

Update `~/.wire-memory/config.json` with the new settings. The `transcripts` key should look like:

```json
{
  "transcripts": {
    "enabled": true,
    "hooks": ["PreCompact", "Stop"],
    "minTurns": 4
  }
}
```

Show the user what was saved. Changes take effect immediately.
