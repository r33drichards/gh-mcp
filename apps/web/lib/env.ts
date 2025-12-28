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
