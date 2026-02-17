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
  var index = req.body.index;

  if (!trackId || !likedByUserId || typeof index !== 'number') {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  var redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    var key = 'comments:' + trackId + ':' + likedByUserId;

    // Fetch all comments (stored newest-first, but we display oldest-first)
    var raw = await redis.lrange(key, 0, -1);
    var comments = (raw || []).map(function (c) {
      return typeof c === 'string' ? JSON.parse(c) : c;
    });

    // Reverse to match display order (oldest first)
    comments.reverse();

    if (index < 0 || index >= comments.length) {
      return res.status(400).json({ error: 'Invalid comment index' });
    }

    var comment = comments[index];

    // Only allow deleting your own comments
    if (comment.userId !== currentUserId) {
      return res.status(403).json({ error: 'You can only delete your own comments' });
    }

    // Remove the comment: delete the key and re-add all except the deleted one
    comments.splice(index, 1);

    await redis.del(key);

    if (comments.length > 0) {
      // Re-add in reverse order (LPUSH stores newest-first)
      var reversed = comments.slice().reverse();
      for (var i = 0; i < reversed.length; i++) {
        await redis.lpush(key, JSON.stringify(reversed[i]));
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete comment error:', err.message);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};
