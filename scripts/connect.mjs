#!/usr/bin/env node

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const API_BASE = 'https://app.usewire.io';
const CONNECT_PAGE = `${API_BASE}/plugin/connect`;
const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

// Plugin root is one level up from scripts/
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..');
const MCP_JSON_FILE = join(PLUGIN_ROOT, '.mcp.json');

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open' :
    platform === 'win32' ? 'start' :
    'xdg-open';
  const child = execFile(cmd, [url], (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit:\n${url}`);
    }
  });
  child.unref();
}

async function pollForResult(nonce) {
  const startTime = Date.now();

  while (Date.now() - startTime < POLL_TIMEOUT_MS) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/plugin/poll?nonce=${nonce}`);
      const data = await res.json();

      if (data.status === 'ready') {
        return data;
      }

      if (data.status === 'expired') {
        throw new Error('Connection session expired. Please try again.');
      }

      // Still pending -- wait and retry
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    } catch (err) {
      if (err.message.includes('expired')) throw err;
      // Network error -- wait and retry
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }

  throw new Error('Connection timed out after 5 minutes. Please try again.');
}

async function saveConfig(data) {
  await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });

  // Save config for status/disconnect commands
  const config = {
    mcp_endpoint: data.mcp_endpoint,
    api_key: data.api_key,
    container_id: data.container_id,
    container_name: data.container_name,
    connected_at: new Date().toISOString(),
    is_ephemeral: data.is_ephemeral ?? false,
    created_at: data.created_at ?? null,
  };

  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });

  // Write actual values into the plugin's .mcp.json
  const mcpConfig = {
    'wire-memory': {
      type: 'http',
      url: data.mcp_endpoint,
      headers: {
        'x-api-key': data.api_key,
      },
    },
  };

  await writeFile(MCP_JSON_FILE, JSON.stringify(mcpConfig, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

async function main() {
  console.log('Wire Memory - connecting to Wire...\n');

  // 1. Generate nonce
  const nonce = randomBytes(24).toString('hex');

  // 2. Register nonce with Wire
  const connectRes = await fetch(`${API_BASE}/api/v1/plugin/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nonce,
      app_name: 'Wire Memory',
      scopes: ['read', 'write'],
    }),
  });

  if (!connectRes.ok) {
    const err = await connectRes.json().catch(() => ({}));
    throw new Error(
      `Failed to start connection: ${err?.error?.message || connectRes.statusText}`
    );
  }

  // 3. Open browser to connect page
  const connectUrl = `${CONNECT_PAGE}?nonce=${nonce}`;
  console.log('Opening browser to authenticate...');
  console.log(`If the browser doesn't open, visit:\n${connectUrl}\n`);
  openBrowser(connectUrl);

  // 4. Poll for result
  console.log('Waiting for you to select a container...');
  const result = await pollForResult(nonce);

  // 5. Save config + update .mcp.json
  await saveConfig(result);

  console.log('\nConnected successfully!');
  console.log(`  Container: ${result.container_name}`);
  console.log(`  Endpoint:  ${result.mcp_endpoint}`);

  if (result.is_ephemeral && result.created_at) {
    const createdAt = new Date(result.created_at);
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    console.log('');
    console.log(`  ⚠ Ephemeral container. Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString()}).`);
    console.log('  Run /wire-claim to create an account and keep it permanently.');
  }

  console.log('');
  console.log('Restart Claude Code to activate Wire memory tools.');
  console.log('Run /wire-configure to set up transcript capture.');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
