#!/usr/bin/env node

/**
 * Connect Wire Memory to a Wire container (SUP-606).
 *
 * The SDK is stateless. wire-memory persists what it needs:
 *   ~/.wire-memory/device-key.json   — Ed25519 keypair (mode 0600)
 *   ~/.wire-memory/config.json       — Connection metadata for status/disconnect
 *   <plugin-root>/.mcp.json          — MCP entry consumed by Claude Code/Cursor
 *   ~/.codex/config.toml             — [mcp_servers.wire-memory] block for Codex (if installed)
 */
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WireClient } from '../../../vendor/usewire-sdk.mjs';
import { writeCodexMcpConfig } from '../../../scripts/codex-config.mjs';

const APP_ID = 'wire-memory';
const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEVICE_KEY_FILE = join(CONFIG_DIR, 'device-key.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');
const MCP_JSON_FILE = join(PLUGIN_ROOT, '.mcp.json');

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function writeSecret(path, data) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  await writeFile(path, JSON.stringify(data, null, 2), {
    encoding: 'utf-8',
    mode: 0o600,
  });
}

async function persistConnection(connection) {
  // device-key.json — preserved across reconnects so the same install
  // keeps the same credentialId on the server.
  await writeSecret(DEVICE_KEY_FILE, connection.deviceKey);

  // config.json — existing format kept stable so wire-status,
  // wire-disconnect, and wire-configure keep working unchanged.
  await writeSecret(CONFIG_FILE, {
    mcp_endpoint: connection.mcpUrl,
    api_key: connection.apiKey,
    container_id: connection.containerId,
    container_name: connection.containerName,
    connected_at: connection.connectedAt.toISOString(),
    is_ephemeral: Boolean(connection.expiresAt),
    created_at: connection.expiresAt
      ? new Date(connection.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
      : null,
    app_id: connection.appId,
    credential_id: connection.credentialId,
    org_slug: connection.orgSlug,
    expires_at: connection.expiresAt?.toISOString() ?? null,
    label: connection.label,
  });

  await writePluginMcpFiles(connection.mcpUrl, connection.apiKey);
}

async function writePluginMcpFiles(mcpUrl, apiKey) {
  await writeSecret(MCP_JSON_FILE, {
    'wire-memory': {
      type: 'http',
      url: mcpUrl,
      headers: { 'x-api-key': apiKey },
    },
  });

  // Codex registers MCP servers only via ~/.codex/config.toml [mcp_servers.*].
  // Per-plugin mcp.json files are ignored. Skip silently if Codex isn't installed.
  await writeCodexMcpConfig(mcpUrl, apiKey);
}

async function main() {
  console.log('Wire Memory - connecting to Wire...\n');

  const existingConfig = await readJsonOrNull(CONFIG_FILE);
  if (existingConfig?.api_key && existingConfig?.mcp_endpoint) {
    // Already connected globally (e.g. from a prior install in another host).
    // Rehydrate this plugin's MCP files from the existing config so the local
    // host registers the MCP server without forcing a disconnect/reconnect.
    await writePluginMcpFiles(existingConfig.mcp_endpoint, existingConfig.api_key);
    console.log('Already connected — refreshed local MCP config.');
    console.log(`  Container: ${existingConfig.container_name}`);
    console.log(`  Endpoint:  ${existingConfig.mcp_endpoint}`);
    console.log('\nRestart your editor to activate Wire memory tools.');
    console.log('Run /wire-disconnect first if you want to switch containers.');
    return;
  }

  // Reuse the device key if one exists from a prior install — keeps the
  // same credentialId on the server across reconnects.
  const existingDeviceKey = await readJsonOrNull(DEVICE_KEY_FILE);

  const client = new WireClient({
    appId: APP_ID,
    deviceKey: existingDeviceKey ?? undefined,
  });

  const connection = await client.connect({
    label: `${process.env.USER ?? 'unknown'}@${process.env.HOSTNAME ?? process.platform}`,
    onUserPrompt: ({ code, url }) => {
      console.log('');
      console.log(`Your code:  ${code}`);
      console.log(`Open:       ${url}`);
      console.log('');
      console.log('Type the code on the connect screen to authorize this device.');
      console.log('Opening your browser...');
      // Best-effort browser open; the URL is already printed.
      const platform = process.platform;
      const cmd =
        platform === 'darwin' ? 'open' :
        platform === 'win32' ? 'start' :
        'xdg-open';
      const child = execFile(cmd, [url], () => {});
      child.unref();
    },
  });

  await persistConnection(connection);

  console.log('\nConnected successfully!');
  console.log(`  Container: ${connection.containerName}`);
  console.log(`  Endpoint:  ${connection.mcpUrl}`);

  if (connection.expiresAt) {
    const daysLeft = Math.max(
      0,
      Math.ceil((connection.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    );
    console.log('');
    console.log(
      `  ⚠ Ephemeral container. Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${connection.expiresAt.toLocaleDateString()}).`
    );
    console.log('  Run /wire-claim to create an account and keep it permanently.');
  }

  console.log('');
  console.log('Restart Claude Code to activate Wire memory tools.');
  console.log('Run /wire-configure to set up transcript capture.');
}

main().catch(async (err) => {
  console.error(`\nError: ${err.message}`);
  if (err.code) console.error(`  Code: ${err.code}`);
  process.exit(1);
});
