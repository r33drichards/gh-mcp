import Link from 'next/link';

export default function Home() {
  return (
    <main>
      <h1>GitHub MCP</h1>
      <p>Create MCP SSE connections backed by your GitHub credentials.</p>
      <Link href="/login">Login with GitHub</Link>
    </main>
  );
}
