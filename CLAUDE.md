# FriendTunes - Project Notes

## What This Is
A web app where a group of friends share their recently liked Spotify songs. Each friend connects their Spotify account, and the feed shows everyone's liked songs in reverse chronological order with embedded Spotify players.

**Live URL:** https://friendtunes.vercel.app (TBD)

## File Structure
- `public/index.html` - Main page with feed and connect flow
- `public/styles.css` - Dark glassmorphism design
- `public/app.js` - Frontend logic (fetch feed, render songs)
- `api/login.js` - Redirects to Spotify OAuth
- `api/callback.js` - Handles OAuth callback, stores refresh token
- `api/feed.js` - Returns combined liked songs from all connected users
- `api/users.js` - Returns list of connected users
- `vercel.json` - Vercel routing config
- `package.json` - Dependencies
- `CLAUDE.md` - This project documentation

## Architecture
- **Frontend:** Vanilla HTML/CSS/JS (no frameworks)
- **Backend:** Vercel serverless functions (Node.js)
- **Database:** Upstash Redis (stores user profiles + refresh tokens)
- **Auth:** Spotify Authorization Code flow
- **Playback:** Spotify Embed Player (iframe)

## How It Works
1. Friends click "Connect Spotify" → OAuth flow → refresh token stored in Redis
2. Feed page calls `/api/feed` → backend fetches each user's recent liked songs
3. Songs merged and sorted by `added_at` descending
4. Each song rendered with Spotify embed player, album art, and who liked it

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

## Owner
Built by @bijan (instagram.com/bijan)

## Last Updated
February 2026
