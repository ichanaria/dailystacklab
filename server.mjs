import { createServer } from "node:http";
import { appendFile, mkdir, readFile, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const quizHtmlPath = resolve(publicDir, "creatine-fit-quiz.html");
const dataDir = resolve(__dirname, "data");
const leadsPath = join(dataDir, "leads.ndjson");
const eventsPath = join(dataDir, "events.ndjson");
const port = Number(process.env.PORT || 5177);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

await mkdir(dataDir, { recursive: true });

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

    if (request.method === "POST" && url.pathname === "/api/leads") {
      await handleLeadPost(request, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/leads") {
      await handleLeadGet(request, response, url);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/leads.csv") {
      await handleLeadCsv(request, response, url);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/events") {
      await handleEventPost(request, response);
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/generate-creatine-report") {
      await handleCreatineReport(request, response);
      return;
    }

    if (request.method === "GET") {
      await serveStatic(url.pathname, response);
      return;
    }

    sendJson(response, 405, { ok: false, error: "Method not allowed" });
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { ok: false, error: "Unexpected server error" });
  }
});

server.listen(port, () => {
  console.log(`Validation landing page running at http://127.0.0.1:${port}`);
});

async function handleLeadPost(request, response) {
  const body = await readJsonBody(request);
  const lead = normalizeLead(body);
  const errors = validateLead(lead);

  if (Object.keys(errors).length > 0) {
    sendJson(response, 400, { ok: false, errors });
    return;
  }

  lead.id = randomUUID();
  lead.createdAt = new Date().toISOString();
  lead.source = lead.source || "validation_landing_page";
  lead.utm = getUtmFields(body);

  await appendFile(leadsPath, `${JSON.stringify(lead)}\n`, "utf8");

  // TODO: Replace or extend this with Airtable, HubSpot, Klaviyo, Mailchimp,
  // Google Sheets, Meta CAPI, TikTok Events API, or another CRM destination.
  if (process.env.CRM_WEBHOOK_URL) {
    forwardLeadToWebhook(lead).catch((error) => {
      console.error("CRM webhook failed:", error.message);
    });
  }

  sendJson(response, 201, {
    ok: true,
    leadId: lead.id,
    message: "You are on the early list. We will reach out with product testing updates soon.",
  });
}

async function handleLeadGet(request, response, url) {
  if (!isAuthorized(request, url)) {
    sendJson(response, 401, { ok: false, error: "Unauthorized" });
    return;
  }

  const leads = await readNdjson(leadsPath);
  sendJson(response, 200, { ok: true, leads });
}

async function handleLeadCsv(request, response, url) {
  if (!isAuthorized(request, url)) {
    sendText(response, 401, "Unauthorized");
    return;
  }

  const leads = await readNdjson(leadsPath);
  const columns = [
    "createdAt",
    "firstName",
    "email",
    "whatsapp",
    "activityType",
    "creatineAwareness",
    "preferredFormat",
    "mvpInterest",
    "sampleInterest",
    "priceRange",
    "concerns",
    "notes",
    "consent",
    "language",
    "source",
  ];

  const lines = [
    columns.join(","),
    ...leads.map((lead) =>
      columns
        .map((column) => csvCell(Array.isArray(lead[column]) ? lead[column].join("; ") : lead[column] || ""))
        .join(","),
    ),
  ];

  response.writeHead(200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": "attachment; filename=\"validation-leads.csv\"",
  });
  response.end(lines.join("\n"));
}

async function handleEventPost(request, response) {
  const body = await readJsonBody(request);
  const event = {
    id: randomUUID(),
    name: sanitizeString(body.name, 80),
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
    createdAt: new Date().toISOString(),
  };

  // Prepared analytics events: page_view, scroll_50, scroll_90,
  // join_early_access_click, form_start, form_submit,
  // product_interest_selected, preferred_format_selected.
  await appendFile(eventsPath, `${JSON.stringify(event)}\n`, "utf8");
  sendJson(response, 201, { ok: true });
}

async function handleCreatineReport(request, response) {
  const body = await readJsonBody(request);
  const profile = body.profile || {};
  const firstName = sanitizeString(profile.name, 80) || "there";
  const activities = Array.isArray(profile.activities) ? profile.activities : [];
  const goals = Array.isArray(profile.goals) ? profile.goals : [];
  const concerns = Array.isArray(profile.concerns) ? profile.concerns : [];
  const format = sanitizeString(profile.format, 80) || "the format you can repeat";
  const frequency = Number(profile.freq || 0);
  const activeRoutine = frequency >= 4 ? "active" : frequency >= 2 ? "steady" : "early";

  sendJson(response, 200, {
    ok: true,
    diagnosis: {
      profileType: chooseProfileType(profile),
      topLanes: ["Move", "Recover", "Focus"],
    },
    report: {
      generatedBy: "local",
      profileTitle: chooseProfileType(profile),
      headline: `${firstName}, creatine looks most relevant when it supports a routine you can actually repeat.`,
      summary: `Your answers point to a ${activeRoutine} active rhythm: ${listText(activities) || "active living"}, with goals around ${listText(goals) || "consistency"}. The useful angle is not hype or instant change. It is making creatine easier to understand, easier to take, and easier to keep in a normal week.`,
      scores: {
        Move: Math.min(96, 62 + frequency * 5 + activities.length * 3),
        Focus: Math.min(88, 52 + (hasText(activities, "desk") || hasText(goals, "focus") ? 18 : 6)),
        Recover: Math.min(90, 54 + frequency * 4 + (hasText(goals, "recovery") ? 14 : 4)),
      },
      insights: buildReportInsights({ activities, goals, concerns, format, frequency }),
      routine: [
        `Start with one simple cue: pair ${format.toLowerCase()} with breakfast, training prep, or your first bottle of water.`,
        "Keep the promise realistic: consistency first, optimization later.",
        "If you have kidney, heart, pregnancy, medication, or medical concerns, ask a qualified clinician before using any supplement.",
      ],
      footnotes: [
        {
          id: 1,
          title: "Creatine safety and efficacy review",
          citation: "Kreider et al., Journal of the International Society of Sports Nutrition",
          url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-017-0173-z",
        },
        {
          id: 2,
          title: "Common questions and misconceptions about creatine",
          citation: "Antonio et al., Journal of the International Society of Sports Nutrition",
          url: "https://jissn.biomedcentral.com/articles/10.1186/s12970-021-00412-w",
        },
      ],
    },
  });
}

async function serveStatic(pathname, response) {
  if (pathname === "/creatine-fit-quiz" || pathname === "/creatine-fit-quiz/") {
    await serveFile(quizHtmlPath, response);
    return;
  }

  const routePath = pathname === "/" ? "/index.html" : pathname;
  const requestedPath = normalize(decodeURIComponent(routePath)).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(publicDir, `.${requestedPath}`);

  if (!filePath.startsWith(publicDir)) {
    sendText(response, 403, "Forbidden");
    return;
  }

  await serveFile(filePath, response);
}

async function serveFile(filePath, response) {
  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not a file");

    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
}

async function readJsonBody(request) {
  let raw = "";
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 100_000) throw new Error("Request body too large");
  }

  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeLead(body) {
  const profile = body.profile && typeof body.profile === "object" ? body.profile : null;
  if (profile) {
    return {
      firstName: sanitizeString(profile.name, 80),
      email: sanitizeString(profile.email, 160).toLowerCase(),
      whatsapp: sanitizeString(profile.whatsapp, 40),
      activityType: Array.isArray(profile.activities) ? profile.activities.map((value) => sanitizeString(value, 80)).filter(Boolean).join("; ") : "",
      creatineAwareness: sanitizeString(profile.experience, 80),
      preferredFormat: sanitizeString(profile.format, 80) || "No format preference yet",
      mvpInterest: sanitizeString(profile.productInterest, 120),
      sampleInterest: sanitizeString(profile.sampleInterest, 80),
      priceRange: profile.monthlyBudget ? `Rp${Number(profile.monthlyBudget).toLocaleString("id-ID")} monthly budget` : "",
      concerns: Array.isArray(profile.concerns) ? profile.concerns.map((value) => sanitizeString(value, 80)).filter(Boolean) : [],
      notes: sanitizeString(profile.notes, 500),
      consent: Boolean(profile.consent ?? body.consent),
      language: sanitizeString(profile.language || body.language, 4) || "en",
      source: sanitizeString(body.source, 80) || "creatine_fit_quiz",
    };
  }

  return {
    firstName: sanitizeString(body.firstName, 80),
    email: sanitizeString(body.email, 160).toLowerCase(),
    whatsapp: sanitizeString(body.whatsapp, 40),
    activityType: sanitizeString(body.activityType, 80),
    creatineAwareness: sanitizeString(body.creatineAwareness, 80),
    preferredFormat: sanitizeString(body.preferredFormat, 80),
    mvpInterest: sanitizeString(body.mvpInterest, 120),
    sampleInterest: sanitizeString(body.sampleInterest, 80),
    priceRange: sanitizeString(body.priceRange, 80),
    concerns: Array.isArray(body.concerns) ? body.concerns.map((value) => sanitizeString(value, 80)).filter(Boolean) : [],
    notes: sanitizeString(body.notes, 500),
    consent: Boolean(body.consent),
    language: sanitizeString(body.language, 4) || "en",
    source: sanitizeString(body.source, 80),
  };
}

function validateLead(lead) {
  const errors = {};
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phonePattern = /^[+\d][\d\s()-]{6,}$/;

  if (!lead.email) errors.email = "Please enter your email.";
  if (lead.email && !emailPattern.test(lead.email)) errors.email = "Please enter a valid email.";
  if (!lead.activityType) errors.activityType = "Please choose what best describes you.";
  if (!lead.preferredFormat) errors.preferredFormat = "Please choose a preferred format.";
  if (lead.whatsapp && !phonePattern.test(lead.whatsapp)) errors.whatsapp = "Please enter a valid WhatsApp number.";
  if (!lead.consent) errors.consent = "Please tick the consent box.";

  return errors;
}

function sanitizeString(value, maxLength) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, maxLength);
}

function getUtmFields(body) {
  return {
    source: sanitizeString(body.utmSource, 120),
    medium: sanitizeString(body.utmMedium, 120),
    campaign: sanitizeString(body.utmCampaign, 120),
    content: sanitizeString(body.utmContent, 120),
    term: sanitizeString(body.utmTerm, 120),
  };
}

function chooseProfileType(profile) {
  const activities = Array.isArray(profile.activities) ? profile.activities : [];
  const goals = Array.isArray(profile.goals) ? profile.goals : [];
  const concerns = Array.isArray(profile.concerns) ? profile.concerns : [];

  if (hasText(activities, "desk") || hasText(goals, "focus")) return "Active Professional";
  if (hasText(activities, "running")) return "Everyday Endurance Mover";
  if (hasText(activities, "gym") || hasText(goals, "strength")) return "Strength Routine Builder";
  if (hasText(concerns, "safe") || hasText(concerns, "kidney")) return "Research-First Buyer";
  return "Daily Rhythm Builder";
}

function buildReportInsights({ activities, goals, concerns, format, frequency }) {
  const insights = [
    {
      icon: "Move",
      title: "Your strongest fit is consistency",
      text: `For ${listText(activities) || "active living"}, the product has to be easy enough to repeat. That makes ${format.toLowerCase()} a useful signal for product development.^1`,
      citations: [1],
    },
    {
      icon: "Dose",
      title: "Clear serving matters",
      text: "The product should make dose and serving logic visible, especially if the format is gummy or stick pack. Clear dosage helps avoid the feeling that it is just candy or flavored water.^2",
      citations: [2],
    },
    {
      icon: "Habit",
      title: "Routine beats hype",
      text: `${frequency ? `${frequency} training or movement days per week` : "Your weekly routine"} suggests the first product should focus on repeat behavior, not aggressive performance language.`,
      citations: [1],
    },
  ];

  if (concerns.length) {
    insights.push({
      icon: "Trust",
      title: "Your concerns are product requirements",
      text: `${listText(concerns)} should be answered through taste testing, claim discipline, transparent serving, and BPOM/Halal pathway clarity, not through louder marketing.`,
      citations: [2],
    });
  }

  if (hasText(goals, "focus") || hasText(activities, "desk")) {
    insights.push({
      icon: "Focus",
      title: "The future stack should stay careful",
      text: "The focus angle is interesting for workday rhythm, but it should be communicated as routine support, not a productivity transformation claim.",
      citations: [2],
    });
  }

  return insights;
}

function hasText(items = [], keyword) {
  return items.join(" ").toLowerCase().includes(String(keyword).toLowerCase());
}

function listText(items = []) {
  return items.filter(Boolean).slice(0, 3).join(", ");
}

async function readNdjson(path) {
  try {
    const content = await readFile(path, "utf8");
    return content
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .reverse();
  } catch {
    return [];
  }
}

async function forwardLeadToWebhook(lead) {
  await fetch(process.env.CRM_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(lead),
  });
}

function isAuthorized(request, url) {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return true;
  const suppliedToken = request.headers.authorization?.replace(/^Bearer\s+/i, "") || url.searchParams.get("token");
  return suppliedToken === token;
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(payload));
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, { "content-type": "text/plain; charset=utf-8" });
  response.end(text);
}
