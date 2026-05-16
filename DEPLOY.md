# Deployment Guide — Daily Stack Lab

This app is a vanilla Node.js HTTP server with zero npm dependencies. It deploys cleanly to any Node host that supports a persistent filesystem.

## Recommended: Render (free tier works)

1. Push this folder to a GitHub repo (private is fine).
2. Go to https://render.com → New → Web Service.
3. Connect the repo.
4. Configure:
   - **Environment:** Node
   - **Build command:** _(leave empty)_
   - **Start command:** `node server.mjs`
   - **Region:** Singapore (closest to Indonesia)
5. Add environment variables under **Environment**:
   - `ADMIN_TOKEN` — pick a strong random string (e.g. `openssl rand -hex 24`)
   - `CRM_WEBHOOK_URL` — your Google Sheets Apps Script URL (see `GOOGLE_SHEETS_SETUP.md`)
6. Click **Create Web Service**. Wait for the first deploy.
7. You'll get a URL like `https://daily-stack-lab.onrender.com`.

### Optional: add a custom domain

In Render → Settings → Custom Domains, add `dailystacklab.id` (or your domain). Render gives you a CNAME to point at. Free SSL is automatic.

## Alternative: Railway

1. https://railway.app → New Project → Deploy from GitHub.
2. Pick the repo.
3. Set environment variables same as Render.
4. Railway gives you a `*.up.railway.app` URL.

## Alternative: Fly.io

Requires the `fly` CLI. Lighter than Render but no free-forever tier.

```bash
fly launch        # accepts defaults, picks a region
fly secrets set ADMIN_TOKEN=your-token CRM_WEBHOOK_URL=your-url
fly deploy
```

## After deployment — checklist before sharing the URL

1. Open the live URL and complete the survey with a test email.
2. Confirm the lead row appears in the Google Sheet.
3. Open `/admin.html`, paste the `ADMIN_TOKEN`, click **Load leads** — your test lead should show up.
4. Click **Export CSV** — should download.
5. Delete the test lead row from the Sheet before sharing the URL.
6. Switch to mobile and walk through the page top to bottom. The sticky CTA should appear after the hero.

## Going further

### Add analytics
Open `public/index.html` and uncomment the GA4 / Meta Pixel / TikTok Pixel script blocks at the top. Replace each `REPLACE_*_ID` with your real ID. Events from `app.js` will start firing client-side automatically.

### Move to a database
The current setup writes leads to `data/leads.ndjson`. That works for hundreds of leads. For thousands, replace the file append in `server.mjs:90` with a Supabase, Postgres, or MongoDB insert. The webhook to Google Sheets continues working in parallel — no need to remove it.

### Add rate limiting
Before public traffic, add a simple in-memory rate limit (5 submissions per IP per hour is plenty) or front the app with Cloudflare and use their rate-limit rules.

### Custom error pages
The app currently returns plain-text `404 Not found` for unknown routes. If you want branded error pages, drop a `public/404.html` and update the `serveFile` catch in `server.mjs` to serve it.
