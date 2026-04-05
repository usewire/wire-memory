---
name: wire-claim
description: Claim an ephemeral Wire memory container to make it permanent. Opens a browser to create an account.
---

# Claim Wire Memory Container

Run `scripts/claim.mjs` from the wire-memory plugin directory.

After the script opens the browser, the user should create an account and complete the onboarding flow. Once done, the container is permanently linked to their account.

If the container is already claimed, the script will update the local config and confirm.
