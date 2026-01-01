import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getSession } from '@/lib/auth/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { createMachine, createFlyApp, destroyMachine } from '@/lib/fly';
import { GITHUB_SCOPES } from '@gh-mcp/shared';

const FLY_APP_NAME = process.env.FLY_MCP_APP_NAME || 'gh-mcp-server';
const MCP_SERVER_IMAGE = process.env.MCP_SERVER_IMAGE || 'registry.fly.io/gh-mcp-server:latest';

function generateSecretToken(): string {
  // 256-bit random, base62 encoded
  const bytes = crypto.randomBytes(32);
  const base62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (const byte of bytes) {
    result += base62[byte % 62];
  }
  return result;
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const formData = await request.formData();
  const label = formData.get('label') as string | null;
  const scopeType = formData.get('scopes') as string || 'read';

  const scopes = scopeType === 'write' ? GITHUB_SCOPES.WRITE : GITHUB_SCOPES.READ;

  const secretToken = generateSecretToken();

  try {
    // Ensure Fly app exists
    await createFlyApp(FLY_APP_NAME);

    // Create Fly machine with tokens as env vars
    const machine = await createMachine({
      appName: FLY_APP_NAME,
      name: `mcp-${secretToken.slice(0, 8)}`,
      image: MCP_SERVER_IMAGE,
      env: {
        GITHUB_ACCESS_TOKEN: session.accessToken,
        GITHUB_REFRESH_TOKEN: session.refreshToken,
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID!,
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET!,
        SECRET_TOKEN: secretToken,
      },
    });

    // Store in database
    const supabase = createAdminClient();
    const { error: dbError } = await supabase.from('mcp_urls').insert({
      user_id: session.userId,
      secret_token: secretToken,
      fly_machine_id: machine.id,
      scopes: [...scopes],
      label: label || null,
    });

    if (dbError) {
      console.error('Database error:', dbError);
      // Clean up the machine since database insert failed
      try {
        await destroyMachine(FLY_APP_NAME, machine.id);
      } catch (cleanupError) {
        console.error('Failed to cleanup machine after database error:', cleanupError);
      }
      return NextResponse.json({ error: 'Failed to save URL' }, { status: 500 });
    }

    // Redirect back to dashboard
    return NextResponse.redirect(new URL('/dashboard', process.env.NEXT_PUBLIC_APP_URL!));
  } catch (error) {
    console.error('Error creating MCP URL:', error);
    return NextResponse.json({ error: 'Failed to create MCP URL' }, { status: 500 });
  }
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('mcp_urls')
    .select('*')
    .eq('user_id', session.userId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch URLs' }, { status: 500 });
  }

  return NextResponse.json(data);
}
