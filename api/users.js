const { Redis } = require('@upstash/redis');

module.exports = async function handler(req, res) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const usersHash = await redis.hgetall('users');

    if (!usersHash || Object.keys(usersHash).length === 0) {
      return res.json({ users: [] });
    }

    const users = Object.values(usersHash).map(function (u) {
      var parsed = typeof u === 'string' ? JSON.parse(u) : u;
      return {
        id: parsed.id,
        name: parsed.name,
        image: parsed.image,
        connected_at: parsed.connected_at,
      };
    });

    res.json({ users: users });
  } catch (err) {
    console.error('Users error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load users' });
  }
};
