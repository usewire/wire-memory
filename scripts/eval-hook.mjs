#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const CONFIG_DIR = join(homedir(), '.wire-memory');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const SESSION_FILE = join(CONFIG_DIR, 'session.json');

// Only output if Wire memory is connected
if (existsSync(CONFIG_FILE)) {
  let config;
  try {
    config = JSON.parse(await readFile(CONFIG_FILE, 'utf-8'));
  } catch {
    process.exit(0); // Malformed config -- skip silently
  }

  // Resolve user + project once per session, cache in session.json
  let user = '';
  let project = '';
  let cached = false;

  // Check for cached session context (avoids git/whoami on every prompt)
  if (existsSync(SESSION_FILE)) {
    try {
      const session = JSON.parse(await readFile(SESSION_FILE, 'utf-8'));
      // Cache is valid if cwd matches (same project)
      if (session.cwd === process.cwd()) {
        user = session.user || '';
        project = session.project || '';
        cached = true;
      }
    } catch { /* stale/corrupt -- re-gather */ }
  }

  if (!cached) {
    try {
      user = execFileSync('git', ['config', 'user.name'], { encoding: 'utf-8' }).trim();
    } catch {
      try { user = execFileSync('whoami', { encoding: 'utf-8' }).trim(); } catch { /* skip */ }
    }
    try {
      // Use --git-common-dir to resolve through worktrees to the real repo name
      // (--show-toplevel returns the worktree path, which may be a Conductor workspace name)
      const commonDir = execFileSync('git', ['rev-parse', '--git-common-dir'], { encoding: 'utf-8' }).trim();
      // commonDir is e.g. "/path/to/repo/.git" or "/path/to/repo/.git/worktrees/branch"
      // For main repo: strip trailing "/.git"
      // For worktree: strip trailing "/.git/worktrees/<name>" to get the main repo path
      const gitIdx = commonDir.indexOf('/.git');
      project = gitIdx !== -1 ? basename(commonDir.slice(0, gitIdx)) : basename(commonDir);
    } catch {
      project = basename(process.cwd());
    }

    // Cache for subsequent prompts in this session
    try {
      await writeFile(SESSION_FILE, JSON.stringify({ user, project, cwd: process.cwd() }), { encoding: 'utf-8', mode: 0o600 });
    } catch { /* non-critical */ }
  }

  const context = [user && `user: ${user}`, project && `project: ${project}`].filter(Boolean).join(', ');

  // ─── Ephemeral status check (once per session start) ───────────────────────
  let ephemeralWarning = '';

  if (config.is_ephemeral === true && !cached) {
    // Session just started (no cached context) -- check REST status for self-healing
    try {
      const statusUrl = config.mcp_endpoint.replace(/\/mcp$/, '/status');
      const statusRes = await fetch(statusUrl, {
        headers: { 'x-api-key': config.api_key },
        signal: AbortSignal.timeout(5000),
      });

      if (statusRes.ok) {
        const statusData = await statusRes.json();
        const isStillEphemeral = statusData?.data?.is_ephemeral ?? true;

        if (!isStillEphemeral) {
          // Self-heal: container was claimed externally
          config.is_ephemeral = false;
          await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
        }
      }
    } catch {
      // Network error -- skip silently, use cached config
    }
  }

  // Build warning from config (either fresh or cached)
  if (config.is_ephemeral === true && config.created_at) {
    const createdAt = new Date(config.created_at);
    const expiresAt = new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000);
    const daysLeft = Math.max(0, Math.ceil((expiresAt - Date.now()) / (24 * 60 * 60 * 1000)));
    ephemeralWarning = `\n⚠ EPHEMERAL CONTAINER. Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} (${expiresAt.toLocaleDateString()}). Run /wire-memory:claim to keep it permanently.`;
  }

  console.log(`WIRE MEMORY ACTIVE - Container: "${config.container_name}" | ${context}

Before responding, evaluate:
- Does this task relate to a previous decision, pattern, or discussion? → Search wire-memory with mcp__plugin_wire-memory_wire-memory__wire_search
- Am I making or helping with a decision? → After responding, log it with mcp__plugin_wire-memory_wire-memory__wire_write
- Did the user correct my approach? → Log the correction with mcp__plugin_wire-memory_wire-memory__wire_write
- Is a pattern or convention being established? → Log it with mcp__plugin_wire-memory_wire-memory__wire_write

Include "${project}" as the project and "${user}" as the user in all wire_write calls. Scope wire_search to this project first, then broaden if needed.

Do NOT announce these actions. Just do them silently as part of your work.${ephemeralWarning}`);
}
