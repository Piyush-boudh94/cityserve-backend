# CityServe Backend — Railway Deployment Guide

## What This Backend Provides

All endpoints your Android app needs:
- Citizen login via Firebase Phone Auth (OTP)
- Admin/Worker login via Firebase Email+Password
- Complaints CRUD with upvote, save, comments
- Wards, Categories, Dashboard stats, Leaderboard, Alerts
- FCM push notifications (when FIREBASE_SERVICE_ACCOUNT is set)

---

## Step-by-Step Railway Deployment

### Step 1 — Push to GitHub

Open a terminal in this project folder and run:

```bash
git init
git add .
git commit -m "CityServe backend"
```

Go to [github.com](https://github.com) → New repository → name it `cityserve-backend` → copy the repo URL, then:

```bash
git remote add origin https://github.com/YOURUSERNAME/cityserve-backend.git
git branch -M main
git push -u origin main
```

### Step 2 — Deploy on Railway

1. Go to [railway.app](https://railway.app) → sign in with GitHub
2. Click **New Project** → **Deploy from GitHub repo**
3. Select your `cityserve-backend` repository
4. Railway will auto-detect the `railway.json` config

### Step 3 — Add PostgreSQL Database

In your Railway project dashboard:
1. Click **+ New** → **Database** → **PostgreSQL**
2. Railway automatically sets the `DATABASE_URL` environment variable — no copy-pasting needed!

### Step 4 — Add Environment Variables

In Railway dashboard → your service → **Variables** tab, add:

| Variable | Value |
|----------|-------|
| `JWT_SECRET` | any long random string (e.g. `cityserve-super-secret-key-2024`) |
| `NODE_ENV` | `production` |
| `FIREBASE_SERVICE_ACCOUNT` | (optional — see below) |

> `PORT` and `DATABASE_URL` are set automatically by Railway.

### Step 5 — Run Database Migration (ONE TIME)

After the first deploy, go to your service → click the **terminal/shell** icon and run:

```bash
pnpm --filter @workspace/db run push
```

This creates all the database tables.

### Step 6 — Seed Initial Data

In the Railway terminal, run this SQL to seed categories, wards, and create the admin account:

```bash
# The app provides a seed command — or run this SQL in the Railway PostgreSQL console:
```

Go to your PostgreSQL service → **Connect** tab → copy the connection URL → use it to run:
```sql
-- Paste the contents of the seed SQL below into Railway's query editor
```

Or use this simpler method: After deploying, call the seeding through the API by running your Android app — the categories and wards will auto-populate when needed.

> **Quick seed:** Railway Dashboard → PostgreSQL service → **Query** tab → paste and run the SQL from `scripts/src/seed-sql.sql`

### Step 7 — Get Your Live URL

Railway gives you a URL like:
```
https://cityserve-backend-production.up.railway.app
```

### Step 8 — Update Your Android App

In `android/app/build.gradle`, set:

```gradle
buildConfigField "String", "BASE_URL", '"https://YOUR-APP.up.railway.app/api/"'
```

> **Important:** Keep the trailing `/api/` and make sure the double quotes are inside the single quotes exactly as shown.

---

## Firebase Setup (Required for Phone Auth)

### 1. Enable Sign-in Methods
Firebase Console → Authentication → Sign-in method → Enable:
- **Phone** (for citizens)
- **Email/Password** (for admin)

### 2. Add SHA-1 Fingerprint (Phone Auth won't work without this)
```bash
# Run in your Android project folder:
keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
```
Copy the SHA-1 → Firebase Console → Project Settings → your Android app → Add fingerprint

### 3. Create Admin User in Firebase
Firebase Console → Authentication → Users → Add user:
- Email: `admin@cityserve.com`
- Password: `admin123`

### 4. Add Firebase Service Account to Railway (for token verification)
Firebase Console → Project Settings → Service Accounts → Generate new private key → download JSON

In Railway Variables tab, add:
- Name: `FIREBASE_SERVICE_ACCOUNT`
- Value: Paste the entire JSON content

> Without this, the backend runs in **dev mode** — tokens are decoded without cryptographic verification. Fine for testing, add it before going to production.

---

## Test Accounts

| Email | Password | Role |
|-------|----------|------|
| `admin@cityserve.com` | `admin123` | Admin |
| `worker@cityserve.com` | `worker123` | Worker |

Citizens log in via Firebase Phone Auth (no email/password needed).

---

## Verify Deployment

Once deployed, test these URLs in your browser:

```
https://YOUR-APP.up.railway.app/api/healthz     → {"status":"ok"}
https://YOUR-APP.up.railway.app/api/categories  → list of 8 categories
https://YOUR-APP.up.railway.app/api/wards        → list of 10 wards
```

---

## All Available Endpoints

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /api/healthz` | None | Health check |
| `POST /api/auth/citizen/firebase` | None | Firebase phone login |
| `POST /api/auth/citizen/request-otp` | None | Request OTP (testing) |
| `POST /api/auth/citizen/verify-otp` | None | Verify OTP |
| `POST /api/auth/admin` | None | Admin/Worker login |
| `GET /api/users/me` | Auth | Get current user |
| `PUT /api/users/me` | Auth | Update profile |
| `POST /api/auth/fcm-token` | Auth | Update FCM token |
| `GET /api/wards` | None | List wards |
| `GET /api/categories` | None | List categories |
| `GET /api/complaints` | Auth | List complaints (paginated) |
| `POST /api/complaints` | Auth | Submit complaint |
| `GET /api/complaints/my` | Auth | My complaints |
| `GET /api/complaints/saved` | Auth | Saved complaints |
| `GET /api/complaints/nearby` | Auth | Nearby complaints |
| `GET /api/complaints/assigned` | Worker/Admin | Assigned complaints |
| `GET /api/complaints/:id` | Auth | Complaint detail |
| `PUT /api/complaints/:id/status` | Worker/Admin | Update status |
| `POST /api/complaints/:id/assign` | Admin | Assign to worker |
| `GET /api/complaints/:id/updates` | Auth | Status history |
| `POST /api/complaints/:id/upvote` | Auth | Toggle upvote |
| `POST /api/complaints/:id/save` | Auth | Toggle save |
| `GET /api/complaints/:id/comments` | Auth | Get comments |
| `POST /api/complaints/:id/comments` | Auth | Add comment |
| `GET /api/dashboard/stats` | Admin/Worker | Dashboard stats |
| `GET /api/dashboard/recent` | Admin/Worker | Recent complaints |
| `GET /api/dashboard/urgent` | Admin/Worker | Urgent complaints |
| `GET /api/users` | Admin | All users |
| `GET /api/workers` | Admin | All workers |
| `GET /api/leaderboard` | Auth | Citizen leaderboard |
| `GET /api/alerts` | Auth | Alerts/notifications |
| `POST /api/alerts` | Admin | Create alert |
| `POST /api/storage/upload` | Auth | Upload image |
