const { Redis } = require('@upstash/redis');

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(
        process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET
      ).toString('base64'),
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) {
    console.error('Token refresh failed:', res.status);
    return null;
  }
  return res.json();
}

async function getUserLikedSongs(userData, redis) {
  const tokens = await refreshAccessToken(userData.refresh_token);
  if (!tokens) return [];

  if (tokens.refresh_token && tokens.refresh_token !== userData.refresh_token) {
    userData.refresh_token = tokens.refresh_token;
    await redis.hset('users', { [userData.id]: JSON.stringify(userData) });
  }

  const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=20', {
    headers: { Authorization: 'Bearer ' + tokens.access_token },
  });

  if (!res.ok) {
    console.error('Liked songs fetch failed for', userData.id, ':', res.status);
    return [];
  }

  const data = await res.json();

  return data.items.map(function (item) {
    return {
      added_at: item.added_at,
      track: { id: item.track.id },
      liked_by: {
        id: userData.id,
        name: userData.name,
        image: userData.image,
      },
    };
  });
}

module.exports = async function handler(req, res) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    const usersHash = await redis.hgetall('users');

    if (!usersHash || Object.keys(usersHash).length === 0) {
      return res.json({ songs: [], users: [] });
    }

    const users = Object.values(usersHash).map(function (u) {
      return typeof u === 'string' ? JSON.parse(u) : u;
    });

    // Fetch liked songs from all users in parallel
    const allSongsArrays = await Promise.all(
      users.map(function (user) { return getUserLikedSongs(user, redis); })
    );

    // Flatten and sort by added_at descending
    const allSongs = allSongsArrays
      .flat()
      .sort(function (a, b) { return new Date(b.added_at) - new Date(a.added_at); });

    // Filter out hidden tracks
    const hiddenSet = await redis.smembers('hidden');
    const hiddenKeys = new Set(hiddenSet || []);

    const visibleSongs = allSongs.filter(function (song) {
      return !hiddenKeys.has(song.track.id + ':' + song.liked_by.id);
    });

    // Fetch comment counts using pipeline
    var pipeline = redis.pipeline();
    visibleSongs.forEach(function (song) {
      pipeline.llen('comments:' + song.track.id + ':' + song.liked_by.id);
    });
    var commentCounts = await pipeline.exec();

    visibleSongs.forEach(function (song, i) {
      song.commentCount = commentCounts[i] || 0;
    });

    var userList = users.map(function (u) {
      return { id: u.id, name: u.name, image: u.image };
    });

    res.json({ songs: visibleSongs, users: userList });
  } catch (err) {
    console.error('Feed error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load feed' });
  }
};
