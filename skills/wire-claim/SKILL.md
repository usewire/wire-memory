---
name: wire-claim
description: Claim an ephemeral Wire memory container to make it permanent. Opens a browser to create an account.
---

# Claim Wire Memory Container

Locate and run the claim script with the Bash tool. The script is at `scripts/claim.mjs` inside this skill's own directory (`skills/wire-claim/scripts/claim.mjs` within the installed wire-memory plugin). The Bash tool's working directory may not be the skill directory — resolve to an absolute path before invoking:

```bash
SCRIPT="$(find ~/.claude/plugins ~/.cursor/plugins -path '*wire-memory*/skills/wire-claim/scripts/claim.mjs' -print -quit 2>/dev/null)"
node "$SCRIPT"
```

After the script opens the browser, the user should create an account and complete the onboarding flow. Once done, the container is permanently linked to their account.

If the container is already claimed, the script will update the local config and confirm.
