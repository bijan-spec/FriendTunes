# RadioFam - Project Notes

## What This Is
A web app where a group of friends share their recently liked Spotify songs. Each friend connects their Spotify account, and the feed shows everyone's liked songs in reverse chronological order with embedded Spotify players. Users can hide tracks and leave comments.

**Live URL:** https://friend-tunes.vercel.app

## File Structure
- `public/index.html` - Main page with feed and connect link
- `public/styles.css` - Dark glassmorphism design with Spotify green accents
- `public/app.js` - Frontend logic (feed rendering, hide, comments, session)
- `api/login.js` - Redirects to Spotify OAuth
- `api/callback.js` - Handles OAuth callback, stores refresh token, sets session cookie
- `api/feed.js` - Returns combined liked songs with hidden filtering and comment counts
- `api/users.js` - Returns list of connected users
- `api/hide.js` - POST endpoint to hide a track from the feed
- `api/comment.js` - POST endpoint to add a comment on a track
- `api/comments.js` - GET endpoint to fetch comments for a track
- `vercel.json` - Vercel routing config
- `package.json` - Dependencies
- `CLAUDE.md` - This project documentation

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks)
- **Backend:** Vercel serverless functions (Node.js, CommonJS)
- **Database:** Upstash Redis (stores users, hidden tracks, comments)
- **Auth:** Spotify Authorization Code flow + `rf_user` session cookie
- **Playback:** Spotify Embed Player (iframe, height=152)

## How It Works
1. Friends click "+ Connect Spotify" → OAuth flow → refresh token stored in Redis, session cookie set
2. Feed page calls `/api/feed` → backend fetches each user's recent liked songs
3. Songs merged, sorted by `added_at` descending, hidden tracks filtered out
4. Each song rendered with Spotify embed player and comment section
5. Users can hide tracks (X button) and leave comments (Enter to submit)

## Redis Keys
- `users` (Hash) - Maps Spotify user ID → JSON user data with refresh tokens
- `hidden` (Set) - Members are `trackId:userId` strings for hidden feed items
- `comments:{trackId}:{userId}` (List) - JSON comment objects, newest first via LPUSH

## Environment Variables
- `SPOTIFY_CLIENT_ID` - Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` - Spotify app client secret
- `APP_URL` - Deployed app URL (for OAuth redirect)
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST token

## Spotify API Endpoints Used
- `POST /api/token` - Exchange auth code / refresh tokens
- `GET /v1/me` - Get user profile
- `GET /v1/me/tracks` - Get user's saved/liked tracks

## Deployment
- Hosted on Vercel
- GitHub repo: https://github.com/bijan-spec/FriendTunes

## Friend Onboarding
1. Add friend's Spotify email in Spotify Developer Dashboard → User Management
2. Share the app URL — they click "+ Connect Spotify"
3. Up to 25 users in Development mode

## Version History

### v.2 (February 2026)
- Renamed from FriendTunes to RadioFam
- Fixed doubled-up track display (removed duplicate song info, kept Spotify embed only)
- Moved Connect Spotify to inline link under title
- Added user session via cookie
- Added hide/delete track from feed
- Added comments under each track
- Removed debug endpoint

### v.1 (February 2026)
- Initial release
- Spotify OAuth with multi-user support
- Liked songs feed with Spotify embeds
- Friends bar with avatars

## Owner
Built by @bijan (instagram.com/bijan)

## Last Updated
February 2026
