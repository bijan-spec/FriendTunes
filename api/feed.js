const { Redis } = require('@upstash/redis');

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

  if (!res.ok) {
    console.error('Token refresh failed:', res.status, await res.text());
    return null;
  }
  return res.json();
}

async function getUserLikedSongs(userData, redis) {
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

  if (!res.ok) {
    console.error('Liked songs fetch failed for', userData.id, ':', res.status);
    return [];
  }

  const data = await res.json();

  return data.items.map(function (item) {
    return {
      added_at: item.added_at,
      track: {
        id: item.track.id,
        name: item.track.name,
        artists: item.track.artists.map(function (a) { return a.name; }),
        album: {
          name: item.track.album.name,
          image: (item.track.album.images && item.track.album.images[1]
            ? item.track.album.images[1].url
            : (item.track.album.images && item.track.album.images[0]
              ? item.track.album.images[0].url
              : null)),
        },
        uri: item.track.uri,
        external_url: item.track.external_urls ? item.track.external_urls.spotify : null,
      },
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
    console.log('Feed: fetching users from Redis...');
    const usersHash = await redis.hgetall('users');

    if (!usersHash || Object.keys(usersHash).length === 0) {
      console.log('Feed: no users found');
      return res.json({ songs: [], users: [] });
    }

    const users = Object.values(usersHash).map(function (u) {
      return typeof u === 'string' ? JSON.parse(u) : u;
    });

    console.log('Feed: found', users.length, 'users');

    // Fetch liked songs from all users in parallel
    const allSongsArrays = await Promise.all(
      users.map(function (user) { return getUserLikedSongs(user, redis); })
    );

    // Flatten and sort by added_at descending
    const allSongs = allSongsArrays
      .flat()
      .sort(function (a, b) { return new Date(b.added_at) - new Date(a.added_at); });

    var userList = users.map(function (u) {
      return { id: u.id, name: u.name, image: u.image };
    });

    console.log('Feed: returning', allSongs.length, 'songs');
    res.json({ songs: allSongs, users: userList });
  } catch (err) {
    console.error('Feed error:', err.message, err.stack);
    res.status(500).json({ error: 'Failed to load feed' });
  }
};
