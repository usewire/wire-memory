#!/usr/bin/env node

/**
 * Connect Wire Memory to a Wire container (SUP-606).
 *
 * Migrated to @wire/sdk: the SDK handles Ed25519 keypair generation,
 * signed JWT bootstrap of /api/v1/sdk/connect, browser open + 2s/5min
 * poll, and apiKey + connection persistence.
 *
 * wire-memory provides PluginDataStore — a CredentialsStore that maps
 * the SDK's interface onto our existing files (~/.wire-memory/config.json
 * + plugin .mcp.json) so wire-status / wire-disconnect / wire-configure
 * keep working unchanged.
 */
import { readFile, mkdir, writeFile, unlink } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { WireClient } from '@wire/sdk';

const APP_ID = 'wire-memory';
const API_BASE = process.env.WIRE_API_BASE ?? 'https://app.usewire.io';
const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const DEVICE_KEY_FILE = join(CONFIG_DIR, 'device-key.json');

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, '..', '..', '..');
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

async function readJsonOrNull(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * PluginDataStore — implements CredentialsStore against wire-memory's
 * existing files. Keeps the file format stable so the other skills
 * (status, disconnect, configure) keep working unchanged.
 *
 *   ~/.wire-memory/device-key.json   — Ed25519 keypair (mode 0600)
 *   ~/.wire-memory/config.json       — Connection metadata for status/disconnect
 *   <plugin-root>/.mcp.json          — MCP entry consumed by Claude Code/Cursor
 */
class PluginDataStore {
  async getDeviceKey() {
    return readJsonOrNull(DEVICE_KEY_FILE);
  }
  async setDeviceKey(key) {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await writeFile(DEVICE_KEY_FILE, JSON.stringify(key, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }
  async getConnection() {
    const config = await readJsonOrNull(CONFIG_FILE);
    if (!config?.api_key) return null;
    return {
      containerId: config.container_id,
      containerName: config.container_name,
      mcpUrl: config.mcp_endpoint,
      apiKey: config.api_key,
      appId: config.app_id ?? APP_ID,
      credentialId: config.credential_id ?? '',
      orgSlug: config.org_slug ?? null,
      expiresAt: config.expires_at ? new Date(config.expires_at) : null,
      connectedAt: new Date(config.connected_at),
      label: config.label,
    };
  }
  async setConnection(connection) {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });

    // Existing format kept stable for status / disconnect / configure scripts.
    const config = {
      mcp_endpoint: connection.mcpUrl,
      api_key: connection.apiKey,
      container_id: connection.containerId,
      container_name: connection.containerName,
      connected_at: connection.connectedAt.toISOString(),
      is_ephemeral: Boolean(connection.expiresAt),
      created_at: connection.expiresAt
        ? new Date(
            connection.expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000
          ).toISOString()
        : null,
      // New SDK-era fields (legacy scripts ignore unknown keys).
      app_id: connection.appId,
      credential_id: connection.credentialId,
      org_slug: connection.orgSlug,
      expires_at: connection.expiresAt?.toISOString() ?? null,
      label: connection.label,
    };
    await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });

    const mcpConfig = {
      'wire-memory': {
        type: 'http',
        url: connection.mcpUrl,
        headers: { 'x-api-key': connection.apiKey },
      },
    };
    await writeFile(MCP_JSON_FILE, JSON.stringify(mcpConfig, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  }
  async deleteConnection() {
    await unlink(CONFIG_FILE).catch(() => {});
    await unlink(MCP_JSON_FILE).catch(() => {});
  }
  async clear() {
    await this.deleteConnection();
    await unlink(DEVICE_KEY_FILE).catch(() => {});
  }
}

async function main() {
  console.log('Wire Memory - connecting to Wire...\n');

  const client = new WireClient({
    appId: APP_ID,
    credentialsStore: new PluginDataStore(),
    apiBase: API_BASE,
  });

  const existing = await client.getConnection();
  if (existing) {
    console.log('Already connected.');
    console.log(`  Container: ${existing.containerName}`);
    console.log(`  Endpoint:  ${existing.mcpUrl}`);
    console.log('\nRun /wire-disconnect first if you want to switch containers.');
    return;
  }

  const connection = await client.connect({
    label: `${process.env.USER ?? 'unknown'}@${process.env.HOSTNAME ?? process.platform}`,
    scopes: ['read', 'write'],
    onBrowserUrl: (url) => {
      console.log('Opening browser to authenticate...');
      console.log(`If the browser doesn't open, visit:\n${url}\n`);
      openBrowser(url);
      console.log('Waiting for you to select a container...');
    },
  });

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

main().catch((err) => {
  console.error(`\nError: ${err.message}`);
  if (err.code) console.error(`  Code: ${err.code}`);
  process.exit(1);
});
