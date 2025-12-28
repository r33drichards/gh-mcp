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
