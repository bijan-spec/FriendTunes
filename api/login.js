module.exports = function handler(req, res) {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = `${process.env.APP_URL}/api/callback`;
  const scope = 'user-library-read user-read-private';

  const state = Math.random().toString(36).substring(2, 15);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope,
    redirect_uri: redirectUri,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
};
