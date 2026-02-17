document.addEventListener('DOMContentLoaded', function () {
  var feedEl = document.getElementById('feed');
  var loadingEl = document.getElementById('loading');
  var friendsBar = document.getElementById('friendsBar');

  // Session: read logged-in user from cookie
  var currentUserId = getLoggedInUserId();

  // Handle URL params (post-connect or error)
  var params = new URLSearchParams(window.location.search);
  if (params.get('connected') === 'true') {
    showToast('Spotify connected!');
    window.history.replaceState({}, '', '/');
  } else if (params.get('error')) {
    showToast('Connection failed: ' + params.get('error'), true);
    window.history.replaceState({}, '', '/');
  }

  // Load the feed
  loadFeed();

  // Event delegation for hide buttons and comment inputs
  feedEl.addEventListener('click', function (e) {
    var hideBtn = e.target.closest('.hide-btn');
    if (hideBtn) handleHide(hideBtn);
  });

  feedEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var input = e.target.closest('.comment-input');
    if (input) handleComment(input);
  });

  async function loadFeed() {
    try {
      var res = await fetch('/api/feed');
      var data = await res.json();

      if (data.error) {
        showError(data.error);
        return;
      }

      renderFriendsBar(data.users);
      renderFeed(data.songs);
      loadAllComments(data.songs);
    } catch (err) {
      showError('Could not connect to server');
    }
  }

  function renderFriendsBar(users) {
    if (!users || users.length === 0) return;

    friendsBar.innerHTML = users
      .map(function (user) {
        var avatar = user.image
          ? '<img src="' + esc(user.image) + '" alt="' + esc(user.name) + '">'
          : '<div class="no-image">' + esc(user.name.charAt(0).toUpperCase()) + '</div>';
        return '<div class="friend-avatar">' + avatar + '<span>' + esc(user.name) + '</span></div>';
      })
      .join('');
  }

  function renderFeed(songs) {
    loadingEl.style.display = 'none';

    if (!songs || songs.length === 0) {
      feedEl.innerHTML =
        '<div class="empty-state">' +
        '<h2>No songs yet</h2>' +
        '<p>Connect your Spotify account and start liking songs.<br>' +
        'Your friends\' likes will show up here too.</p>' +
        '</div>';
      return;
    }

    feedEl.innerHTML = songs
      .map(function (song) {
        var avatar = song.liked_by.image
          ? '<img src="' + esc(song.liked_by.image) + '" alt="' + esc(song.liked_by.name) + '">'
          : '<div class="no-image-sm">' + esc(song.liked_by.name.charAt(0).toUpperCase()) + '</div>';

        var hideBtn = currentUserId
          ? '<button class="hide-btn" data-track-id="' + song.track.id + '" data-liked-by="' + song.liked_by.id + '" title="Hide from feed">&times;</button>'
          : '';

        var commentKey = song.track.id + '-' + song.liked_by.id;
        var commentCountText = song.commentCount > 0
          ? '<div class="comments-loading">Loading ' + song.commentCount + ' comment' + (song.commentCount !== 1 ? 's' : '') + '...</div>'
          : '';

        var commentInput = currentUserId
          ? '<div class="comment-input-row"><input type="text" class="comment-input" placeholder="Add a comment..." maxlength="280" data-track-id="' + song.track.id + '" data-liked-by="' + song.liked_by.id + '"></div>'
          : '';

        return '<div class="song-card">' +
          '<div class="song-header">' +
            avatar +
            '<div class="liked-by"><strong>' + esc(song.liked_by.name) + '</strong> liked</div>' +
            '<div class="time-ago">' + timeAgo(song.added_at) + '</div>' +
            hideBtn +
          '</div>' +
          '<div class="song-embed">' +
            '<iframe src="https://open.spotify.com/embed/track/' + song.track.id + '?utm_source=generator&theme=0" ' +
            'width="100%" height="152" frameborder="0" ' +
            'allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" ' +
            'loading="lazy"></iframe>' +
          '</div>' +
          '<div class="comments-section" data-comment-key="' + commentKey + '" data-track-id="' + song.track.id + '" data-liked-by="' + song.liked_by.id + '">' +
            '<div class="comments-list" id="comments-' + commentKey + '">' + commentCountText + '</div>' +
            commentInput +
          '</div>' +
        '</div>';
      })
      .join('');
  }

  async function loadAllComments(songs) {
    if (!songs) return;

    var songsWithComments = songs.filter(function (s) { return s.commentCount > 0; });

    for (var i = 0; i < songsWithComments.length; i++) {
      var song = songsWithComments[i];
      var commentKey = song.track.id + '-' + song.liked_by.id;
      var listEl = document.getElementById('comments-' + commentKey);
      if (!listEl) continue;

      try {
        var res = await fetch('/api/comments?trackId=' + encodeURIComponent(song.track.id) + '&likedBy=' + encodeURIComponent(song.liked_by.id));
        var data = await res.json();

        if (data.comments && data.comments.length > 0) {
          listEl.innerHTML = data.comments
            .map(function (c) {
              return '<div class="comment"><strong>' + esc(c.userName) + '</strong><span>' + esc(c.text) + '</span><span class="comment-time">' + timeAgo(c.timestamp) + '</span></div>';
            })
            .join('');
        } else {
          listEl.innerHTML = '';
        }
      } catch (err) {
        listEl.innerHTML = '';
      }
    }
  }

  async function handleHide(btn) {
    var trackId = btn.dataset.trackId;
    var likedBy = btn.dataset.likedBy;
    var card = btn.closest('.song-card');

    try {
      var res = await fetch('/api/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: trackId, likedByUserId: likedBy }),
      });

      if (res.ok) {
        card.style.transition = 'opacity 0.3s, transform 0.3s';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-20px)';
        setTimeout(function () { card.remove(); }, 300);
      }
    } catch (err) {
      showToast('Failed to hide track', true);
    }
  }

  async function handleComment(input) {
    var text = input.value.trim();
    if (!text) return;

    var trackId = input.dataset.trackId;
    var likedBy = input.dataset.likedBy;

    input.disabled = true;

    try {
      var res = await fetch('/api/comment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: trackId, likedByUserId: likedBy, text: text }),
      });

      var data = await res.json();

      if (data.ok && data.comment) {
        var commentKey = trackId + '-' + likedBy;
        var listEl = document.getElementById('comments-' + commentKey);
        var commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.innerHTML = '<strong>' + esc(data.comment.userName) + '</strong><span>' + esc(data.comment.text) + '</span><span class="comment-time">just now</span>';
        listEl.appendChild(commentEl);
        input.value = '';
      }
    } catch (err) {
      showToast('Failed to post comment', true);
    }

    input.disabled = false;
  }

  function showError(message) {
    loadingEl.style.display = 'none';
    feedEl.innerHTML =
      '<div class="empty-state">' +
      '<h2>Something went wrong</h2>' +
      '<p>' + esc(message) + '</p>' +
      '</div>';
  }

  function showToast(message, isError) {
    var toast = document.createElement('div');
    toast.className = 'toast' + (isError ? ' error' : '');
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(function () {
      toast.classList.add('show');
    });

    setTimeout(function () {
      toast.classList.remove('show');
      setTimeout(function () { toast.remove(); }, 300);
    }, 3000);
  }

  function timeAgo(dateStr) {
    var now = new Date();
    var date = new Date(dateStr);
    var seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h';
    var days = Math.floor(hours / 24);
    if (days < 7) return days + 'd';
    var weeks = Math.floor(days / 7);
    if (weeks < 4) return weeks + 'w';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getLoggedInUserId() {
    var match = document.cookie.match(/(?:^|; )rf_user=([^;]*)/);
    return match ? decodeURIComponent(match[1]) : null;
  }

  function esc(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
});
