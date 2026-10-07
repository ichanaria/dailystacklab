# PWR UP — Customer Validation Platform

An AI-assisted full-stack application I built to validate a consumer wellness product before committing significant capital to launch.

**Live prototype:** https://dailystacklab.onrender.com/

PWR UP is an active-wellness brand I am building around everyday performance, starting with creatine-based products.

Rather than relying only on assumptions, presentations, or outsourced research, I wanted to put the proposition in front of real users, capture structured feedback, and use that evidence to make an actual product decision.

So I used AI-assisted coding to build the validation system myself.

---

## The Problem

Before taking a new supplement product to market, I wanted to answer several questions:

- Is there meaningful consumer interest in the problem we are solving?
- What prevents people from adopting creatine consistently?
- Which product formats are most attractive?
- What concerns need to be addressed through positioning and education?
- Would people be willing to test the product before launch?

The objective was not to claim product-market fit from a small validation exercise.

It was to **reduce uncertainty before committing more capital and time to product development.**

---

## What I Built

The application combines:

- Mobile-first product landing page
- Interactive customer validation survey
- Structured consumer profiling
- Product concept testing
- Sample-interest capture
- Lead capture API
- Simple CRM-style lead dashboard
- CSV export
- Analytics event tracking
- CRM / Google Sheets webhook integration

The workflow was designed to take someone from:

**Product proposition → Survey → Structured feedback → Lead capture → Analysis**

---

## Validation Results

The first validation cycle reached:

- **45 unique respondents**
- **33 contact-qualified leads**
- **31 people interested in at least one product concept**
- **28 people who opted in for product sample testing**

The responses also surfaced an important product insight:

> The barrier to creatine adoption was not simply awareness. Trust, education, and making supplementation easy to maintain consistently were equally important.

These findings helped shape the product positioning, consumer education, and the decision about which product to take forward first.

---

## From Data to a Real Product Decision

The most valuable part of this project was not collecting survey responses.

It was using the data to make an actual business decision.

The validation insights helped inform PWR UP's first commercial SKU. From there, I moved from digital validation into physical product development:

**Customer hypothesis  
→ Working validation product  
→ Customer data  
→ Product decision  
→ Formulation  
→ Product samples  
→ Lab testing  
→ BPOM registration  
→ Commercial launch**

The first SKU has since gone through formulation and sample iterations and is now progressing through **lab testing and BPOM registration in Indonesia** ahead of launch.

This made the software more than a prototype — it became part of the decision-making infrastructure for a real consumer product.

---

## Why I Built It This Way

My background is primarily in commercial leadership, enterprise SaaS, e-commerce, and go-to-market — not software engineering.

What changed for me with AI coding tools is the distance between an idea and a working experiment.

Instead of stopping at a product brief or waiting for development resources, I could:

1. Define the business hypothesis
2. Build a working application
3. Deploy it
4. Put it in front of users
5. Capture structured customer data
6. Analyze the responses
7. Make a better-informed product decision

That **build → measure → learn → execute** loop is what I am most proud of in this project.

---

## Project Structure

The application is a dependency-light Node.js prototype.

Key components include:

- `server.mjs` — application server and API
- `public/` — landing page, survey, and admin interface
- `data/` — local development data storage
- `GOOGLE_SHEETS_SETUP.md` — lead capture integration
- `DEPLOY.md` — deployment instructions
- `ENGINEER_HANDOFF_LANDING_PAGE.md` — detailed implementation handoff
- `LANDING_PAGE_WIREFRAME_v0.1.md` — initial UX and content structure
- `PWR_UP_Brand_Identity_v1.1.md` — brand and product direction

---

## Run Locally

From the repository:

```bash
node server.mjs
```

### Main Application

Open:

```text
http://127.0.0.1:5177
```

### Lead Dashboard

Open:

```text
http://127.0.0.1:5177/admin.html
```

### Customer Validation Survey

Open:

```text
http://127.0.0.1:5177/creatine-fit-quiz
```

---

## Environment Variables

Optional:

```bash
PORT=5177
ADMIN_TOKEN=choose-a-private-token
CRM_WEBHOOK_URL=https://your-crm-or-automation-webhook
```

If `ADMIN_TOKEN` is set, `/api/leads`, `/api/leads.csv`, and the admin dashboard require the token.

---

## Data & CRM Integration

For local development, leads are stored in:

```text
data/leads.ndjson
```

Analytics events are stored in:

```text
data/events.ndjson
```

For live deployment, the application can forward captured leads through `CRM_WEBHOOK_URL` into tools such as:

- Google Sheets
- Airtable
- HubSpot
- Klaviyo
- Make / Zapier
- Other CRM or automation systems

See `GOOGLE_SHEETS_SETUP.md` for the Google Sheets implementation used during validation.

---

## Deployment

The application can run on Node-compatible hosts such as:

- Render
- Railway
- Fly.io
- VPS environments

The current public prototype is deployed on Render:

**https://dailystacklab.onrender.com/**

---

## Compliance

Because this project relates to a regulated consumer health product, the prototype intentionally avoids presenting unfinished regulatory claims as final product claims.

The first commercial SKU is currently progressing through product development, lab testing, and BPOM registration in Indonesia.

---

## What This Project Taught Me

The biggest takeaway was not that AI helped me write code faster.

It was that AI-assisted development allowed me, as a commercial operator, to shorten the distance between:

**idea → working software → customer evidence → business decision → execution**

That fundamentally changed how I think about experimentation and building products.
