#!/usr/bin/env node

// Self-heal MCP config on session start.
//
// Claude Code and Cursor install each plugin version to a new directory. On update,
// the placeholder .mcp.json shipped in the repo replaces the user's real connection
// values. Codex registers MCP via ~/.codex/config.toml, separate from the plugin.
// Persistent config lives in ~/.wire-memory/config.json (written by connect.mjs and
// safe across plugin updates); this hook re-applies it to whichever surfaces exist.
//
// Invoked via SessionStart (Claude Code) and sessionStart (Cursor) hooks.
// On Codex, requires [features].plugin_hooks = true in ~/.codex/config.toml.
//
// Silent on no-op. Any error is caught and swallowed — this hook must never break a session.

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { writeCodexMcpConfig } from './codex-config.mjs';

const CONFIG_FILE = join(homedir(), '.wire-memory', 'config.json');
const PLUGIN_ROOT =
  process.env.CLAUDE_PLUGIN_ROOT ||
  process.env.CURSOR_PLUGIN_ROOT ||
  process.env.PLUGIN_ROOT;

async function healPluginMcpJson(config) {
  if (!PLUGIN_ROOT) return;
  const mcpPath = join(PLUGIN_ROOT, '.mcp.json');
  if (!existsSync(mcpPath)) return;
  const mcp = JSON.parse(await readFile(mcpPath, 'utf-8'));
  const entry = mcp['wire-memory'];
  if (!entry || entry.url !== 'NOT_CONNECTED') return;
  mcp['wire-memory'] = {
    type: 'http',
    url: config.mcp_endpoint,
    headers: { 'x-api-key': config.api_key },
  };
  await writeFile(mcpPath, JSON.stringify(mcp, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

async function main() {
  if (!existsSync(CONFIG_FILE)) return;

  const config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  if (!config.mcp_endpoint || !config.api_key) return;

  await healPluginMcpJson(config);
  await writeCodexMcpConfig(config.mcp_endpoint, config.api_key);
}

main().catch(() => {
  // Silent — never break a session
});
