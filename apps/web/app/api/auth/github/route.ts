import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const GITHUB_AUTHORIZE_URL = 'https://github.com/login/oauth/authorize';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const scopesParam = searchParams.get('scopes');

  // Default to read-only scopes
  const scopes = scopesParam
    ? scopesParam.split(',')
    : ['repo', 'read:org', 'read:project'];

  // Generate state for CSRF protection
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/github/callback`,
    scope: scopes.join(' '),
    state,
  });

  return NextResponse.redirect(`${GITHUB_AUTHORIZE_URL}?${params}`);
}
