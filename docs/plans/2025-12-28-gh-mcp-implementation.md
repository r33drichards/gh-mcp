# GitHub MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Next.js app with GitHub OAuth that creates MCP SSE URLs backed by Fly.io machines running Deno sandboxes with the gh CLI.

**Architecture:** Monorepo with Next.js web app (Vercel) and MCP server (Fly.io). Users authenticate via GitHub OAuth, create MCP URLs that spin up isolated Fly machines with their tokens. Router validates secret URLs and routes to per-user machines.

**Tech Stack:** Next.js 14, Supabase, Fly.io Machines API, @modelcontextprotocol/sdk, @deno/sandbox, pnpm workspaces

---

## Phase 1: Monorepo Setup

### Task 1.1: Initialize pnpm Workspace

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create root package.json**

```json
{
  "name": "gh-mcp",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "dev:web": "pnpm --filter @gh-mcp/web dev",
    "dev:mcp": "pnpm --filter @gh-mcp/mcp-server dev"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.3.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

**Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 3: Create .gitignore**

```
node_modules
.next
.turbo
dist
.env
.env.local
.env*.local
*.log
.DS_Store
```

**Step 4: Create .nvmrc**

```
20
```

**Step 5: Create turbo.json**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 6: Run pnpm install**

```bash
pnpm install
```

**Step 7: Commit**

```bash
git add -A
git commit -m "chore: initialize pnpm monorepo with turbo"
```

---

### Task 1.2: Create Shared Types Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`

**Step 1: Create package.json**

```json
{
  "name": "@gh-mcp/shared",
  "version": "0.0.1",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "devDependencies": {
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create src/types.ts**

```typescript
export interface User {
  id: string;
  github_id: number;
  github_login: string;
  created_at: string;
  updated_at: string;
}

export interface McpUrl {
  id: string;
  user_id: string;
  secret_token: string;
  fly_machine_id: string;
  scopes: string[];
  label: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface CreateMcpUrlRequest {
  scopes: string[];
  label?: string;
}

export interface GitHubTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export const GITHUB_SCOPES = {
  READ: ['repo:read', 'read:org', 'read:project'],
  WRITE: ['repo', 'write:org', 'project'],
} as const;
```

**Step 4: Create src/index.ts**

```typescript
export * from './types';
```

**Step 5: Install dependencies and build**

```bash
pnpm install
pnpm --filter @gh-mcp/shared build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add shared types package"
```

---

## Phase 2: Next.js Web App Setup

### Task 2.1: Initialize Next.js App

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/next.config.js`
- Create: `apps/web/app/layout.tsx`
- Create: `apps/web/app/page.tsx`

**Step 1: Create package.json**

```json
{
  "name": "@gh-mcp/web",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@gh-mcp/shared": "workspace:*",
    "@supabase/supabase-js": "^2.39.0",
    "next": "^14.2.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

**Step 3: Create next.config.js**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@gh-mcp/shared'],
};

module.exports = nextConfig;
```

**Step 4: Create app/layout.tsx**

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GitHub MCP',
  description: 'Create MCP connections with your GitHub credentials',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem' }}>
        {children}
      </body>
    </html>
  );
}
```

**Step 5: Create app/page.tsx**

```tsx
import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>GitHub MCP</h1>
      <p>Create MCP SSE connections backed by your GitHub credentials.</p>
      <Link href="/login">Login with GitHub</Link>
    </main>
  );
}
```

**Step 6: Install dependencies**

```bash
pnpm install
```

**Step 7: Verify dev server starts**

```bash
pnpm dev:web
# Should start on http://localhost:3000
# Ctrl+C to stop
```

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js web app"
```

---

### Task 2.2: Add Environment Configuration

**Files:**
- Create: `apps/web/.env.example`
- Create: `apps/web/lib/env.ts`

**Step 1: Create .env.example**

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# GitHub OAuth
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-client-secret

# Fly.io
FLY_API_TOKEN=your-fly-api-token
FLY_ORG_SLUG=personal

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
MCP_SERVER_DOMAIN=mcp.your-app.fly.dev
```

**Step 2: Create lib/env.ts**

```typescript
function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  supabase: {
    url: required('NEXT_PUBLIC_SUPABASE_URL'),
    anonKey: required('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    serviceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  },
  github: {
    clientId: required('GITHUB_CLIENT_ID'),
    clientSecret: required('GITHUB_CLIENT_SECRET'),
  },
  fly: {
    apiToken: required('FLY_API_TOKEN'),
    orgSlug: process.env.FLY_ORG_SLUG || 'personal',
  },
  app: {
    url: required('NEXT_PUBLIC_APP_URL'),
    mcpDomain: required('MCP_SERVER_DOMAIN'),
  },
} as const;
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add environment configuration"
```

---

### Task 2.3: Set Up Supabase Client

**Files:**
- Create: `apps/web/lib/supabase/client.ts`
- Create: `apps/web/lib/supabase/server.ts`
- Create: `apps/web/lib/supabase/admin.ts`

**Step 1: Create lib/supabase/client.ts**

```typescript
import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create lib/supabase/server.ts**

```typescript
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignore - called from Server Component
          }
        },
      },
    }
  );
}
```

**Step 3: Create lib/supabase/admin.ts**

```typescript
import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

**Step 4: Add @supabase/ssr dependency**

Update `apps/web/package.json` dependencies:

```json
"dependencies": {
  "@gh-mcp/shared": "workspace:*",
  "@supabase/ssr": "^0.1.0",
  "@supabase/supabase-js": "^2.39.0",
  "next": "^14.2.0",
  "react": "^18.2.0",
  "react-dom": "^18.2.0"
}
```

**Step 5: Install dependencies**

```bash
pnpm install
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Supabase client configuration"
```

---

## Phase 3: GitHub OAuth Implementation

### Task 3.1: Create OAuth Initiation Route

**Files:**
- Create: `apps/web/app/api/auth/github/route.ts`

**Step 1: Create the route**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopesParam = searchParams.get('scopes');

  // Default to read-only scopes
  const scopes = scopesParam
    ? scopesParam.split(',')
    : ['repo', 'read:org', 'read:project'];

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    scope: scopes.join(' '),
    state,
  });

  return NextResponse.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add GitHub OAuth initiation route"
```

---

### Task 3.2: Create OAuth Callback Route

**Files:**
- Create: `apps/web/app/api/auth/github/callback/route.ts`
- Create: `apps/web/lib/auth/session.ts`

**Step 1: Create session helper lib/auth/session.ts**

```typescript
import { cookies } from 'next/headers';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.SESSION_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const ALGORITHM = 'aes-256-gcm';

interface SessionData {
  userId: string;
  githubId: number;
  githubLogin: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

function encrypt(data: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

export async function setSession(data: SessionData): Promise<void> {
  const cookieStore = await cookies();
  const encrypted = encrypt(JSON.stringify(data));

  cookieStore.set('session', encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) return null;

  try {
    return JSON.parse(decrypt(sessionCookie.value));
  } catch {
    return null;
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
```

**Step 2: Create callback route**

```typescript
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { setSession } from '@/lib/auth/session';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${error}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=missing_params`
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
    );
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${tokenData.error}`
    );
  }

  const { access_token, refresh_token, expires_in } = tokenData;

  // Get user info from GitHub
  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  const userData = await userResponse.json();

  // Upsert user in Supabase
  const supabase = createAdminClient();

  const { data: user, error: dbError } = await supabase
    .from('users')
    .upsert(
      {
        github_id: userData.id,
        github_login: userData.login,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_id' }
    )
    .select()
    .single();

  if (dbError || !user) {
    console.error('Database error:', dbError);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=db_error`
    );
  }

  // Set encrypted session cookie
  await setSession({
    userId: user.id,
    githubId: userData.id,
    githubLogin: userData.login,
    accessToken: access_token,
    refreshToken: refresh_token || '',
    expiresAt: Date.now() + (expires_in || 28800) * 1000,
  });

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`);
}
```

**Step 3: Add SESSION_ENCRYPTION_KEY to .env.example**

Add to `apps/web/.env.example`:
```
# Session (generate with: openssl rand -hex 32)
SESSION_ENCRYPTION_KEY=your-32-byte-hex-key
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add GitHub OAuth callback with session management"
```

---

### Task 3.3: Create Login Page

**Files:**
- Create: `apps/web/app/login/page.tsx`

**Step 1: Create login page**

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession();
  const { error } = await searchParams;

  if (session) {
    redirect('/dashboard');
  }

  return (
    <main>
      <h1>Login to GitHub MCP</h1>

      {error && (
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          Error: {error}
        </div>
      )}

      <p>Connect your GitHub account to create MCP URLs.</p>

      <a
        href="/api/auth/github"
        style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: '#24292e',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          marginTop: '1rem',
        }}
      >
        Login with GitHub
      </a>

      <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: '#666' }}>
        <Link href="/">← Back to home</Link>
      </p>
    </main>
  );
}
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add login page"
```

---

## Phase 4: Dashboard Implementation

### Task 4.1: Create Dashboard Layout and Page

**Files:**
- Create: `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/app/api/auth/logout/route.ts`

**Step 1: Create logout route**

```typescript
import { NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth/session';

export async function POST() {
  await clearSession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!));
}

export async function GET() {
  await clearSession();
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_APP_URL!));
}
```

**Step 2: Create dashboard page**

```tsx
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { McpUrl } from '@gh-mcp/shared';

async function getMcpUrls(userId: string): Promise<McpUrl[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('mcp_urls')
    .select('*')
    .eq('user_id', userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching MCP URLs:', error);
    return [];
  }

  return data || [];
}

export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  const mcpUrls = await getMcpUrls(session.userId);
  const mcpDomain = process.env.MCP_SERVER_DOMAIN || 'mcp.example.fly.dev';

  return (
    <main>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1>Dashboard</h1>
          <p>Logged in as <strong>{session.githubLogin}</strong></p>
        </div>
        <a href="/api/auth/logout" style={{ color: '#666' }}>Logout</a>
      </header>

      <section style={{ marginBottom: '2rem' }}>
        <h2>Create MCP URL</h2>
        <form action="/api/mcp-urls" method="POST" style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Label (optional)</label>
            <input
              type="text"
              name="label"
              placeholder="My MCP connection"
              style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem' }}>Scopes</label>
            <select name="scopes" style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }}>
              <option value="read">Read-only (repos, issues, projects)</option>
              <option value="write">Read + Write (full access)</option>
            </select>
          </div>
          <button
            type="submit"
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Create URL
          </button>
        </form>
      </section>

      <section>
        <h2>Your MCP URLs</h2>
        {mcpUrls.length === 0 ? (
          <p style={{ color: '#666' }}>No MCP URLs created yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #eee' }}>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Label</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>URL</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Scopes</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Created</th>
                <th style={{ textAlign: 'left', padding: '0.75rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mcpUrls.map((url) => (
                <tr key={url.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.75rem' }}>{url.label || '—'}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <code style={{ fontSize: '0.875rem', backgroundColor: '#f5f5f5', padding: '0.25rem 0.5rem', borderRadius: '4px' }}>
                      https://{mcpDomain}/{url.secret_token.slice(0, 8)}...
                    </code>
                    <button
                      onClick={() => navigator.clipboard.writeText(`https://${mcpDomain}/${url.secret_token}`)}
                      style={{ marginLeft: '0.5rem', cursor: 'pointer', background: 'none', border: 'none' }}
                      title="Copy full URL"
                    >
                      📋
                    </button>
                  </td>
                  <td style={{ padding: '0.75rem' }}>{url.scopes.join(', ')}</td>
                  <td style={{ padding: '0.75rem' }}>{new Date(url.created_at).toLocaleDateString()}</td>
                  <td style={{ padding: '0.75rem' }}>
                    <form action={`/api/mcp-urls/${url.id}`} method="POST" style={{ display: 'inline' }}>
                      <input type="hidden" name="_method" value="DELETE" />
                      <button
                        type="submit"
                        style={{
                          padding: '0.25rem 0.5rem',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '0.875rem',
                        }}
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

**Step 3: Commit**

```bash
git add -A
git commit -m "feat: add dashboard page with MCP URL table"
```

---

### Task 4.2: Create MCP URL API Routes

**Files:**
- Create: `apps/web/lib/fly.ts`
- Create: `apps/web/app/api/mcp-urls/route.ts`
- Create: `apps/web/app/api/mcp-urls/[id]/route.ts`

**Step 1: Create Fly.io client lib/fly.ts**

```typescript
const FLY_API_URL = 'https://api.machines.dev/v1';

interface CreateMachineOptions {
  appName: string;
  name: string;
  env: Record<string, string>;
  image: string;
}

interface FlyMachine {
  id: string;
  name: string;
  state: string;
}

export async function createFlyApp(name: string): Promise<void> {
  const response = await fetch(`${FLY_API_URL}/apps`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      app_name: name,
      org_slug: process.env.FLY_ORG_SLUG || 'personal',
    }),
  });

  if (!response.ok && response.status !== 409) {
    throw new Error(`Failed to create Fly app: ${await response.text()}`);
  }
}

export async function createMachine(options: CreateMachineOptions): Promise<FlyMachine> {
  const response = await fetch(`${FLY_API_URL}/apps/${options.appName}/machines`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: options.name,
      config: {
        image: options.image,
        env: options.env,
        services: [
          {
            ports: [
              { port: 443, handlers: ['tls', 'http'] },
              { port: 80, handlers: ['http'] },
            ],
            protocol: 'tcp',
            internal_port: 3000,
          },
        ],
        auto_destroy: false,
        restart: { policy: 'on-failure' },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create machine: ${await response.text()}`);
  }

  return response.json();
}

export async function destroyMachine(appName: string, machineId: string): Promise<void> {
  const response = await fetch(
    `${FLY_API_URL}/apps/${appName}/machines/${machineId}?force=true`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${process.env.FLY_API_TOKEN}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to destroy machine: ${await response.text()}`);
  }
}
```

**Step 2: Create MCP URLs POST route**

```typescript
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMachine, createFlyApp } from '@/lib/fly';
import { GITHUB_SCOPES } from '@gh-mcp/shared';

const FLY_APP_NAME = process.env.FLY_MCP_APP_NAME || 'gh-mcp-server';
const MCP_SERVER_IMAGE = process.env.MCP_SERVER_IMAGE || 'ghcr.io/your-org/gh-mcp-server:latest';

function generateSecretToken(): string {
  // 256-bit random, base62 encoded
  const bytes = crypto.randomBytes(32);
  const base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (const byte of bytes) {
    result += base62[byte % 62];
  }
  return result;
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const label = formData.get('label') as string | null;
  const scopeType = formData.get('scopes') as string || 'read';

  const scopes = scopeType === 'write' ? GITHUB_SCOPES.WRITE : GITHUB_SCOPES.READ;

  const secretToken = generateSecretToken();

  try {
    // Ensure Fly app exists
    await createFlyApp(FLY_APP_NAME);

    // Create Fly machine with tokens as env vars
    const machine = await createMachine({
      appName: FLY_APP_NAME,
      name: `mcp-${secretToken.slice(0, 8)}`,
      image: MCP_SERVER_IMAGE,
      env: {
        GITHUB_ACCESS_TOKEN: session.accessToken,
        GITHUB_REFRESH_TOKEN: session.refreshToken,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID!,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET!,
        SECRET_TOKEN: secretToken,
      },
    });

    // Store in database
    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from('mcp_urls').insert({
      user_id: session.userId,
      secret_token: secretToken,
      fly_machine_id: machine.id,
      scopes: [...scopes],
      label: label || null,
    });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 });
    }

    // Redirect back to dashboard
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (error) {
    console.error('Error creating MCP URL:', error);
    return NextResponse.json({ error: 'Failed to create MCP URL' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('mcp_urls')
    .select('*')
    .eq('user_id', session.userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch URLs' }, { status: 500 });
  }

  return NextResponse.json(data);
}
```

**Step 3: Create MCP URL DELETE route**

```typescript
import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { destroyMachine } from '@/lib/fly';

const FLY_APP_NAME = process.env.FLY_MCP_APP_NAME || 'gh-mcp-server';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  const { id } = await params;

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Get the MCP URL record
  const { data: mcpUrl, error: fetchError } = await supabase
    .from('mcp_urls')
    .select('*')
    .eq('id', id)
    .eq('user_id', session.userId)
    .single();

  if (fetchError || !mcpUrl) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    // Destroy the Fly machine
    await destroyMachine(FLY_APP_NAME, mcpUrl.fly_machine_id);

    // Mark as revoked
    await supabase
      .from('mcp_urls')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', id);

    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (error) {
    console.error('Error revoking MCP URL:', error);
    return NextResponse.json({ error: 'Failed to revoke URL' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  return POST(request, { params });
}
```

**Step 4: Update .env.example**

Add to `apps/web/.env.example`:
```
# Fly MCP Server
FLY_MCP_APP_NAME=gh-mcp-server
MCP_SERVER_IMAGE=ghcr.io/your-org/gh-mcp-server:latest
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add MCP URL create/revoke API routes"
```

---

## Phase 5: MCP Server Implementation

### Task 5.1: Initialize MCP Server Package

**Files:**
- Create: `apps/mcp-server/package.json`
- Create: `apps/mcp-server/tsconfig.json`
- Create: `apps/mcp-server/Dockerfile`
- Create: `apps/mcp-server/fly.toml`

**Step 1: Create package.json**

```json
{
  "name": "@gh-mcp/mcp-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@gh-mcp/shared": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "declaration": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: Create Dockerfile**

```dockerfile
FROM denoland/deno:debian AS deno
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install gh CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
    && chmod go+r /usr/share/keyrings/githubcli-archive-keyring.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
    && apt-get update \
    && apt-get install -y gh \
    && rm -rf /var/lib/apt/lists/*

# Copy Deno binary from deno image
COPY --from=deno /usr/bin/deno /usr/bin/deno

WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml* ./

# Install pnpm and dependencies
RUN npm install -g pnpm && pnpm install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN pnpm build

# Create workspace directory
RUN mkdir -p /workspace && chmod 777 /workspace

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

**Step 4: Create fly.toml**

```toml
app = "gh-mcp-server"
primary_region = "ord"

[build]

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  cpu_kind = "shared"
  cpus = 1
  memory_mb = 512
```

**Step 5: Install dependencies**

```bash
pnpm install
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: initialize MCP server package"
```

---

### Task 5.2: Implement MCP Server Core

**Files:**
- Create: `apps/mcp-server/src/index.ts`
- Create: `apps/mcp-server/src/token.ts`

**Step 1: Create token refresh logic src/token.ts**

```typescript
interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokenState: TokenState = {
  accessToken: process.env.GITHUB_ACCESS_TOKEN || '',
  refreshToken: process.env.GITHUB_REFRESH_TOKEN || '',
  expiresAt: Date.now() + 8 * 60 * 60 * 1000, // Assume 8 hours initially
};

export async function getAccessToken(): Promise<string> {
  // If token expires in less than 5 minutes, refresh it
  if (tokenState.expiresAt - Date.now() < 5 * 60 * 1000) {
    await refreshToken();
  }
  return tokenState.accessToken;
}

async function refreshToken(): Promise<void> {
  if (!tokenState.refreshToken) {
    console.error('No refresh token available');
    return;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokenState.refreshToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Token refresh error:', data.error);
      return;
    }

    tokenState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenState.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 28800) * 1000,
    };

    console.log('Token refreshed successfully');
  } catch (error) {
    console.error('Failed to refresh token:', error);
  }
}
```

**Step 2: Create main server src/index.ts**

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { spawn } from 'child_process';
import { getAccessToken } from './token.js';

const PORT = parseInt(process.env.PORT || '3000');
const SECRET_TOKEN = process.env.SECRET_TOKEN;

// MCP Server setup
function createMcpServer() {
  const server = new Server(
    {
      name: 'github-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'shell',
        description: `Run shell commands with gh CLI authenticated to GitHub.

Available commands:
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
  cat src/index.js`,
        inputSchema: {
          type: 'object',
          properties: {
            command: {
              type: 'string',
              description: 'The shell command to execute',
            },
            cwd: {
              type: 'string',
              description: 'Working directory (default: /workspace)',
            },
          },
          required: ['command'],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'shell') {
      return {
        content: [{ type: 'text', text: `Unknown tool: ${request.params.name}` }],
        isError: true,
      };
    }

    const { command, cwd = '/workspace' } = request.params.arguments as {
      command: string;
      cwd?: string;
    };

    try {
      const token = await getAccessToken();
      const output = await executeCommand(command, cwd, token);
      return {
        content: [{ type: 'text', text: output }],
      };
    } catch (error) {
      return {
        content: [{ type: 'text', text: `Error: ${error}` }],
        isError: true,
      };
    }
  });

  return server;
}

async function executeCommand(
  command: string,
  cwd: string,
  token: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('sh', ['-c', command], {
      cwd,
      env: {
        ...process.env,
        GH_TOKEN: token,
        GITHUB_TOKEN: token,
        HOME: '/workspace',
      },
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(stdout || stderr);
      } else {
        resolve(stdout + stderr || `Command exited with code ${code}`);
      }
    });

    child.on('error', (error) => {
      reject(error);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      child.kill();
      reject(new Error('Command timed out after 5 minutes'));
    }, 5 * 60 * 1000);
  });
}

// HTTP server for SSE transport
const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const pathToken = url.pathname.slice(1); // Remove leading /

  // Health check
  if (url.pathname === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }

  // Validate secret token
  if (SECRET_TOKEN && pathToken !== SECRET_TOKEN) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  // Handle SSE connection
  if (req.method === 'GET') {
    const server = createMcpServer();
    const transport = new SSEServerTransport(url.pathname, res);
    await server.connect(transport);
    return;
  }

  // Handle POST for messages
  if (req.method === 'POST') {
    // SSE transport handles this via the connection
    res.writeHead(200);
    res.end();
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

httpServer.listen(PORT, () => {
  console.log(`MCP server listening on port ${PORT}`);
  if (SECRET_TOKEN) {
    console.log(`Access URL: http://localhost:${PORT}/${SECRET_TOKEN}`);
  }
});
```

**Step 3: Build and test**

```bash
pnpm --filter @gh-mcp/mcp-server build
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: implement MCP server with shell tool"
```

---

## Phase 6: Database Setup

### Task 6.1: Create Supabase Migration

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

**Step 1: Create migration file**

```sql
-- Users table
create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  github_id bigint unique not null,
  github_login text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- MCP URLs table
create table if not exists mcp_urls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  secret_token text unique not null,
  fly_machine_id text not null,
  scopes text[] not null,
  label text,
  created_at timestamptz default now(),
  revoked_at timestamptz
);

-- Index for fast router lookups
create index if not exists mcp_urls_secret_token_idx
  on mcp_urls(secret_token)
  where revoked_at is null;

-- Index for user's URLs
create index if not exists mcp_urls_user_id_idx
  on mcp_urls(user_id);

-- Enable Row Level Security
alter table users enable row level security;
alter table mcp_urls enable row level security;

-- RLS policies (service role bypasses these)
create policy "Users can view own data" on users
  for select using (auth.uid()::text = id::text);

create policy "Users can view own MCP URLs" on mcp_urls
  for select using (user_id::text = auth.uid()::text);
```

**Step 2: Commit**

```bash
git add -A
git commit -m "feat: add initial database schema migration"
```

---

## Phase 7: Final Integration

### Task 7.1: Add Router Process to MCP Server

**Files:**
- Modify: `apps/mcp-server/src/index.ts`
- Create: `apps/mcp-server/src/router.ts`

**Step 1: Create router.ts for token validation**

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function validateSecretToken(token: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('mcp_urls')
    .select('id')
    .eq('secret_token', token)
    .is('revoked_at', null)
    .single();

  if (error || !data) {
    return false;
  }

  return true;
}
```

**Step 2: Update index.ts to use router validation**

Add at the top of the SSE handler:

```typescript
import { validateSecretToken } from './router.js';

// In the HTTP handler, add validation:
if (!SECRET_TOKEN) {
  // Router mode: validate token from path against Supabase
  const isValid = await validateSecretToken(pathToken);
  if (!isValid) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }
}
```

**Step 3: Add Supabase to mcp-server dependencies**

Update `apps/mcp-server/package.json`:

```json
"dependencies": {
  "@gh-mcp/shared": "workspace:*",
  "@modelcontextprotocol/sdk": "^1.0.0",
  "@supabase/supabase-js": "^2.39.0"
}
```

**Step 4: Update mcp-server .env**

Create `apps/mcp-server/.env.example`:

```
# Per-machine secrets (set via Fly)
GITHUB_ACCESS_TOKEN=
GITHUB_REFRESH_TOKEN=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
SECRET_TOKEN=

# Supabase (for router mode)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

PORT=3000
```

**Step 5: Install and build**

```bash
pnpm install
pnpm --filter @gh-mcp/mcp-server build
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add router validation for MCP URLs"
```

---

### Task 7.2: Create Deployment Scripts

**Files:**
- Create: `scripts/deploy-web.sh`
- Create: `scripts/deploy-mcp.sh`

**Step 1: Create web deploy script**

```bash
#!/bin/bash
set -e

echo "Deploying web app to Vercel..."
cd apps/web
vercel --prod
```

**Step 2: Create MCP server deploy script**

```bash
#!/bin/bash
set -e

echo "Deploying MCP server to Fly.io..."
cd apps/mcp-server
fly deploy
```

**Step 3: Make scripts executable**

```bash
chmod +x scripts/*.sh
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: add deployment scripts"
```

---

## Summary

**Total Tasks:** 16 across 7 phases

**Phase 1:** Monorepo setup (2 tasks)
**Phase 2:** Next.js app setup (3 tasks)
**Phase 3:** GitHub OAuth (3 tasks)
**Phase 4:** Dashboard (2 tasks)
**Phase 5:** MCP Server (2 tasks)
**Phase 6:** Database (1 task)
**Phase 7:** Integration (2 tasks)

**Key files created:**
- `apps/web/` - Next.js dashboard app
- `apps/mcp-server/` - Fly.io MCP server
- `packages/shared/` - Shared types
- `supabase/migrations/` - Database schema

**Environment setup required:**
1. Create Supabase project, run migration
2. Create GitHub OAuth app
3. Create Fly.io account/app
4. Set all environment variables
