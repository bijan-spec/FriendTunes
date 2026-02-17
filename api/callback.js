const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  // Log env var presence for debugging
  console.log('ENV check:', {
    hasClientId: !!process.env.SPOTIFY_CLIENT_ID,
    hasClientSecret: !!process.env.SPOTIFY_CLIENT_SECRET,
    hasAppUrl: !!process.env.APP_URL,
    appUrl: process.env.APP_URL,
    hasRedisUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    hasRedisToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const redirectUri = `${process.env.APP_URL}/api/callback`;
    console.log('Exchanging code, redirect_uri:', redirectUri);

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
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Token exchange failed:', tokenRes.status, errText);
      return res.redirect('/?error=token_failed');
    }

    const tokens = await tokenRes.json();
    console.log('Token exchange success, has access_token:', !!tokens.access_token);

    // Get user profile
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!profileRes.ok) {
      console.error('Profile fetch failed:', profileRes.status);
      return res.redirect('/?error=profile_failed');
    }

    const profile = await profileRes.json();
    console.log('Profile fetched:', profile.id, profile.display_name);

    // Store user data in Redis
    const userData = {
      id: profile.id,
      name: profile.display_name || profile.id,
      image: profile.images && profile.images[0] ? profile.images[0].url : null,
      refresh_token: tokens.refresh_token,
      connected_at: new Date().toISOString(),
    };

    await redis.hset('users', { [profile.id]: JSON.stringify(userData) });
    console.log('User stored in Redis:', profile.id);

    // Set session cookie
    res.setHeader('Set-Cookie',
      'rf_user=' + encodeURIComponent(profile.id) + '; Path=/; SameSite=Lax; Max-Age=31536000'
    );

    res.redirect('/?connected=true');
  } catch (err) {
    console.error('Callback error:', err.message, err.stack);
    res.redirect('/?error=server_error');
  }
};
