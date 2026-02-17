document.addEventListener('DOMContentLoaded', () => {
  const feedEl = document.getElementById('feed');
  const loadingEl = document.getElementById('loading');
  const friendsBar = document.getElementById('friendsBar');
  const connectBtn = document.getElementById('connectBtn');

  // Handle URL params (post-connect or error)
  const params = new URLSearchParams(window.location.search);
  if (params.get('connected') === 'true') {
    showToast('Spotify connected!');
    window.history.replaceState({}, '', '/');
  } else if (params.get('error')) {
    showToast(`Connection failed: ${params.get('error')}`, true);
    window.history.replaceState({}, '', '/');
  }

  // Connect button
  connectBtn.addEventListener('click', () => {
    window.location.href = '/api/login';
  });

  // Load the feed
  loadFeed();

  async function loadFeed() {
    try {
      const res = await fetch('/api/feed');
      const data = await res.json();

      if (data.error) {
        showError(data.error);
        return;
      }

      renderFriendsBar(data.users);
      renderFeed(data.songs);
    } catch (err) {
      showError('Could not connect to server');
    }
  }

  function renderFriendsBar(users) {
    if (!users || users.length === 0) return;

    friendsBar.innerHTML = users
      .map((user) => {
        const avatar = user.image
          ? `<img src="${user.image}" alt="${esc(user.name)}">`
          : `<div class="no-image">${esc(user.name.charAt(0).toUpperCase())}</div>`;
        return `
        <div class="friend-avatar">
          ${avatar}
          <span>${esc(user.name)}</span>
        </div>`;
      })
      .join('');
  }

  function renderFeed(songs) {
    loadingEl.style.display = 'none';

    if (!songs || songs.length === 0) {
      feedEl.innerHTML = `
        <div class="empty-state">
          <h2>No songs yet</h2>
          <p>Connect your Spotify account and start liking songs.<br>
          Your friends' likes will show up here too.</p>
        </div>`;
      return;
    }

    feedEl.innerHTML = songs
      .map((song) => {
        const avatar = song.liked_by.image
          ? `<img src="${esc(song.liked_by.image)}" alt="${esc(song.liked_by.name)}">`
          : `<div class="no-image-sm">${esc(song.liked_by.name.charAt(0).toUpperCase())}</div>`;

        const albumArt = song.track.album.image
          ? `<img class="album-art" src="${esc(song.track.album.image)}" alt="${esc(song.track.album.name)}">`
          : '';

        const spotifyLink = song.track.external_url || `https://open.spotify.com/track/${song.track.id}`;

        return `
        <div class="song-card">
          <div class="song-header">
            ${avatar}
            <div class="liked-by"><strong>${esc(song.liked_by.name)}</strong> liked a song</div>
            <div class="time-ago">${timeAgo(song.added_at)}</div>
          </div>
          <div class="song-info">
            ${albumArt}
            <div class="song-details">
              <div class="track-name"><a href="${esc(spotifyLink)}" target="_blank" rel="noopener">${esc(song.track.name)}</a></div>
              <div class="artist-name">${esc(song.track.artists.join(', '))}</div>
              <div class="album-name">${esc(song.track.album.name)}</div>
            </div>
          </div>
          <div class="song-embed">
            <iframe
              src="https://open.spotify.com/embed/track/${song.track.id}?utm_source=generator&theme=0"
              width="100%"
              height="80"
              frameborder="0"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
            ></iframe>
          </div>
        </div>`;
      })
      .join('');
  }

  function showError(message) {
    loadingEl.style.display = 'none';
    feedEl.innerHTML = `
      <div class="empty-state">
        <h2>Something went wrong</h2>
        <p>${esc(message)}</p>
      </div>`;
  }

  function showToast(message, isError = false) {
    const toast = document.createElement('div');
    toast.className = `toast${isError ? ' error' : ''}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.classList.add('show');
    });

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  function timeAgo(dateStr) {
    const now = new Date();
    const date = new Date(dateStr);
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function esc(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
