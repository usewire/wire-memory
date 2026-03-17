#!/usr/bin/env node

import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const CONFIG_DIR = join(homedir(), '.wire-memory');

async function main() {
  // Remove config directory (includes config.json and env file)
  if (existsSync(CONFIG_DIR)) {
    await rm(CONFIG_DIR, { recursive: true });
    console.log('Removed ~/.wire-memory/');
  } else {
    console.log('Wire Memory is not connected — nothing to remove.');
  }

  console.log('\nDisconnected. Restart Claude Code to deactivate Wire memory tools.');
  console.log('Run /wire-memory:connect to reconnect.');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
