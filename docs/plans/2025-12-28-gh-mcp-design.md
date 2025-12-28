# GitHub MCP Server Design

## Overview

A Next.js app that lets users create MCP SSE connection URLs backed by isolated Deno sandboxes with their GitHub credentials. Each URL gets its own Fly.io machine with the gh CLI pre-authenticated.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         VERCEL                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    Next.js App                            │  │
│  │  - GitHub OAuth login                                     │  │
│  │  - Dashboard (create/revoke MCP URLs)                     │  │
│  │  - Calls Fly.io API to manage machines                    │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        SUPABASE                                 │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  users: id, github_id, github_login, created_at           │  │
│  │  mcp_urls: id, user_id, secret_token, fly_machine_id,     │  │
│  │            scopes, label, created_at, revoked_at          │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FLY.IO                                  │
│  ┌─────────────────────┐    ┌─────────────────────────────────┐ │
│  │   Router (always on)│───▶│  User Machines (scale-to-zero) │ │
│  │   validates secret  │    │  - Deno sandbox                │ │
│  │   routes to machine │    │  - gh CLI + token in env       │ │
│  └─────────────────────┘    │  - refreshes token in-memory   │ │
│                             └─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

**URL format:** `https://mcp.{app}.fly.dev/{secret_token}`
**Secret token:** 256-bit random, base62 encoded (~43 chars)

## User Flows

### Sign Up / Login
1. User clicks "Login with GitHub"
2. Redirected to GitHub OAuth with requested scopes
3. GitHub redirects back with code → Next.js exchanges for tokens
4. Find or create user in Supabase by `github_id`
5. Store tokens in session (encrypted cookie)
6. Redirect to dashboard

### Create MCP URL
1. User selects scopes from checkboxes
2. Clicks "Create"
3. Next.js generates `secret_token` via `crypto.randomBytes(32)`
4. Calls Fly Machines API to create machine with env vars:
   - `GITHUB_ACCESS_TOKEN`
   - `GITHUB_REFRESH_TOKEN`
   - `GITHUB_CLIENT_ID` / `CLIENT_SECRET` (for refresh)
5. Stores in Supabase: `secret_token`, `fly_machine_id`, `scopes`
6. Shows user the URL

### Revoke MCP URL
1. User clicks "Revoke" on a URL
2. Next.js calls Fly API to destroy the machine
3. Marks `revoked_at` in Supabase

### MCP Connection (from Claude)
1. Claude connects to `https://mcp.{app}.fly.dev/{secret_token}`
2. Router validates `secret_token` against Supabase
3. Router wakes/routes to the associated Fly machine
4. Machine serves MCP with Deno sandbox + gh CLI

## MCP Server & Deno Sandbox

Each Fly Machine runs:
```
┌────────────────────────────────────────────┐
│            MCP Server (Node.js)            │
│  - SSE transport for MCP protocol          │
│  - Token refresh logic (in-memory)         │
│  - Spawns Deno sandbox per tool call       │
└─────────────────┬──────────────────────────┘
                  │
                  ▼
┌────────────────────────────────────────────┐
│          Deno Sandbox (@deno/sandbox)      │
│  Network: github.com, api.github.com       │
│  Filesystem: /workspace (read/write)       │
│  Commands: gh, git, ls, cat, grep, find    │
│  Env: GH_TOKEN                             │
└────────────────────────────────────────────┘
```

### MCP Tool
```json
{
  "name": "shell",
  "description": "Run shell commands with gh CLI (github.com network access only)",
  "inputSchema": {
    "type": "object",
    "properties": {
      "command": { "type": "string" }
    }
  }
}
```

### System Prompt
```
You have shell access with the gh CLI authenticated to GitHub.

Commands available:
- gh repo clone <owner/repo> -- clone a repository
- gh issue list/view/create -- manage issues
- gh pr list/view/create -- manage pull requests
- gh project list/view -- view projects
- ls, cat, grep, find, etc. -- inspect cloned code

Workspace: /workspace (use this for cloning repos)

Example workflow:
  gh repo clone facebook/react
  cd /workspace/react
  ls -la src/
  cat src/index.js
```

### Token Refresh
- On startup, load `GITHUB_ACCESS_TOKEN` and `GITHUB_REFRESH_TOKEN` from env
- Before each gh command (or on 401), check expiry
- If expired: call GitHub OAuth token endpoint with refresh token
- Update in-memory tokens

## Tech Stack

### Dependencies
- Next.js 14+ (App Router)
- `@supabase/supabase-js`
- `fly-admin` (Supabase's Fly SDK)
- `@modelcontextprotocol/sdk` (MCP server)
- `@deno/sandbox` (sandbox runtime)

### Monorepo Structure
```
/gh-mcp
  /apps
    /web                     # Next.js app (Vercel)
      /app
        /api/auth/github/...
        /api/mcp-urls/...
        /dashboard/page.tsx
        /login/page.tsx
      /lib
        /supabase.ts
        /fly.ts
        /auth.ts
      package.json

    /mcp-server              # MCP server (Fly.io)
      /src
        /index.ts            # Router process
        /machine
          /server.ts
          /sandbox.ts
          /token.ts
      Dockerfile
      fly.toml
      package.json

  /packages
    /shared                  # Shared types/utils
      /types.ts
      package.json

  package.json               # Workspace root
  pnpm-workspace.yaml
```

## Database Schema

```sql
-- Users (created on first GitHub login)
create table users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null,
  github_login text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MCP URLs (one per Fly machine)
create table mcp_urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  secret_token text unique not null,      -- 256-bit, base62
  fly_machine_id text not null,           -- Fly machine ID
  scopes text[] not null,                 -- ['repo', 'read:org', ...]
  label text,                             -- optional user-friendly name
  created_at timestamptz default now(),
  revoked_at timestamptz                  -- null = active
);

-- Index for router lookups
create index mcp_urls_secret_token_idx on mcp_urls(secret_token)
  where revoked_at is null;
```

## Key Decisions

| Component | Decision |
|-----------|----------|
| Web app | Next.js on Vercel |
| Database | Supabase (PostgreSQL) |
| MCP hosting | Fly.io (router + per-user machines) |
| Token storage | Fly machine env vars (not DB) |
| Token refresh | MCP server handles in-memory |
| URL security | 256-bit secret path token |
| OAuth scopes | Selected at URL creation, immutable |
| Sandbox | Deno with gh CLI, /workspace dir |
| Structure | Monorepo (apps/web, apps/mcp-server) |

## GitHub OAuth Scopes

Initial (read-only):
- `repo` (read access to public/private repos)
- `read:org`
- `read:project`

Extended (when user opts in):
- `repo` (full access)
- `write:org`
- `project` (full access)
