#!/usr/bin/env node

/**
 * Interactive configuration for Wire Memory.
 *
 * Prompts the user to enable/disable transcript capture and set preferences.
 * Updates ~/.wire-memory/config.json in place.
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const CONFIG_FILE = join(homedir(), '.wire-memory', 'config.json');

function createPrompt() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return {
    ask(question) {
      return new Promise((resolve) => rl.question(question, resolve));
    },
    close() {
      rl.close();
    },
  };
}

async function main() {
  // Check connection
  if (!existsSync(CONFIG_FILE)) {
    console.log('Wire Memory is not connected.');
    console.log('Run /wire-memory:connect first.');
    process.exit(0);
  }

  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  } catch {
    console.log('Config file is corrupted. Run /wire-memory:connect to reconnect.');
    process.exit(1);
  }

  const prompt = createPrompt();

  console.log('');
  console.log('Wire Memory Configuration');
  console.log('─────────────────────────');
  console.log(`✓ Connected to container "${config.container_name}"`);
  console.log('');

  // ── Transcript Capture ────────────────────────────────────────────────────

  // Detect platform — Cursor does not provide transcript file access to hooks
  const isCursor = !!process.env.CURSOR_PLUGIN_ROOT;

  let enabled;
  let hooks;
  let minTurns;

  if (isCursor) {
    console.log('Transcript Capture');
    console.log('  Not available on Cursor.');
    console.log('  (Cursor does not provide transcript file access to hooks.)');
    console.log('');

    enabled = false;
    hooks = [];
    minTurns = 4;
  } else {
    const currentEnabled = config.transcripts?.enabled || false;
    const currentHooks = config.transcripts?.hooks || ['PreCompact', 'Stop'];
    const currentMinTurns = config.transcripts?.minTurns || 4;

    console.log('Transcript Capture');
    console.log('  Automatically upload session transcripts to your Wire container.');
    console.log('  Secrets are redacted before upload. Tool results are stripped.');
    if (currentEnabled) {
      console.log(`  Currently: enabled (${currentHooks.join(', ')}, min ${currentMinTurns} turns)`);
    } else {
      console.log('  Currently: disabled');
    }
    console.log('');

    const enableAnswer = await prompt.ask(
      `  Enable transcript capture? [${currentEnabled ? 'Y/n' : 'y/N'}]: `
    );
    enabled =
      enableAnswer.trim().toLowerCase() === 'y' ||
      (enableAnswer.trim() === '' && currentEnabled);

    hooks = currentHooks;
    minTurns = currentMinTurns;

    if (enabled) {
      console.log('');
      console.log('  When to capture:');
      console.log('  [1] Before compaction + end of session (recommended)');
      console.log('  [2] Before compaction only');
      console.log('  [3] End of session only');
      console.log('');

      const defaultChoice =
        currentHooks.includes('PreCompact') && currentHooks.includes('Stop')
          ? '1'
          : currentHooks.includes('PreCompact')
            ? '2'
            : '3';

      const hookChoice = await prompt.ask(`  Choice [${defaultChoice}]: `);
      const choice = hookChoice.trim() || defaultChoice;

      switch (choice) {
        case '1':
          hooks = ['PreCompact', 'Stop'];
          break;
        case '2':
          hooks = ['PreCompact'];
          break;
        case '3':
          hooks = ['Stop'];
          break;
        default:
          hooks = ['PreCompact', 'Stop'];
      }

      console.log('');
      const minAnswer = await prompt.ask(
        `  Minimum session length in turns [${currentMinTurns}]: `
      );
      minTurns = parseInt(minAnswer.trim(), 10) || currentMinTurns;
      if (minTurns < 1) minTurns = 1;
    }
  }

  prompt.close();

  // ── Save config ────────────────────────────────────────────────────────

  config.transcripts = {
    enabled,
    hooks,
    minTurns,
  };

  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });

  console.log('');
  if (enabled) {
    console.log(`✓ Transcript capture: enabled`);
    console.log(`  Hooks: ${hooks.join(', ')}`);
    console.log(`  Min turns: ${minTurns}`);
  } else {
    console.log('✓ Transcript capture: disabled');
  }
  console.log(`  Config saved to ${CONFIG_FILE}`);
  console.log('');
}

main().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});
