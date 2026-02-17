const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var cookies = req.headers.cookie || '';
  var match = cookies.match(/(?:^|; )rf_user=([^;]*)/);
  var currentUserId = match ? decodeURIComponent(match[1]) : null;

  if (!currentUserId) {
    return res.status(401).json({ error: 'Not logged in' });
  }

  var trackId = req.body.trackId;
  var likedByUserId = req.body.likedByUserId;

  if (!trackId || !likedByUserId) {
    return res.status(400).json({ error: 'Missing trackId or likedByUserId' });
  }

  // Only allow hiding your own liked tracks
  if (currentUserId !== likedByUserId) {
    return res.status(403).json({ error: 'You can only hide your own tracks' });
  }

  var redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    await redis.sadd('hidden', trackId + ':' + likedByUserId);
    res.json({ ok: true });
  } catch (err) {
    console.error('Hide error:', err.message);
    res.status(500).json({ error: 'Failed to hide track' });
  }
};
