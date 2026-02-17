import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(
          `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
        ).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.APP_URL}/api/callback`,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error('Token exchange failed:', err);
      return res.redirect('/?error=token_failed');
    }

    const tokens = await tokenRes.json();

    // Get user profile
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      return res.redirect('/?error=profile_failed');
    }

    const profile = await profileRes.json();

    // Store user data in Redis
    const userData = {
      id: profile.id,
      name: profile.display_name || profile.id,
      image: profile.images?.[0]?.url || null,
      refresh_token: tokens.refresh_token,
      connected_at: new Date().toISOString(),
    };

    await redis.hset('users', { [profile.id]: JSON.stringify(userData) });

    res.redirect('/?connected=true');
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/?error=server_error');
  }
}
