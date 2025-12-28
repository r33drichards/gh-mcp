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
