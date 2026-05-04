# CityServe Backend

## Overview

Full backend REST API for the CityServe Android app — a civic complaint management platform. Built with Node.js/Express, PostgreSQL, and Drizzle ORM. Ready to deploy on Railway.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 20+
- **Package manager**: pnpm
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT tokens + Firebase Admin SDK (phone auth for citizens, email/password for admin)
- **Push notifications**: Firebase Cloud Messaging (FCM)
- **Validation**: Zod
- **Build**: esbuild (ESM bundle)

## Key Commands

- `pnpm --filter @workspace/api-server run dev` — build and run API server locally
- `pnpm --filter @workspace/api-server run build` — build for production
- `pnpm --filter @workspace/db run push` — push DB schema changes (creates/updates tables)
- `pnpm --filter @workspace/db run push-force` — force push (use when enum conflicts occur)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret for signing JWT tokens |
| `SESSION_SECRET` | Fallback | Used if JWT_SECRET not set |
| `FIREBASE_SERVICE_ACCOUNT` | Optional | Firebase Admin SDK JSON (enables token verification + FCM) |
| `PORT` | Auto | Set automatically by Railway/Replit |

## Database Tables

- `users` — citizens, workers, admins (Firebase UID + phone for citizens)
- `wards` — 10 wards seeded
- `categories` — 8 complaint categories seeded
- `complaints` — civic complaints with status/priority/GPS
- `complaint_updates` — status change history
- `upvotes` — complaint upvotes per user
- `saves` — saved complaints per user
- `comments` — comments on complaints
- `alerts` — system alerts/notifications
- `otp_sessions` — temporary OTP sessions for testing

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| admin@cityserve.com | admin123 | admin |
| worker@cityserve.com | worker123 | worker |
| +911234567890 | (Firebase OTP) | citizen |

## Deployment

See `RAILWAY_DEPLOY_GUIDE.md` for the full step-by-step Railway deployment guide.

Quick summary:
1. Push to GitHub
2. Connect repo on railway.app
3. Add PostgreSQL database on Railway
4. Set `JWT_SECRET` environment variable
5. Run `pnpm --filter @workspace/db run push` in Railway terminal
6. Copy your Railway URL → put in Android `build.gradle` as `BASE_URL`
