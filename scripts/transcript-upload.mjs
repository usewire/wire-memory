#!/usr/bin/env node

/**
 * Transcript upload hook for Wire Memory.
 *
 * Registered for PreCompact and Stop hook events in Claude Code.
 * Reads the session transcript JSONL, filters out tool_result lines,
 * redacts secrets, and uploads to the Wire container via REST API.
 *
 * IMPORTANT: This script must NEVER exit with code 2 (blocking error).
 * All failures are logged to stderr and exit 0 to avoid interfering with Claude.
 *
 * Zero dependencies — Node.js built-ins only.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { redactSecrets } from './redact.mjs';

const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const TRACKING_FILE = join(CONFIG_DIR, 'transcripts.json');
const TRACKING_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function main() {
  // 1. Read hook input from stdin
  let input;
  try {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    input = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
  } catch {
    // No stdin or invalid JSON — nothing to do
    process.exit(0);
  }

  const {
    session_id: sessionId,
    transcript_path: transcriptPath,
    hook_event_name: hookEvent,
    cwd,
  } = input;

  if (!sessionId || !transcriptPath) {
    process.exit(0);
  }

  // 2. Check config — exit immediately if transcripts not enabled
  if (!existsSync(CONFIG_FILE)) {
    process.exit(0);
  }

  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  } catch {
    process.exit(0);
  }

  if (!config.transcripts?.enabled) {
    process.exit(0);
  }

  // Check if this hook type is enabled
  const enabledHooks = config.transcripts.hooks || ['PreCompact', 'Stop'];
  if (!enabledHooks.includes(hookEvent)) {
    process.exit(0);
  }

  // 3. Dedup check
  const tracking = await loadTracking();
  const minTurns = config.transcripts.minTurns || 4;
  const sessionShort = sessionId.slice(0, 8);

  if (hookEvent === 'Stop') {
    // Skip if PreCompact already captured for this session
    const hasPreCompact = tracking.uploads.some(
      (u) => u.sessionId === sessionId && u.hook === 'PreCompact' && !u.skipped
    );
    if (hasPreCompact) {
      tracking.uploads.push({
        sessionId,
        hook: 'Stop',
        skipped: true,
        reason: 'precompact_exists',
        at: new Date().toISOString(),
      });
      await saveTracking(tracking);
      process.exit(0);
    }
  }

  // 4. Read transcript JSONL
  let rawTranscript;
  try {
    rawTranscript = await readFile(transcriptPath, 'utf-8');
  } catch (err) {
    console.error(`[wire-memory] Failed to read transcript: ${err.message}`);
    process.exit(0);
  }

  // 5. Filter: keep only human and assistant lines, strip tool_result
  const lines = rawTranscript.split('\n').filter((line) => {
    if (!line.trim()) return false;
    try {
      const obj = JSON.parse(line);
      // Keep human and assistant messages, skip tool_result and other types
      return obj.type === 'human' || obj.type === 'assistant';
    } catch {
      return false; // Skip malformed lines
    }
  });

  if (lines.length === 0) {
    process.exit(0);
  }

  // Count user turns for minimum threshold
  const userTurns = lines.filter((line) => {
    try {
      return JSON.parse(line).type === 'human';
    } catch {
      return false;
    }
  }).length;

  if (hookEvent === 'Stop' && userTurns < minTurns) {
    tracking.uploads.push({
      sessionId,
      hook: 'Stop',
      skipped: true,
      reason: `below_min_turns (${userTurns}/${minTurns})`,
      at: new Date().toISOString(),
    });
    await saveTracking(tracking);
    process.exit(0);
  }

  // 6. Redact secrets line-by-line
  const redactedLines = lines.map((line) => redactSecrets(line));
  const filteredJsonl = redactedLines.join('\n') + '\n';

  // 7. Build REST upload URL
  const restBase = config.mcp_endpoint.replace(/\/mcp$/, '');
  const uploadUrl = `${restBase}/files`;

  // 8. Build file name
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const trigger = hookEvent === 'PreCompact' ? 'precompact' : 'stop';

  // Check for duplicate compactions in same session (append counter)
  const existingForTrigger = tracking.uploads.filter(
    (u) => u.sessionId === sessionId && u.hook === hookEvent && !u.skipped
  ).length;
  const suffix = existingForTrigger > 0 ? `-${existingForTrigger + 1}` : '';
  const fileName = `transcript-${date}-${sessionShort}-${trigger}${suffix}.jsonl`;

  // 9. Upload via REST
  try {
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([filteredJsonl], { type: 'application/jsonl' }),
      fileName
    );

    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'x-api-key': config.api_key },
      body: formData,
      signal: AbortSignal.timeout(30_000), // 30s timeout
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(
        `[wire-memory] Transcript upload failed: ${res.status} ${body.slice(0, 200)}`
      );
      process.exit(0);
    }
  } catch (err) {
    console.error(`[wire-memory] Transcript upload error: ${err.message}`);
    process.exit(0);
  }

  // 10. Update tracking
  tracking.uploads.push({
    sessionId,
    hook: hookEvent,
    turns: userTurns,
    fileName,
    project: basename(cwd || ''),
    uploadedAt: new Date().toISOString(),
  });
  await saveTracking(tracking);
}

// ─── Tracking helpers ─────────────────────────────────────────────────────────

async function loadTracking() {
  try {
    if (existsSync(TRACKING_FILE)) {
      const data = JSON.parse(await readFile(TRACKING_FILE, 'utf-8'));
      // Auto-prune entries older than 7 days
      const cutoff = Date.now() - TRACKING_MAX_AGE_MS;
      data.uploads = (data.uploads || []).filter(
        (u) => new Date(u.uploadedAt || u.at || 0).getTime() > cutoff
      );
      return data;
    }
  } catch {
    // Corrupt file — start fresh
  }
  return { uploads: [] };
}

async function saveTracking(data) {
  try {
    await mkdir(CONFIG_DIR, { recursive: true, mode: 0o700 });
    await writeFile(TRACKING_FILE, JSON.stringify(data, null, 2), {
      encoding: 'utf-8',
      mode: 0o600,
    });
  } catch {
    // Non-critical — tracking is best-effort
  }
}

main().catch((err) => {
  console.error(`[wire-memory] Unexpected error: ${err.message}`);
  process.exit(0); // Never block Claude
});
