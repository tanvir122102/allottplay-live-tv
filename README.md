# Live TV Platform — Final Release (Phase 10)

Production-ready cumulative release of the Live TV web platform through Phase 10.

## Included
- M3U playlist CRUD + automatic channel import/sync
- Stable channel identity and preserved manual stream overrides
- Background HLS-aware stream health monitoring
- Secure admin authentication and protected admin APIs
- Premium responsive Live TV website with compact channel grid
- Categories, playlist filtering, search and localStorage favorites
- Advanced HLS player with reconnect, quality, audio/subtitles, PiP, fullscreen, zoom and aspect controls
- 7-second player control auto-hide and permanent player branding
- Smart TV / Android TV D-pad and channel navigation
- Screen Wake Lock where supported
- Admin branding/site settings
- API rate limiting, CSRF/origin protection, security headers and SSRF protection for server-side remote fetches
- Public API caching and database indexes for performance
- Installable PWA with offline public app shell; live media is never cached

## Requirements
- Node.js 18.18+ (Node 20 LTS recommended)
- PostgreSQL
- HTTPS in production

## Environment
Copy `.env.example` to `.env` and set strong production values:

- `DATABASE_URL`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD_HASH`
- `ADMIN_SESSION_SECRET` (use a long random value; 32+ characters recommended)
- `CRON_SECRET`
- Optional health settings
- Keep `ALLOW_PRIVATE_REMOTE_URLS=false` unless private/internal stream sources are intentionally required.

Generate an admin password hash:

```bash
npm install
npm run admin:hash -- "your-strong-password"
```

## Database and build

```bash
npm install
npm run db:generate
npm run db:push
npm run typecheck
npm run build
npm run start
```

This release uses Prisma `db push` rather than checked-in migration files. For a managed production database, review your organization's migration/backup policy before applying schema changes.

## Health checks
The Vercel configuration schedules `/api/v1/health/check` every 10 minutes. In production, the endpoint requires `Authorization: Bearer $CRON_SECRET`. For non-Vercel deployments, call the endpoint from your scheduler with the same header.

## Playback and stream policy
The browser connects directly to the authorized stream URL. The application does not proxy streams, bypass DRM, bypass CORS/provider restrictions, or cache live video. Browser/device support and the stream provider's own CORS/security policy still determine playback.

## Final QA note
Source-level integration checks and release cleanup were completed in this environment. A full `npm install`/Next production build could not be completed here because dependency installation timed out in the execution environment; run the commands above in the deployment environment before going live.
