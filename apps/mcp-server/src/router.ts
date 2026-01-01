import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy initialization to avoid crashing when env vars are missing
// (e.g., when using SECRET_TOKEN direct mode instead of Supabase validation)
let supabase: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (supabase) {
    return supabase;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables, ' +
      'or use SECRET_TOKEN for direct token validation.'
    );
  }

  supabase = createClient(supabaseUrl, supabaseKey);
  return supabase;
}

export async function validateSecretToken(token: string): Promise<boolean> {
  const { data, error } = await getSupabaseClient()
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
