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
