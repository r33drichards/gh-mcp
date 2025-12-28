# Next Steps: Deploying GitHub MCP Server

This guide walks you through deploying the GitHub MCP Server to production.

## Prerequisites

- [Vercel CLI](https://vercel.com/docs/cli) installed (`npm i -g vercel`)
- [Fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/) installed
- [Supabase account](https://supabase.com)
- [GitHub account](https://github.com) (for OAuth app)

---

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your project URL and keys from Settings > API:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

3. Run the migration in the SQL Editor:
   - Go to SQL Editor in Supabase dashboard
   - Copy contents of `supabase/migrations/001_initial_schema.sql`
   - Run the SQL

---

## Step 2: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click "New OAuth App"
3. Fill in:
   - **Application name:** `GitHub MCP` (or your choice)
   - **Homepage URL:** `https://your-app.vercel.app` (update after Vercel deploy)
   - **Authorization callback URL:** `https://your-app.vercel.app/api/auth/github/callback`
4. Click "Register application"
5. Note your:
   - `GITHUB_CLIENT_ID`
   - `GITHUB_CLIENT_SECRET` (generate one)

**Important:** Enable "Device Flow" if you want to support CLI-based auth later.

---

## Step 3: Set Up Fly.io

1. Sign up at [fly.io](https://fly.io)
2. Install flyctl and authenticate:
   ```bash
   flyctl auth login
   ```
3. Get your API token:
   ```bash
   flyctl tokens create deploy -x 999999h
   ```
   Save this as `FLY_API_TOKEN`

4. Create the Fly app (from the mcp-server directory):
   ```bash
   cd apps/mcp-server
   fly apps create gh-mcp-server
   ```

---

## Step 4: Generate Encryption Key

Generate a 32-byte hex key for session encryption:

```bash
openssl rand -hex 32
```

Save this as `SESSION_ENCRYPTION_KEY`

---

## Step 5: Deploy Web App to Vercel

1. Set up Vercel project:
   ```bash
   cd apps/web
   vercel
   ```
   Follow the prompts to link to your Vercel account.

2. Set environment variables in Vercel dashboard (or via CLI):
   ```bash
   vercel env add NEXT_PUBLIC_SUPABASE_URL
   vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
   vercel env add SUPABASE_SERVICE_ROLE_KEY
   vercel env add GITHUB_CLIENT_ID
   vercel env add GITHUB_CLIENT_SECRET
   vercel env add SESSION_ENCRYPTION_KEY
   vercel env add FLY_API_TOKEN
   vercel env add FLY_ORG_SLUG        # usually "personal"
   vercel env add FLY_MCP_APP_NAME    # "gh-mcp-server"
   vercel env add MCP_SERVER_IMAGE    # see Step 6
   vercel env add MCP_SERVER_DOMAIN   # "gh-mcp-server.fly.dev"
   vercel env add NEXT_PUBLIC_APP_URL # your Vercel URL
   ```

3. Deploy:
   ```bash
   vercel --prod
   ```

4. **Update GitHub OAuth callback URL** with your actual Vercel URL

---

## Step 6: Build and Push MCP Server Docker Image

The MCP server needs to be available as a Docker image for Fly machines to use.

1. Build the image:
   ```bash
   cd apps/mcp-server
   docker build -t ghcr.io/r33drichards/gh-mcp-server:latest .
   ```

2. Push to GitHub Container Registry:
   ```bash
   # Login to ghcr.io
   echo $GITHUB_TOKEN | docker login ghcr.io -u r33drichards --password-stdin

   # Push
   docker push ghcr.io/r33drichards/gh-mcp-server:latest
   ```

3. Update `MCP_SERVER_IMAGE` in Vercel to: `ghcr.io/r33drichards/gh-mcp-server:latest`

---

## Step 7: Test the Flow

1. Visit your Vercel URL
2. Click "Login with GitHub"
3. Authorize the app
4. On the dashboard, create an MCP URL
5. Copy the URL and use it in Claude's MCP settings

---

## Environment Variables Summary

### Web App (Vercel)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `GITHUB_CLIENT_ID` | GitHub OAuth client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth client secret |
| `SESSION_ENCRYPTION_KEY` | 32-byte hex key for sessions |
| `FLY_API_TOKEN` | Fly.io deploy token |
| `FLY_ORG_SLUG` | Fly org (usually "personal") |
| `FLY_MCP_APP_NAME` | Fly app name for MCP server |
| `MCP_SERVER_IMAGE` | Docker image for MCP server |
| `MCP_SERVER_DOMAIN` | Domain for MCP URLs |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |

### MCP Server (set via Fly machine env vars automatically)

| Variable | Description |
|----------|-------------|
| `GITHUB_ACCESS_TOKEN` | User's GitHub access token |
| `GITHUB_REFRESH_TOKEN` | User's GitHub refresh token |
| `GITHUB_CLIENT_ID` | For token refresh |
| `GITHUB_CLIENT_SECRET` | For token refresh |
| `SECRET_TOKEN` | URL secret for validation |

---

## Troubleshooting

### OAuth callback error
- Verify the callback URL in GitHub matches exactly: `https://your-app.vercel.app/api/auth/github/callback`

### Machine creation fails
- Check `FLY_API_TOKEN` is valid
- Ensure `MCP_SERVER_IMAGE` is accessible (public or authenticated)

### Token refresh fails
- GitHub OAuth apps need "Enable Device Flow" for refresh tokens
- Or use a GitHub App instead of OAuth App for better token management

---

## Architecture Diagram

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
│  ┌─────────────────────────────────────────────────────────────┐│
│  │  Per-User Machines (scale-to-zero)                         ││
│  │  - Deno sandbox + gh CLI                                   ││
│  │  - User's GitHub token in env                              ││
│  │  - Refreshes token automatically                           ││
│  │  - MCP SSE transport                                       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```
