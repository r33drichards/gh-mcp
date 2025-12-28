import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/admin';
import { setSession } from '@/lib/auth/session';

const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${error}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=missing_params`
    );
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get('oauth_state')?.value;
  cookieStore.delete('oauth_state');

  if (state !== storedState) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=invalid_state`
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

  const tokenData = await tokenResponse.json();

  if (tokenData.error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=${tokenData.error}`
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

  const userData = await userResponse.json();

  // Upsert user in Supabase
  const supabase = createAdminClient();

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

  if (dbError || !user) {
    console.error('Database error:', dbError);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/login?error=db_error`
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

  return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}/dashboard`);
}
