import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export default async function handler(req, res) {
  try {
    const usersHash = await redis.hgetall('users');

    if (!usersHash || Object.keys(usersHash).length === 0) {
      return res.json({ users: [] });
    }

    const users = Object.values(usersHash).map((u) => {
      const parsed = typeof u === 'string' ? JSON.parse(u) : u;
      return {
        id: parsed.id,
        name: parsed.name,
        image: parsed.image,
        connected_at: parsed.connected_at,
      };
    });

    res.json({ users });
  } catch (err) {
    console.error('Users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
}
