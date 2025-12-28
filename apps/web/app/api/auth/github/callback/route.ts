import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient, SupabaseConfigError } from '@/lib/supabase/admin';
import { setSession } from '@/lib/auth/session';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://gh-mcp-web.vercel.app';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${APP_URL}/login?error=${error}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${APP_URL}/login?error=missing_params`
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (state !== storedState) {
    return NextResponse.redirect(
      `${APP_URL}/login?error=invalid_state`
    );
  }

  // Exchange code for tokens
  const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    console.error('Token exchange failed:', tokenResponse.status, tokenResponse.statusText);
    return NextResponse.redirect(
      `${APP_URL}/login?error=token_exchange_failed`
    );
  }

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return NextResponse.redirect(
      `${APP_URL}/login?error=${tokenData.error}`
    );
  }

  const { access_token, refresh_token, expires_in } = tokenData;

  // Get user info from GitHub
  const userResponse = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!userResponse.ok) {
    console.error('Failed to fetch user info:', userResponse.status, userResponse.statusText);
    return NextResponse.redirect(
      `${APP_URL}/login?error=user_fetch_failed`
    );
  }

  const userData = await userResponse.json();

  // Validate required user data fields
  if (!userData.id || !userData.login) {
    console.error('Invalid user data from GitHub:', userData);
    return NextResponse.redirect(
      `${APP_URL}/login?error=invalid_user_data`
    );
  }

  // Upsert user in Supabase
  let supabase;
  try {
    supabase = createAdminClient();
  } catch (error) {
    if (error instanceof SupabaseConfigError) {
      console.error('Supabase configuration error:', error.message);
      return NextResponse.redirect(
        `${APP_URL}/login?error=db_config_error`
      );
    }
    throw error;
  }

  const { data: user, error: dbError } = await supabase
    .from('users')
    .upsert(
      {
        github_id: userData.id,
        github_login: userData.login,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'github_id' }
    )
    .select()
    .single();

  if (dbError) {
    console.error('Database error:', dbError.message, dbError.code, dbError.details);
    return NextResponse.redirect(
      `${APP_URL}/login?error=db_error`
    );
  }

  if (!user) {
    console.error('Database error: No user returned from upsert');
    return NextResponse.redirect(
      `${APP_URL}/login?error=db_error`
    );
  }

  // Set encrypted session cookie
  await setSession({
    userId: user.id,
    githubId: userData.id,
    githubLogin: userData.login,
    accessToken: access_token,
    refreshToken: refresh_token || '',
    expiresAt: Date.now() + (expires_in || 28800) * 1000,
  });

  return NextResponse.redirect(`${APP_URL}/dashboard`);
}
