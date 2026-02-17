const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  var trackId = req.query.trackId;
  var likedBy = req.query.likedBy;

  if (!trackId || !likedBy) {
    return res.status(400).json({ error: 'Missing trackId or likedBy' });
  }

  var redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    var raw = await redis.lrange('comments:' + trackId + ':' + likedBy, 0, -1);
    var comments = (raw || []).map(function (c) {
      return typeof c === 'string' ? JSON.parse(c) : c;
    });
    // Stored newest-first via LPUSH, reverse for chronological display
    comments.reverse();
    res.json({ comments: comments });
  } catch (err) {
    console.error('Comments fetch error:', err.message);
    res.status(500).json({ error: 'Failed to load comments' });
  }
};
