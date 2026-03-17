---
description: Configure Wire memory settings (transcript capture, etc.)
allowed-tools: [Read, Edit]
---

# Configure Wire Memory

## 1. Read current config

Read `~/.wire-memory/config.json`. If it doesn't exist, tell the user to run `/wire-memory:connect` first and stop.

## 2. Show current settings and ask what to change

Display the current transcript capture settings:

- **Enabled:** true/false
- **Hooks:** which events trigger capture (PreCompact, Stop, or both)
- **Min turns:** minimum session length before capturing

Then ask the user what they'd like to change. Present these options clearly:

### Transcript capture

> **Enable transcript capture?**
> Automatically uploads session transcripts to your Wire container. Secrets are redacted before upload. Tool results are stripped.
>
> - **Yes** — enable
> - **No** — disable

If enabling, also ask:

> **When to capture?**
> - Before compaction + end of session (recommended)
> - Before compaction only
> - End of session only

> **Minimum session length in turns?** (default: 4)

## 3. Update config

After the user responds, update `~/.wire-memory/config.json` using the Edit tool. The `transcripts` key should look like:

```json
{
  "transcripts": {
    "enabled": true,
    "hooks": ["PreCompact", "Stop"],
    "minTurns": 4
  }
}
```

## 4. Confirm

Show the user what was saved. Changes take effect immediately — no restart needed.
