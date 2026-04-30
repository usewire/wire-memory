#!/usr/bin/env node

/**
 * Disconnect Wire Memory.
 *
 * Two-step: tell the server first (revokes the apiKey + soft-revokes the
 * connection row so it stops showing on the dashboard), then clear the
 * connection metadata locally. The server call is best-effort — if the
 * network is down we still clear local state so the user isn't stuck.
 *
 * device-key.json is intentionally PRESERVED. The Ed25519 keypair is the
 * install identity; keeping it means the next /wire-connect reuses the
 * same credentialId on the server instead of creating a fresh row each
 * cycle. Use a future /wire-reset (not yet implemented) to nuke the
 * device key entirely.
 */
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { WireClient } from '@usewire/sdk';

const APP_ID = 'wire-memory';
const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');
const MCP_JSON_FILE = join(PLUGIN_ROOT, '.mcp.json');

async function readApiKey() {
  try {
    const raw = await readFile(CONFIG_FILE, 'utf-8');
    const config = JSON.parse(raw);
    return typeof config.api_key === 'string' ? config.api_key : null;
  } catch {
    return null;
  }
}

async function main() {
  if (!existsSync(CONFIG_FILE)) {
    console.log('Wire Memory is not connected — nothing to do.');
    return;
  }

  const apiKey = await readApiKey();
  if (apiKey) {
    try {
      const client = new WireClient({ appId: APP_ID });
      await client.disconnect(apiKey);
      console.log('Revoked server-side connection.');
    } catch (err) {
      console.warn(
        `Could not revoke server-side connection: ${err.message}.`
      );
      console.warn('Local state will still be cleared.');
    }
  }

  await unlink(CONFIG_FILE).catch(() => {});

  const mcpConfig = {
    'wire-memory': {
      type: 'http',
      url: 'NOT_CONNECTED',
      headers: {
        'x-api-key': 'NOT_CONNECTED',
      },
    },
  };
  await writeFile(MCP_JSON_FILE, JSON.stringify(mcpConfig, null, 2), 'utf-8');

  console.log('\nDisconnected. Restart Claude Code to deactivate Wire memory tools.');
  console.log('Run /wire-connect to reconnect (your install identity is preserved).');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
