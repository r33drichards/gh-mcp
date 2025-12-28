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
