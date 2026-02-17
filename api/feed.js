import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

async function refreshAccessToken(refreshToken) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!res.ok) return null;
  return res.json();
}

async function getUserLikedSongs(userData) {
  const tokens = await refreshAccessToken(userData.refresh_token);
  if (!tokens) return [];

  // If Spotify returned a new refresh token, update it
  if (tokens.refresh_token && tokens.refresh_token !== userData.refresh_token) {
    userData.refresh_token = tokens.refresh_token;
    await redis.hset('users', { [userData.id]: JSON.stringify(userData) });
  }

  const res = await fetch('https://api.spotify.com/v1/me/tracks?limit=20', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });

  if (!res.ok) return [];

  const data = await res.json();

  return data.items.map((item) => ({
    added_at: item.added_at,
    track: {
      id: item.track.id,
      name: item.track.name,
      artists: item.track.artists.map((a) => a.name),
      album: {
        name: item.track.album.name,
        image: item.track.album.images?.[1]?.url || item.track.album.images?.[0]?.url,
      },
      uri: item.track.uri,
      external_url: item.track.external_urls?.spotify,
    },
    liked_by: {
      id: userData.id,
      name: userData.name,
      image: userData.image,
    },
  }));
}

export default async function handler(req, res) {
  try {
    const usersHash = await redis.hgetall('users');

    if (!usersHash || Object.keys(usersHash).length === 0) {
      return res.json({ songs: [], users: [] });
    }

    const users = Object.values(usersHash).map((u) =>
      typeof u === 'string' ? JSON.parse(u) : u
    );

    // Fetch liked songs from all users in parallel
    const allSongsArrays = await Promise.all(
      users.map((user) => getUserLikedSongs(user))
    );

    // Flatten and sort by added_at descending
    const allSongs = allSongsArrays
      .flat()
      .sort((a, b) => new Date(b.added_at) - new Date(a.added_at));

    const userList = users.map((u) => ({
      id: u.id,
      name: u.name,
      image: u.image,
    }));

    res.json({ songs: allSongs, users: userList });
  } catch (err) {
    console.error('Feed error:', err);
    res.status(500).json({ error: 'Failed to load feed' });
  }
}
