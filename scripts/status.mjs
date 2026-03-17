#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const CONFIG_FILE = join(homedir(), '.wire-memory', 'config.json');

async function main() {
  if (!existsSync(CONFIG_FILE)) {
    console.log('Wire Memory is not connected.');
    console.log('Run /wire-memory:connect to get started.');
    process.exit(0);
  }

  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));

  console.log('Wire Memory - connected');
  console.log(`  Container:    ${config.container_name}`);
  console.log(`  Container ID: ${config.container_id}`);
  console.log(`  MCP Endpoint: ${config.mcp_endpoint}`);
  console.log(`  Connected at: ${config.connected_at}`);

  if (config.is_ephemeral === true && config.created_at) {
    const createdAt = new Date(config.created_at);
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    console.log(`  Status:       Ephemeral. Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString()}).`);
    console.log('');
    console.log('  Run /wire-memory:claim to create an account and keep it permanently.');
  } else {
    console.log('  Status:       Claimed (permanent)');
  }
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
