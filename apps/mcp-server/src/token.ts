interface TokenState {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

let tokenState: TokenState = {
  accessToken: process.env.GITHUB_ACCESS_TOKEN || '',
  refreshToken: process.env.GITHUB_REFRESH_TOKEN || '',
  expiresAt: Date.now() + 8 * 60 * 60 * 1000, // Assume 8 hours initially
};

export async function getAccessToken(): Promise<string> {
  // If token expires in less than 5 minutes, refresh it
  if (tokenState.expiresAt - Date.now() < 5 * 60 * 1000) {
    await refreshToken();
  }
  return tokenState.accessToken;
}

async function refreshToken(): Promise<void> {
  if (!tokenState.refreshToken) {
    console.error('No refresh token available');
    return;
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        grant_type: 'refresh_token',
        refresh_token: tokenState.refreshToken,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error('Token refresh error:', data.error);
      return;
    }

    tokenState = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || tokenState.refreshToken,
      expiresAt: Date.now() + (data.expires_in || 28800) * 1000,
    };

    console.log('Token refreshed successfully');
  } catch (error) {
    console.error('Failed to refresh token:', error);
  }
}
