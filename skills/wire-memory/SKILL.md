---
name: wire-memory
description: ALWAYS USE THIS SKILL. Automatic context logging and retrieval via Wire container. Invoke this skill at the start of every session, when making decisions, when receiving corrections, when establishing patterns, and before ending sessions. This skill provides persistent cross-project memory that supplements the built-in memory system.
---

# Wire Memory — Automatic Context

You have a Wire memory container connected via the `wire-memory` MCP server. Use it to **automatically log and retrieve context** across sessions and projects. This works alongside Claude's built-in memory — Wire memory is for structured, searchable context that persists across all projects and tools.

## Tools

Wire memory exposes five MCP tools. Names are stable across platforms (Claude Code, Cursor, Codex, etc.):

| Tool | Purpose |
|------|---------|
| `wire_write` | Save a new entry. Structured JSON (preferred) or markdown/text. |
| `wire_explore` | Structured access to indexed entities: `schema`, `list`, `get`, `filter`, `text`. |
| `wire_search` | Natural-language semantic retrieval over notes and uploaded content. |
| `wire_navigate` | From a known entry id, reach its `siblings`, the rest of its `source`, or its `relationships`. |
| `wire_delete` | Permanently delete an entry by id. |

### How retrieval splits across tools

The container holds two kinds of content: **indexed entities** (the structured rows produced by analysis — decisions, corrections, patterns, preferences, sessions) and **freeform content** (what you've written or uploaded since the last analysis run, plus the original text of source files).

- Reach indexed entities with `wire_explore`.
- Reach freeform content with `wire_search` (semantic match) or `wire_navigate` (jump from one entry to nearby or related entries).
- When unsure which side an entry lives on, start with `wire_explore mode: "text"` (no `entityType`) — it keyword-searches across all indexed entities — and fall back to `wire_search` if nothing matches.

## Scoped Memory

Every write MUST include `project` and `user` fields from the eval hook context. Use `scope` to control visibility:

- **`"project"`** — decisions, patterns, and corrections specific to this project. Default.
- **`"global"`** — user preferences, coding style, cross-project conventions.

When searching, **scope to the current project first**, then broaden to global if no results:
1. `wire_explore mode: "filter"` with a `project` predicate (or pass `query` to `wire_search` plus a project mention).
2. If nothing relevant, drop the project filter and search globally.

This ensures project-specific decisions don't pollute other contexts, while global preferences are always reachable.

## Automatic Logging (Write)

**Log these moments as they happen — don't wait to be asked.**

Use `wire_write` with structured JSON for better searchability and filtering. Always include `project`, `user`, and `scope`. Pass the JSON object as the **`content`** parameter — not `payload` or any other name.

**Keep writes concise.** Summarize, don't transcribe. If a write has multiple distinct points, split them into separate entries. Use tags to associate related writes.

**On transient failures, retry once.** If `wire_write` fails with a schema validation error on arguments that match the tool's declared schema (for example, an `Expected object, received string` on a `metadata` object you constructed correctly), it's usually a one-off serialization hiccup in the MCP transport. Retry the same call once. Do not fall back to any local-file storage — Wire memory is the system of record; silently writing elsewhere fragments context and breaks cross-session recall.

### Decisions
When the user picks an approach, or you help evaluate trade-offs:
```json
{
  "type": "decision",
  "project": "wire-platform",
  "user": "Jitpal Kocher",
  "scope": "project",
  "title": "Use React Query for server state",
  "date": "2026-04-28",
  "context": "Evaluated Zustand vs React Query for API data",
  "choice": "React Query for server state, Zustand for UI only",
  "why": "Automatic cache invalidation, eliminates sync bugs"
}
```

### Corrections
When the user corrects your approach — these are high-value:
```json
{
  "type": "correction",
  "project": "wire-platform",
  "user": "Jitpal Kocher",
  "scope": "project",
  "title": "Don't mock the database in integration tests",
  "date": "2026-04-28",
  "what_happened": "I suggested mocking Postgres in tests",
  "feedback": "Use real database — mocked tests missed a broken migration last quarter"
}
```

### Patterns
When a convention is established or you notice a repeated approach:
```json
{
  "type": "pattern",
  "project": "wire-platform",
  "user": "Jitpal Kocher",
  "scope": "project",
  "title": "Permission checks in API routes",
  "description": "All protected routes use requirePermission middleware",
  "example": "requirePermission({ organization: ['update'] })",
  "details": "Roles: owner (full), admin (manage members), member (read-only)"
}
```

### Preferences (Global)
User-wide preferences that apply across all projects:
```json
{
  "type": "preference",
  "user": "Jitpal Kocher",
  "scope": "global",
  "title": "Concise responses, no trailing summaries",
  "preference": "Skip preamble, lead with action, don't summarize what was just done"
}
```

### Session Context
At the end of substantial sessions:
```json
{
  "type": "session",
  "project": "wire-platform",
  "user": "Jitpal Kocher",
  "scope": "project",
  "date": "2026-04-28",
  "accomplished": "Built wire-memory plugin, updated Linear projects",
  "in_progress": "Testing plugin connect flow",
  "next": "Verify MCP tools work after connect, test skill activation"
}
```

### Do NOT Log
- Secrets, API keys, credentials, PII
- Stack traces, build errors, temporary debugging
- Verbatim code — summarize decisions and patterns instead
- Things already in README, comments, or git history

## Keeping Memory Current

When writing new information on a topic, **search first** for existing entries on the same subject. If you find outdated entries:

1. Note the entry id from the search/explore result
2. Delete the outdated entry with `wire_delete`
3. Write the new, updated entry

This keeps the container clean and avoids conflicting information. Don't just append corrections — replace the outdated entry entirely.

## Tool Reference

### wire_explore — structured access to indexed entities

Five modes. Default is `schema`.

| Mode | Required | Use for |
|------|----------|---------|
| `schema` | — | List entity types, fields, relationships, counts. With `entityType`, drill into one type. |
| `list` | `entityType` | Browse/paginate rows of one entity type. |
| `get` | `entityType`, `id` | Fetch one row, with mentions and parts. |
| `filter` | `entityType`, `filters` | Field predicates. Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`. |
| `text` | `query` | Keyword match. `entityType` is optional — omit to search across all indexed entities. |

Useful shared params: `fields` (projection), `orderBy`, `limit`/`offset`, `include` (related entity types to expand), `source` (restrict to a `source` prefix like `"file:notes.md"`).

**Start every new container with `wire_explore` (no params)** to learn what's there before searching.

### wire_search — natural-language retrieval over freeform content

Semantic match over notes, uploaded files, and recent writes that haven't been turned into indexed entities yet. Use it for natural-language questions where the answer might be embedded in source material.

Params:
- `query` (required) — natural-language question
- `topK` — max results (default 5, max 100)
- `fileIds` — restrict to specific uploaded files
- `minScore` — drop matches below this score

`wire_search` has **no `mode` parameter**. If you need keyword/list/get/filter behavior, that's `wire_explore`.

### wire_navigate — traverse from a known anchor

Given an entry id from a `wire_search` match, reach adjacent or related content.

| Mode | Returns |
|------|---------|
| `siblings` | Adjacent passages from the same source. `range` controls neighbors before and after. |
| `source` | All passages from the same source (paginated). |
| `relationships` | Entries connected to the anchor. Filter by `type` (e.g. `"contradicts"`, `"elaborates"`, `"supersedes"`, `"corroborates"`). |

All modes accept optional temporal filters: `since` and `before` (ISO timestamp or relative duration like `"1h"`, `"24h"`, `"7d"`), and `sort` (`"relevance"` default, or `"chronological"`).

`wire_navigate` operates on freeform content. To explore indexed entities, use `wire_explore`.

### wire_delete

Pass `entryId`. Cleans up related links automatically.

## Proactive Retrieval (Read)

**Search Wire for relevant context in these moments — don't wait to be asked:**

- **Session start** — recent session summaries and open threads for this project
- **Before working on a component** — past decisions about it (e.g., `"auth middleware decisions"`)
- **Before suggesting an approach** — corrections or established patterns that might apply
- **When the user references past work** — what was discussed

**Search ladder:**

1. New container? Run `wire_explore` (no params) once to see what types exist.
2. Looking for an indexed entity (decisions/patterns/corrections/preferences/sessions)? Use `wire_explore mode: "text"` for keyword match across all entities, or `mode: "filter"` with `type` and `project` predicates.
3. Looking for something in your notes, uploaded files, or recent writes? Use `wire_search` with a specific natural-language query.
4. Got a useful `wire_search` match and want surrounding context? Use `wire_navigate` with that entry's id.

Use specific queries. `"billing webhook error handling"` not `"stuff about billing"`.

## Transcript Capture

Wire Memory can automatically capture session transcripts and upload them to your container. When enabled (via `/wire-memory:configure`), transcripts are captured:

- **Before compaction** — preserves the full conversation before context is compressed
- **At end of session** — captures sessions that never hit the compaction threshold

Transcripts are stored as JSONL files (one turn per line, tool results stripped, secrets redacted). They appear in the container's file list alongside regular uploads and are searchable via `wire_search`.

This is complementary to skill-driven writes — transcripts capture the full conversation flow, while `wire_write` captures curated decisions, patterns, and corrections.

## Guidelines

- Log frequently in small entries rather than one big dump
- Use structured JSON for writes — enables filtering by type, date, project, user
- Always include `project`, `user`, and `scope` in writes
- Don't announce "I'm saving this to Wire memory" — just do it quietly
- Wire memory is shared — scoping by project and user keeps context clean for teams
