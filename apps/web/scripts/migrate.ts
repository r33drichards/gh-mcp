import { createClient } from '@supabase/supabase-js';

function getSupabaseUrl(): string | undefined {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (serviceKey) {
    try {
      const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString());
      if (payload.ref) {
        return `https://${payload.ref}.supabase.co`;
      }
    } catch {
      // JWT parsing failed
    }
  }

  return undefined;
}

async function verifyDatabase() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.log('⚠️  Skipping database verification: Supabase credentials not configured');
    console.log('   Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    return;
  }

  console.log('🔍 Verifying database schema...');
  console.log('   URL:', supabaseUrl);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Check if tables exist by querying them
  const { error: usersError } = await supabase.from('users').select('id').limit(1);
  const { error: mcpUrlsError } = await supabase.from('mcp_urls').select('id').limit(1);

  const usersExists = !usersError || !usersError.message?.includes('does not exist');
  const mcpUrlsExists = !mcpUrlsError || !mcpUrlsError.message?.includes('does not exist');

  if (!usersExists || !mcpUrlsExists) {
    console.error('\n❌ Database tables missing!');
    if (!usersExists) console.error('   - users table not found');
    if (!mcpUrlsExists) console.error('   - mcp_urls table not found');
    console.error('\n📋 To fix, run this SQL in your Supabase Dashboard > SQL Editor:\n');
    console.error(`-- Users table
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

-- Indexes
create index if not exists mcp_urls_secret_token_idx on mcp_urls(secret_token) where revoked_at is null;
create index if not exists mcp_urls_user_id_idx on mcp_urls(user_id);

-- Enable RLS
alter table users enable row level security;
alter table mcp_urls enable row level security;
`);
    process.exit(1);
  }

  console.log('✅ Database schema verified!');
}

verifyDatabase().catch(err => {
  console.error('Database verification failed:', err.message);
  process.exit(1);
});
