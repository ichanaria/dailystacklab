# Daily Stack Validation Landing Page

This is a dependency-free full-stack prototype for the pre-trademark validation funnel.

It includes:

- a mobile-first landing page
- interactive quiz / customer validation survey
- lead capture API
- local CRM-style lead dashboard
- CSV export
- analytics event placeholders
- optional CRM webhook forwarding

The complete landing page handoff for engineers is in:

```text
ENGINEER_HANDOFF_LANDING_PAGE.md
```

## Run Locally

From this folder:

```bash
node server.mjs
```

Open:

```text
http://127.0.0.1:5177
```

Dashboard:

```text
http://127.0.0.1:5177/admin.html
```

Embedded survey:

```text
http://127.0.0.1:5177/creatine-fit-quiz
```

## Environment Variables

Optional:

```bash
PORT=5177
ADMIN_TOKEN=choose-a-private-token
CRM_WEBHOOK_URL=https://your-crm-or-automation-webhook
```

If `ADMIN_TOKEN` is set, `/api/leads`, `/api/leads.csv`, and the dashboard need the token.

## Data Storage

Leads are stored locally in:

```text
data/leads.ndjson
```

Analytics events are stored locally in:

```text
data/events.ndjson
```

For live deployment, connect `CRM_WEBHOOK_URL` to a CRM or automation tool such as Airtable, Google Sheets via Make/Zapier, HubSpot, Klaviyo, or another lead database.

## Live Deployment Notes

This app does not require npm packages. It can run on any Node host that supports a persistent filesystem or webhook forwarding.

Recommended quick hosts:

- Render Web Service
- Railway
- Fly.io
- VPS

For Vercel/Netlify, the cleaner long-term path is to migrate this into Next.js or serverless functions after the Bali validation sprint.

## Compliance Notes

The page avoids final claims such as BPOM registered, Halal certified, cure, treat, prevent, guaranteed results, fat loss, testosterone, or instant transformation.

Copy still needing founder/regulatory review:

- any creatine benefit wording
- any halal-conscious wording
- any BPOM pathway wording
- any sample testing or final product dosage copy
