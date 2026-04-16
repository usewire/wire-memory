#!/usr/bin/env node

import { writeFile, rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const CONFIG_DIR = join(homedir(), '.wire-memory');

// This script lives at skills/wire-disconnect/scripts/ — plugin root is three levels up.
const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');
const MCP_JSON_FILE = join(PLUGIN_ROOT, '.mcp.json');

async function main() {
  // Remove config directory
  if (existsSync(CONFIG_DIR)) {
    await rm(CONFIG_DIR, { recursive: true });
    console.log('Removed ~/.wire-memory/');
  } else {
    console.log('Wire Memory is not connected — nothing to remove.');
  }

  // Reset .mcp.json to placeholder
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
  console.log('Run /wire-connect to reconnect.');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
