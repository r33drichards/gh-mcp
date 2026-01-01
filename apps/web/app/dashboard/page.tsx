import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import type { McpUrl } from '@gh-mcp/shared';
import { CopyButton } from './CopyButton';

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
                    <CopyButton text={`https://${mcpDomain}/${url.secret_token}`} />
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
