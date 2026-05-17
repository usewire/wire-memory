// Edits ~/.codex/config.toml to add or remove the [mcp_servers.wire-memory] block,
// and ensures [features].plugin_hooks = true so SessionStart/UserPromptSubmit/
// PreCompact/Stop hooks shipped by the plugin actually fire.
//
// Codex's plugin system does not load MCP servers from per-plugin manifests.
// Remote MCP servers are registered globally via [mcp_servers.<name>] blocks
// in ~/.codex/config.toml. This module is the bridge between wire-memory's
// connect flow and Codex's MCP registry.
//
// Silently no-ops if Codex is not installed (config.toml missing).

import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CODEX_CONFIG_PATH = join(homedir(), '.codex', 'config.toml');
const SECTION_HEADER = '[mcp_servers.wire-memory]';

async function readConfigOrNull() {
  try {
    return await readFile(CODEX_CONFIG_PATH, 'utf-8');
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}

function stripWireMemoryBlock(content) {
  const lines = content.split('\n');
  const startIdx = lines.findIndex((l) => l.trimStart().startsWith(SECTION_HEADER));
  if (startIdx === -1) return content;

  let endIdx = lines.length;
  for (let i = startIdx + 1; i < lines.length; i += 1) {
    if (lines[i].trimStart().startsWith('[')) {
      endIdx = i;
      break;
    }
  }

  // Also drop one leading blank line that visually attached to the block.
  let dropStart = startIdx;
  if (dropStart > 0 && lines[dropStart - 1] === '') dropStart -= 1;

  lines.splice(dropStart, endIdx - dropStart);
  return lines.join('\n');
}

// Ensures [features].plugin_hooks = true is set. Idempotent:
//   - missing [features] section → appended
//   - section present, plugin_hooks missing → added under [features]
//   - section present, plugin_hooks set to non-true value → updated to true
//   - already enabled → no-op
function ensurePluginHooksEnabled(content) {
  const FEATURES_HEADER = '[features]';
  const lines = content.split('\n');
  const featuresIdx = lines.findIndex((l) => l.trim() === FEATURES_HEADER);

  if (featuresIdx === -1) {
    const trimmed = content.replace(/\n*$/, '');
    const separator = trimmed.length === 0 ? '' : '\n\n';
    return `${trimmed}${separator}${FEATURES_HEADER}\nplugin_hooks = true\n`;
  }

  let endIdx = lines.length;
  for (let i = featuresIdx + 1; i < lines.length; i += 1) {
    if (lines[i].trimStart().startsWith('[')) {
      endIdx = i;
      break;
    }
  }

  const hookIdx = lines.findIndex(
    (l, i) => i > featuresIdx && i < endIdx && /^\s*plugin_hooks\s*=/.test(l),
  );

  if (hookIdx === -1) {
    lines.splice(featuresIdx + 1, 0, 'plugin_hooks = true');
  } else if (!/=\s*true\s*$/.test(lines[hookIdx])) {
    lines[hookIdx] = 'plugin_hooks = true';
  }

  return lines.join('\n');
}

function buildBlock(mcpUrl, apiKey) {
  // wire_live_* keys and https URLs contain no double-quotes or backslashes,
  // so plain TOML string literals are sufficient. If that ever changes,
  // switch to literal strings (single-quoted) or escape per TOML spec.
  return [
    SECTION_HEADER,
    `url = "${mcpUrl}"`,
    `http_headers = { "x-api-key" = "${apiKey}" }`,
    '',
  ].join('\n');
}

export async function writeCodexMcpConfig(mcpUrl, apiKey) {
  const existing = await readConfigOrNull();
  if (existing === null) return; // Codex not installed.

  const withHooksEnabled = ensurePluginHooksEnabled(existing);
  const stripped = stripWireMemoryBlock(withHooksEnabled);
  const trimmed = stripped.replace(/\n*$/, '');
  const separator = trimmed.length === 0 ? '' : '\n\n';
  const next = `${trimmed}${separator}${buildBlock(mcpUrl, apiKey)}`;
  await writeFile(CODEX_CONFIG_PATH, next, 'utf-8');
}

export async function removeCodexMcpConfig() {
  const existing = await readConfigOrNull();
  if (existing === null) return;

  const stripped = stripWireMemoryBlock(existing);
  if (stripped === existing) return;

  const next = stripped.replace(/\n*$/, '') + '\n';
  await writeFile(CODEX_CONFIG_PATH, next, 'utf-8');
}
