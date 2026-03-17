---
description: Claim an ephemeral Wire memory container to make it permanent. Opens a browser to create an account.
allowed-tools: [Bash]
---

# Claim Wire Memory Container

Run the claim script to convert an ephemeral container into a permanent one.

```bash
node ${CLAUDE_PLUGIN_ROOT}/scripts/claim.mjs
```

After the script opens the browser, the user should create an account and complete the onboarding flow. Once done, the container is permanently linked to their account.

If the container is already claimed, the script will update the local config and confirm.
