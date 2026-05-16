# Engineer Handoff: Active Wellness Stack Landing Page + Survey

Prepared for: PWR UP / Irsan  
Status: Working prototype, ready for engineering review and deployment planning  
Current folder: `/Users/irsanaria/Documents/PWR UP/fullstack-landing`

## 1. What This Is

This folder contains the current full-stack landing page prototype for the pre-launch validation funnel.

It includes:

- landing page
- embedded interactive creatine survey
- personalized report fallback endpoint
- lead capture API
- local CRM-style dashboard
- CSV export
- analytics event placeholders
- optional CRM webhook forwarding

The public landing page intentionally does not lead with the final PWR UP brand name because Indonesian trademark / HAKI registration is still in progress.

Current public-facing temporary label:

> Daily Stack Lab

Internal brand idea:

> PWR UP: Move. Focus. Recover.

First product validation:

> PWR UP Move / creatine-based active living stack, with drink mix and gummy MVP paths.

## 2. Folder To Share

Share this folder with the engineer:

```text
/Users/irsanaria/Documents/PWR UP/fullstack-landing
```

This folder is now self-contained for the landing page and survey. The embedded survey file has been copied into:

```text
public/creatine-fit-quiz.html
```

The engineer does not need to rely on the parent project quiz file to run the current landing page.

## 3. File Map

```text
fullstack-landing/
  package.json
  server.mjs
  README.md
  ENGINEER_HANDOFF_LANDING_PAGE.md
  LANDING_PAGE_WIREFRAME_v0.1.md
  data/
    .gitkeep
    leads.ndjson        # created at runtime, ignored by git
    events.ndjson       # created at runtime, ignored by git
  public/
    index.html
    styles.css
    app.js
    creatine-fit-quiz.html
    admin.html
    admin.js
```

## 4. How To Run Locally

No npm install is required. This prototype uses only built-in Node.js APIs.

Recommended Node:

```text
Node 20+
```

Run:

```bash
cd "/Users/irsanaria/Documents/PWR UP/fullstack-landing"
node server.mjs
```

Open:

```text
http://127.0.0.1:5177
```

Admin dashboard:

```text
http://127.0.0.1:5177/admin.html
```

Embedded survey route:

```text
http://127.0.0.1:5177/creatine-fit-quiz
```

## 5. Environment Variables

Optional:

```bash
PORT=5177
ADMIN_TOKEN=choose-a-private-token
CRM_WEBHOOK_URL=https://your-crm-or-automation-webhook
```

### `PORT`

Sets the server port.

Default:

```text
5177
```

### `ADMIN_TOKEN`

If set, the lead dashboard API and CSV export require a token.

Use the token in the dashboard input field, or call:

```text
/api/leads?token=YOUR_TOKEN
/api/leads.csv?token=YOUR_TOKEN
```

### `CRM_WEBHOOK_URL`

Optional webhook destination for forwarding leads to a CRM, Airtable automation, Google Sheets automation, Make, Zapier, HubSpot, Klaviyo, or similar.

Current behavior:

- lead is saved locally first
- if webhook env var exists, lead is also posted to that webhook
- webhook failures do not block the user-facing success response

## 6. Routes

### Pages

```text
GET /
```

Serves the landing page.

```text
GET /creatine-fit-quiz
```

Serves the embedded interactive creatine quiz from `public/creatine-fit-quiz.html`.

```text
GET /admin.html
```

Serves a simple CRM-style dashboard for reviewing submissions.

### APIs

```text
POST /api/leads
```

Stores a lead submission.

Supports two payload shapes:

1. Landing page survey payload.
2. Embedded creatine quiz payload with `profile`.

```text
GET /api/leads
```

Returns saved leads as JSON.

```text
GET /api/leads.csv
```

Exports saved leads as CSV.

```text
POST /api/events
```

Stores lightweight analytics events locally.

```text
POST /api/generate-creatine-report
```

Generates a local fallback personalized report for the embedded creatine quiz.

This is intentionally safe and deterministic. It does not call OpenAI or Gemini in the current `fullstack-landing` app.

## 7. Current Data Capture

Lead fields normalized by `server.mjs`:

```text
createdAt
firstName
email
whatsapp
activityType
creatineAwareness
preferredFormat
mvpInterest
sampleInterest
priceRange
concerns
notes
source
utm
```

Runtime files:

```text
data/leads.ndjson
data/events.ndjson
```

These are ignored by git through the root `.gitignore`:

```text
fullstack-landing/data/*.ndjson
```

## 8. Landing Page Content Strategy

The current landing page is a brand-light validation page.

Main sections:

1. Header
2. Hero
3. Overall idea
4. Move / Focus / Recover product system
5. MVP concepts: drink mix and gummy
6. Trust system
7. Personal creatine fit survey callout
8. Embedded Creatine Fit Quiz
9. FAQ
10. Footer

Current message:

> A simple daily wellness stack for people who move, work, train, parent, recover, and want supplement habits that are easier to repeat.

The page avoids saying:

- BPOM registered
- Halal certified
- guaranteed results
- cure / treat / prevent / heal
- fat loss
- testosterone
- instant transformation
- hardcore bodybuilder language

## 9. Survey / Quiz Details

The embedded survey is based on the existing Creatine Research Database project prototype.

Current file:

```text
public/creatine-fit-quiz.html
```

User flow:

1. Basic profile
2. Activity selection
3. Training frequency
4. Goals
5. Experience / preferred format / concerns
6. Preview report
7. Email and WhatsApp capture
8. Personalized report result

The quiz currently posts leads to:

```text
POST /api/leads
```

It requests a personalized report from:

```text
POST /api/generate-creatine-report
```

In this handoff version, the report endpoint is a local fallback. It does not use external AI APIs.

## 10. Analytics Placeholders

Prepared events:

```text
page_view
scroll_50
scroll_90
join_early_access_click
personal_survey_click
form_start
form_submit
product_interest_selected
preferred_format_selected
```

Current behavior:

- Events are posted to `/api/events`.
- `app.js` includes TODO comments for GA4, Meta Pixel, and TikTok Pixel.

Recommended next implementation:

- GA4 client-side event tracking
- Meta Pixel browser event tracking
- TikTok Pixel browser event tracking
- Optional server-side CAPI later

## 11. CRM / Database Recommendation

For the WPP Bali soft-pitch timeline, recommended path:

### Fastest

Use current local dashboard + CSV export during testing.

### Better for live sharing

Connect `CRM_WEBHOOK_URL` to one of:

- Airtable via Make/Zapier
- Google Sheets via Make/Zapier
- HubSpot form/contact API
- Klaviyo profile API
- Supabase / Postgres API

Recommended first live CRM:

> Airtable or Google Sheets through Make/Zapier, because the team can inspect responses quickly during the event.

## 12. Deployment Notes

Because this prototype uses a Node server and local file storage, it is best deployed to a Node host rather than pure static hosting.

Good short-term deployment options:

- Render Web Service
- Railway
- Fly.io
- VPS

Vercel/Netlify note:

- The landing page itself can be migrated to Vercel/Netlify.
- The lead API and report API should be converted to serverless functions or a Next.js App Router app.
- Local `.ndjson` storage should be replaced with a real database or CRM webhook.

## 13. Known Technical Limitations

1. No production database yet.
2. No rate limiting.
3. No spam protection / CAPTCHA.
4. No consent checkbox yet.
5. No email automation yet.
6. No real CRM integration yet unless `CRM_WEBHOOK_URL` is configured.
7. No production analytics pixel installed yet.
8. The embedded quiz is a large standalone HTML file and should eventually be refactored.
9. Product visuals are still concept-level and need stronger mockups.
10. Creatine education section needs to be expanded in the next revision.

## 14. Recommended Engineering Next Steps

Priority order:

1. Deploy the current Node app to a staging URL.
2. Connect `CRM_WEBHOOK_URL` to Airtable or Google Sheets.
3. Add admin token for dashboard and CSV export.
4. Add privacy / consent language before live sharing.
5. Improve survey completion UX on mobile.
6. Add better product mockups and lifestyle visuals.
7. Add a stronger creatine education section with research-backed expandable cards.
8. Replace local report fallback with the stronger research-personalization engine if desired.
9. Add GA4, Meta Pixel, and TikTok Pixel.
10. Add spam/rate protection before public traffic.

## 15. Founder Review Items

Before sending broadly:

1. Confirm temporary public label:
   - `Daily Stack Lab`
   - or `Active Wellness Study`
   - or another neutral label

2. Confirm product priority:
   - drink mix first
   - gummy first
   - both equally

3. Confirm whether the survey should collect:
   - early customer leads only
   - partner / agency / investor interest too

4. Confirm whether WhatsApp should be optional or required for sample testing.

5. Confirm compliance-sensitive wording:
   - creatine benefits
   - BPOM pathway
   - halal-conscious formulation
   - sample testing invitation
   - any final dosage language

## 16. Compliance Guardrails

Do not publish final claims until reviewed against the final formula and regulatory pathway.

Avoid:

- BPOM registered unless approved
- Halal certified unless approved
- clinically proven unless legally substantiated
- doctor approved
- guaranteed results
- cure, treat, prevent, heal
- fat loss
- testosterone
- instant performance
- disease claims

Safer wording:

- supports active living
- designed for daily routine
- creatine-based active living stack
- BPOM pathway in mind
- halal-conscious sourcing
- designed to make creatine easier to take consistently

## 17. Quick QA Checklist

Before live deployment:

- Landing page loads on mobile and desktop.
- `/creatine-fit-quiz` loads.
- Quiz can reach completion.
- `/api/leads` saves landing-page and quiz submissions.
- `/admin.html` can load leads.
- `/api/leads.csv` exports leads.
- No fake BPOM or Halal logos.
- No final certification claims.
- Contact data is protected with `ADMIN_TOKEN`.
- CRM webhook receives data, if configured.
- Test submissions are removed before sharing.

