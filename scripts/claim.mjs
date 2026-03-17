#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';

const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

function openBrowser(url) {
  const platform = process.platform;
  const cmd =
    platform === 'darwin' ? 'open' :
    platform === 'win32' ? 'start' :
    'xdg-open';
  execFile(cmd, [url], (err) => {
    if (err) {
      console.log(`Could not open browser automatically. Visit:\n${url}`);
    }
  });
}

async function main() {
  if (!existsSync(CONFIG_FILE)) {
    console.log('Wire Memory is not connected.');
    console.log('Run /wire-memory:connect first.');
    process.exit(1);
  }

  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));

  if (config.is_ephemeral === false) {
    console.log('This container is already claimed (permanent). No action needed.');
    process.exit(0);
  }

  // Derive REST base URL from MCP endpoint
  // e.g. https://slug.mcp.usewire.io/container/:id/mcp → https://slug.mcp.usewire.io/container/:id/claim
  const restUrl = config.mcp_endpoint.replace(/\/mcp$/, '/claim');

  console.log('Requesting claim URL...');

  const res = await fetch(restUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.api_key,
    },
  });

  if (res.status === 409) {
    // Already claimed -- update config and exit
    console.log('This container has already been claimed. Updating local config...');
    config.is_ephemeral = false;
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
    console.log('Done. Your container is permanent.');
    process.exit(0);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `Failed to claim container (HTTP ${res.status})`);
  }

  const { data } = await res.json();

  console.log('\nOpening browser to create your account...');
  console.log(`If the browser doesn't open, visit:\n${data.claim_url}\n`);
  openBrowser(data.claim_url);

  console.log('After creating your account, your container will be permanent.');
  console.log('The next time you use Wire Memory, it will auto-detect the change.');
}

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  process.exit(1);
});
