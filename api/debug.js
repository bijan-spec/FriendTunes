module.exports = async function handler(req, res) {
  const results = {
    env: {
      SPOTIFY_CLIENT_ID: process.env.SPOTIFY_CLIENT_ID ? 'SET (' + process.env.SPOTIFY_CLIENT_ID.substring(0, 6) + '...)' : 'MISSING',
      SPOTIFY_CLIENT_SECRET: process.env.SPOTIFY_CLIENT_SECRET ? 'SET (' + process.env.SPOTIFY_CLIENT_SECRET.substring(0, 6) + '...)' : 'MISSING',
      APP_URL: process.env.APP_URL || 'MISSING',
      UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || 'MISSING',
      UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN ? 'SET (' + process.env.UPSTASH_REDIS_REST_TOKEN.substring(0, 6) + '...)' : 'MISSING',
    },
    tests: {},
    nodeVersion: process.version,
  };

  // Test 1: Can we fetch anything at all?
  try {
    const r = await fetch('https://httpbin.org/get');
    results.tests.basicFetch = 'OK - status ' + r.status;
  } catch (err) {
    results.tests.basicFetch = 'FAILED - ' + err.message;
  }

  // Test 2: Can we reach Spotify?
  try {
    const r = await fetch('https://accounts.spotify.com/api/token', { method: 'POST' });
    results.tests.spotifyReachable = 'OK - status ' + r.status;
  } catch (err) {
    results.tests.spotifyReachable = 'FAILED - ' + err.message;
  }

  // Test 3: Can we reach Upstash?
  if (process.env.UPSTASH_REDIS_REST_URL) {
    try {
      const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
        headers: { Authorization: 'Bearer ' + (process.env.UPSTASH_REDIS_REST_TOKEN || '') },
      });
      results.tests.upstashReachable = 'OK - status ' + r.status;
    } catch (err) {
      results.tests.upstashReachable = 'FAILED - ' + err.message;
    }
  } else {
    results.tests.upstashReachable = 'SKIPPED - no URL';
  }

  res.json(results);
};
