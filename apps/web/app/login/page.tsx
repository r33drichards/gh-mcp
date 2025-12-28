import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';

function getErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    db_error: 'Database connection failed. Please try again later.',
    db_config_error: 'Server configuration error. Please contact support.',
    missing_params: 'Authentication failed. Missing required parameters.',
    invalid_state: 'Authentication failed. Please try logging in again.',
    token_exchange_failed: 'Failed to authenticate with GitHub. Please try again.',
    user_fetch_failed: 'Failed to fetch your GitHub profile. Please try again.',
    invalid_user_data: 'Invalid response from GitHub. Please try again.',
  };
  return errorMessages[error] || `Authentication error: ${error}`;
}

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
          {getErrorMessage(error)}
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
