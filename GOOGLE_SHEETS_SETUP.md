# Google Sheets Lead Capture — Setup in 5 Minutes

This is the fastest, free path to get leads flowing into a sheet you own. No third-party service. No paid plan.

## Step 1: Create the sheet

1. Go to https://sheets.new (creates a new blank Google Sheet).
2. Rename it to something like **Daily Stack Lab Leads**.
3. In row 1, paste this header row (one header per column, A through O):

```
createdAt	firstName	email	whatsapp	activityType	creatineAwareness	preferredFormat	mvpInterest	sampleInterest	priceRange	concerns	notes	consent	language	source
```

Tip: copy that whole line, click cell A1, and paste. It will split across columns automatically.

## Step 2: Add the Apps Script

1. In the sheet, go to **Extensions → Apps Script**.
2. Delete the default `function myFunction() { ... }` placeholder.
3. Paste this in:

```javascript
function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = JSON.parse(e.postData.contents);

  sheet.appendRow([
    data.createdAt || new Date().toISOString(),
    data.firstName || "",
    data.email || "",
    data.whatsapp || "",
    data.activityType || "",
    data.creatineAwareness || "",
    data.preferredFormat || "",
    data.mvpInterest || "",
    data.sampleInterest || "",
    data.priceRange || "",
    Array.isArray(data.concerns) ? data.concerns.join("; ") : (data.concerns || ""),
    data.notes || "",
    data.consent ? "yes" : "no",
    data.language || "",
    data.source || "",
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

4. Save the script (Ctrl/Cmd + S) and give the project any name.

## Step 3: Deploy as a web app

1. Click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" and choose **Web app**.
3. Fill in:
   - Description: `Daily Stack Lab leads webhook`
   - Execute as: **Me (your-email@gmail.com)**
   - Who has access: **Anyone** (this means anyone with the URL can POST — that's what we need)
4. Click **Deploy**.
5. The first time, Google asks for permissions. Click **Authorize access** and approve.
6. Copy the **Web app URL**. It looks like: `https://script.google.com/macros/s/AKfycb...../exec`

## Step 4: Wire it to the landing page

Set the `CRM_WEBHOOK_URL` environment variable to that URL when you run or deploy the app.

### Local testing
```bash
CRM_WEBHOOK_URL="https://script.google.com/macros/s/AKfycb...../exec" \
  node server.mjs
```

### Render / Railway / Fly
Add `CRM_WEBHOOK_URL` to the environment variables in the host's dashboard.

## Step 5: Test it

1. Open http://127.0.0.1:5177
2. Take the survey end-to-end with a test email.
3. Switch to the Google Sheet — a new row should appear within a few seconds.

## Troubleshooting

**No rows appear in the sheet?**
- Check the server logs. If you see `CRM webhook failed: ...`, the URL is wrong or the script needs reauthorization.
- Open the Apps Script editor → **Executions** tab to see if the doPost was triggered.

**Rows have empty cells?**
- Check the header order in the sheet matches the order in the `appendRow` call exactly.

**Want to redeploy?**
- Apps Script changes need a new deployment for the URL to pick them up. Use **Deploy → Manage deployments → Edit (pencil icon) → New version**.

## Migrating to a real CRM later

When you outgrow Sheets, replace `CRM_WEBHOOK_URL` with:

- **HubSpot:** their Contact API endpoint
- **Klaviyo:** their Profile API endpoint
- **Airtable:** an automation webhook
- **Notion:** a Notion database via integration

The lead JSON payload is stable across destinations — only the destination URL changes.
