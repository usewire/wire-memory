---
name: wire-memory
description: ALWAYS USE THIS SKILL. Automatic context logging and retrieval via Wire container. Invoke this skill at the start of every session, when making decisions, when receiving corrections, when establishing patterns, and before ending sessions. This skill provides persistent cross-project memory that supplements the built-in memory system.
---

# Wire Memory — Automatic Context

You have a Wire memory container connected via the `wire-memory` MCP server. Use it to **automatically log and retrieve context** across sessions and projects. This works alongside Claude's built-in memory — Wire memory is for structured, searchable context that persists across all projects and tools.

## Tools

Wire memory tools are available via MCP. Tool names vary by platform:
- **Cursor**: `wire_search`, `wire_write`, `wire_explore`, `wire_delete`
- **Claude Code**: `wire_search` (same pattern for others)

Use whichever format your platform provides.

- **wire_search**: Search past context. Modes: `text`, `semantic`, `list`, `get`, `filter`.
- **wire_write**: Log context. Accepts structured JSON (preferred) or markdown.
- **wire_explore**: Discover what's stored — types, schemas, counts.
- **wire_delete**: Remove an entry by ID.

## Scoped Memory

Every write MUST include `project` and `user` fields from the eval hook context. Use `scope` to control visibility:

- **`"project"`** — decisions, patterns, and corrections specific to this project. Default.
- **`"global"`** — user preferences, coding style, cross-project conventions.

When searching, **search project-scoped first**, then broaden to global if no results:
1. `wire_search` with filter for current project name
2. If nothing relevant, search again without project filter

This ensures project-specific decisions don't pollute other contexts, while global preferences are always reachable.

## Automatic Logging (Write)

**Log these moments as they happen — don't wait to be asked.**

Use `wire_write` with structured JSON for better searchability and filtering. Always include `project`, `user`, and `scope`.

**Keep writes concise.** Summarize, don't transcribe. If a write has multiple distinct points, split them into separate entries. Use tags to associate related writes.

### Decisions
When the user picks an approach, or you help evaluate trade-offs:
```json
{
  "type": "decision",
  "project": "wire-platform",
  "user": "Jitpal Kocher",
  "scope": "project",
  "title": "Use React Query for server state",
  "date": "2026-03-16",
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
  "date": "2026-03-16",
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
  "date": "2026-03-16",
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

1. Note the entry ID from the search result
2. Delete the outdated entry with `wire_delete`
3. Write the new, updated entry

This keeps the container clean and avoids conflicting information. Don't just append corrections — replace the outdated entry entirely.

## Search & Explore Reference

### wire_explore
Discover what's in the container before searching.
- **No params** — lists all entity types with counts
- **`entityType`** — schema, fields, and relationships for that type
- **`includeSamples: true`** — include sample entries (requires `entityType`)

### wire_search modes
| Mode | Required params | Use for |
|------|----------------|---------|
| `semantic` | `query` | Natural language questions ("how did we handle auth?") |
| `text` | `query`, `entityType` | Exact/keyword matches within a known type |
| `filter` | `entityType`, `filters` | Field-level conditions (e.g., type=correction, project=wire-memory) |
| `list` | `entityType` | Browse/paginate all entries of a type |
| `get` | `id` | Fetch a single entry by ID |

**Key parameters:**
- `filters` — array of `{field, operator, value}`. Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`, `in`
- `fields` — projection, return only these fields
- `orderBy` — `{field, direction: "asc"|"desc"}`
- `topK` — max semantic results (default 5, max 100)
- `limit`/`offset` — pagination for list/filter/text modes

**Prefer `semantic` mode** for most searches — it works across all entity types without needing to know the exact type or field names. Use `filter` when you need precision (e.g., all corrections for a specific project).

## Proactive Retrieval (Read)

**Search Wire for relevant context in these moments — don't wait to be asked:**

- **Session start** — search for recent session summaries and open threads for this project
- **Before working on a component** — search for past decisions about it (e.g., `"auth middleware decisions"`)
- **Before suggesting an approach** — search for corrections or established patterns that might apply
- **When the user references past work** — search for what was discussed

**Search strategy:**
1. First search scoped to the current project (filter by project name)
2. If no relevant results, broaden to all entries (catches global preferences and cross-project patterns)

Use specific queries. `"billing webhook error handling"` not `"stuff about billing"`.

Use `wire_explore` first if you've never searched this container before.

## Transcript Capture

Wire Memory can automatically capture session transcripts and upload them to your container. When enabled (via `/wire-memory:configure`), transcripts are captured:

- **Before compaction** — preserves the full conversation before context is compressed
- **At end of session** — captures sessions that never hit the compaction threshold

Transcripts are stored as JSONL files (one turn per line, tool results stripped, secrets redacted). They appear in the container's file list alongside regular uploads and are searchable via `wire_search`.

This is complementary to skill-driven writes — transcripts capture the raw conversation flow, while `wire_write` captures curated decisions, patterns, and corrections.

## Guidelines

- Log frequently in small entries rather than one big dump
- Use structured JSON for writes — enables filtering by type, date, project, user
- Always include `project`, `user`, and `scope` in writes
- Don't announce "I'm saving this to Wire memory" — just do it quietly
- Wire memory is shared — scoping by project and user keeps context clean for teams
