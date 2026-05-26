# Google Sheets Lead Capture — Setup in 5 Minutes

This is the fastest, free path to get leads flowing into a sheet you own. No third-party service. No paid plan.

## Step 1: Create the sheet

1. Go to https://sheets.new (creates a new blank Google Sheet).
2. Rename it to something like **Daily Stack Lab Leads**.
3. In row 1, paste this header row (one header per column, A through W):

```
createdAt	captureStage	sessionId	name	email	whatsapp	gender	age	height	weight	freq	activities	goals	concerns	experience	format	productInterest	sampleInterest	monthlyBudget	notes	profileType	consent	source
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
  const list = (value) => Array.isArray(value) ? value.join("; ") : (value || "");

  const row = [
    data.createdAt || new Date().toISOString(),
    data.captureStage || "",
    data.sessionId || "",
    data.name || "",
    data.email || "",
    data.whatsapp || "",
    data.gender || "",
    data.age || "",
    data.height || "",
    data.weight || "",
    data.freq || "",
    list(data.activities),
    list(data.goals),
    list(data.concerns),
    data.experience || "",
    data.format || "",
    data.productInterest || "",
    data.sampleInterest || "",
    data.monthlyBudget || "",
    data.notes || "",
    data.consent ? "yes" : "no",
    data.source || "",
  ];

  const sessionId = data.sessionId || "";
  const email = data.email || "";
  let targetRow = -1;

  if (sessionId && sheet.getLastRow() > 1) {
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, row.length).getValues();
    for (let i = rows.length - 1; i >= 0; i--) {
      const existingSessionId = rows[i][2];
      const existingEmail = rows[i][4];
      if (existingSessionId === sessionId && (!existingEmail || !email || existingEmail === email)) {
        targetRow = i + 2;
        break;
      }
    }
  }

  if (targetRow > -1) {
    const existing = sheet.getRange(targetRow, 1, 1, row.length).getValues()[0];
    const merged = row.map((value, index) => value !== "" ? value : existing[index]);
    if (existing[1] === "email_unlocked" || data.captureStage === "email_unlocked") {
      merged[1] = "email_unlocked";
    }
    if (existing[20] === "yes" || data.consent) {
      merged[20] = "yes";
    }
    sheet.getRange(targetRow, 1, 1, merged.length).setValues([merged]);
  } else {
    sheet.appendRow(row);
  }

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
- If you copied an older version of this script, replace it with the current script above and redeploy a new version.

**Want to redeploy?**
- Apps Script changes need a new deployment for the URL to pick them up. Use **Deploy → Manage deployments → Edit (pencil icon) → New version**.

## Migrating to a real CRM later

When you outgrow Sheets, replace `CRM_WEBHOOK_URL` with:

- **HubSpot:** their Contact API endpoint
- **Klaviyo:** their Profile API endpoint
- **Airtable:** an automation webhook
- **Notion:** a Notion database via integration

The lead JSON payload is stable across destinations — only the destination URL changes.
