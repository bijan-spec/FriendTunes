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
  var text = req.body.text;

  if (!trackId || !likedByUserId || !text) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (text.length > 280) {
    return res.status(400).json({ error: 'Comment too long' });
  }

  var redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // Look up commenter's display name
    var userDataRaw = await redis.hget('users', currentUserId);
    var userData = userDataRaw
      ? (typeof userDataRaw === 'string' ? JSON.parse(userDataRaw) : userDataRaw)
      : null;

    var comment = {
      userId: currentUserId,
      userName: userData ? userData.name : currentUserId,
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    var key = 'comments:' + trackId + ':' + likedByUserId;
    await redis.lpush(key, JSON.stringify(comment));

    res.json({ ok: true, comment: comment });
  } catch (err) {
    console.error('Comment post error:', err.message);
    res.status(500).json({ error: 'Failed to post comment' });
  }
};
