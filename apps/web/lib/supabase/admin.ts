import { createClient } from '@supabase/supabase-js';

export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SupabaseConfigError';
  }
}

function getSupabaseUrl(): string | undefined {
  // Check standard env var names
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
  if (process.env.SUPABASE_URL) {
    return process.env.SUPABASE_URL;
  }

  // Try to extract project ref from service role key JWT and construct URL
  // Service role key format: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByb2plY3RyZWYiLC4uLn0.xxx
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  if (serviceKey) {
    try {
      const payload = JSON.parse(Buffer.from(serviceKey.split('.')[1], 'base64').toString());
      if (payload.ref) {
        return `https://${payload.ref}.supabase.co`;
      }
    } catch {
      // JWT parsing failed, continue to error
    }
  }

  return undefined;
}

export function createAdminClient() {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new SupabaseConfigError(
      'Supabase URL not found. Set NEXT_PUBLIC_SUPABASE_URL or SUPABASE_URL'
    );
  }

  if (!serviceRoleKey) {
    throw new SupabaseConfigError(
      'Supabase service role key not found. Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY'
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
