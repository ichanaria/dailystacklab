import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = __dirname;
const publicDir = path.join(root, 'public');
const quizHtmlPath = path.join(publicDir, 'creatine-fit-quiz.html');
const port = Number(process.env.PORT || 5177);
const host = process.env.HOST || '0.0.0.0';
const dataDir = path.join(root, 'data');
const leadsPath = path.join(dataDir, 'leads.ndjson');
const eventsPath = path.join(dataDir, 'events.ndjson');
const matrix = JSON.parse(await fs.readFile(path.join(root, 'data/creatine-personalization-engine.json'), 'utf8'));
const citationMap = JSON.parse(await fs.readFile(path.join(root, 'data/research-citation-map.json'), 'utf8'));

await fs.mkdir(dataDir, { recursive: true });

function jsonResponse(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type'
  });
  res.end(JSON.stringify(body));
}

function textResponse(res, status, contentType, body) {
  res.writeHead(status, { 'content-type': contentType });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) req.destroy();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function addWeights(scores, weights = {}) {
  for (const [key, value] of Object.entries(weights)) {
    if (key === 'researchAngles') continue;
    scores[key] = (scores[key] || 0) + Number(value || 0);
  }
}

function collectAngles(set, weights = {}) {
  for (const angle of weights.researchAngles || []) set.add(angle);
}

function optionLabel(value) {
  return String(value || '')
    .replace(/[^\p{L}\p{N}\s/&?-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function frequencyBucket(freq) {
  const n = Number(freq || 0);
  if (n <= 1) return '0-1';
  if (n <= 3) return '2-3';
  if (n <= 5) return '4-5';
  return '6-7';
}

function normalizeScores(scores) {
  const out = {};
  for (const [key, value] of Object.entries(scores)) {
    out[key] = Math.max(0, Math.min(100, Math.round((Number(value || 0) / 12) * 100)));
  }
  return out;
}

function diagnose(profile) {
  const scores = Object.fromEntries(Object.keys(matrix.dimensions).map((key) => [key, 0]));
  const angles = new Set();
  const reasons = [];

  for (const activity of profile.activities || []) {
    const label = optionLabel(activity);
    const weights = matrix.activityWeights[label];
    if (!weights) continue;
    addWeights(scores, weights);
    collectAngles(angles, weights);
    reasons.push(`Activity: ${label}`);
  }

  addWeights(scores, matrix.frequencyWeights[frequencyBucket(profile.freq)] || {});
  reasons.push(`Training frequency: ${profile.freq || 0}x/week`);

  for (const goal of profile.goals || []) {
    const weights = matrix.goalWeights[goal];
    if (!weights) continue;
    addWeights(scores, weights);
    collectAngles(angles, weights);
    reasons.push(`Goal: ${goal}`);
  }

  for (const concern of profile.concerns || []) {
    const weights = matrix.concernWeights[concern];
    if (!weights) continue;
    addWeights(scores, weights);
    collectAngles(angles, weights);
    reasons.push(`Concern: ${concern}`);
  }

  addWeights(scores, matrix.experienceWeights[profile.experience] || {});
  addWeights(scores, matrix.formatWeights[profile.format] || {});

  if (profile.gender === 'Female') {
    scores.womenContext += 3;
    angles.add('women');
  }

  const age = Number(profile.age || 0);
  if (age >= 35) {
    scores.recoveryPressure += 1;
    scores.strengthDemand += 1;
    angles.add('aging');
  }

  angles.add('safety');

  const sortedDimensions = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .map(([key, value]) => ({ key, value }));

  const profileType = chooseProfileType(scores);
  const researchAngles = [...angles].sort((a, b) => anglePriority(b, scores) - anglePriority(a, scores)).slice(0, 6);
  const selectedCitations = researchAngles.flatMap((angle) =>
    selectCitationsForAngle(angle, profile, scores).map((citation) => ({
      angle,
      angleLabel: citationMap.angles[angle].label,
      ...citation
    }))
  );

  return {
    profileType,
    rawScores: scores,
    scores: normalizeScores(scores),
    topDimensions: sortedDimensions.slice(0, 5),
    researchAngles,
    selectedCitations,
    reasons,
    guardrails: matrix.claimGuardrails
  };
}

function selectCitationsForAngle(angle, profile, scores) {
  const citations = citationMap.angles[angle]?.citations || [];
  if (!citations.length) return [];
  const text = [
    ...(profile.activities || []),
    ...(profile.goals || []),
    ...(profile.concerns || []),
    profile.experience || '',
    profile.format || ''
  ].join(' ').toLowerCase();

  let ranked = citations.map((citation, index) => {
    const haystack = `${citation.title} ${citation.citation} ${citation.plainLanguageUse}`.toLowerCase();
    let score = citations.length - index;
    if (angle === 'endurance' && /running|interval|sprint|padel|tennis|hyrox|football|futsal/.test(text) && /sprint|surge|interval|running|supramaximal/.test(haystack)) score += 6;
    if (angle === 'stopStart' && /padel|tennis|hyrox|hiit|crossfit|football|futsal|sprint|interval/.test(text) && /repeated sprint|hiit|impact|padel|tennis|stroke/.test(haystack)) score += 8;
    if (angle === 'strength' && /gym|weights|strength|lean/.test(text) && /resistance|strength|body composition|weightlifting/.test(haystack)) score += 6;
    if (angle === 'cognitive' && /desk|focus|mental|brain/.test(text) && /cognitive|memory|performance/.test(haystack)) score += 6;
    if (angle === 'recovery' && /recovery|sleep|fatigue/.test(text) && /sleep|deprivation|psychomotor|resistance training/.test(haystack)) score += 6;
    if (angle === 'safety' && /kidney|heart|hair|dose|bloated|bulky/.test(text) && /misconception|safety|kidney|amino acids/.test(haystack)) score += 6;
    if (angle === 'women' && profile.gender === 'Female' && /women|female/.test(haystack)) score += 6;
    if (angle === 'aging' && Number(profile.age || 0) >= 35 && /aging|older|bone|lean tissue/.test(haystack)) score += 4;
    return { citation, score };
  });

  ranked = ranked.sort((a, b) => b.score - a.score);
  const limit = angle === 'safety' ? 2 : 2;
  return ranked.slice(0, limit).map((item) => item.citation);
}

function orderCitationsForProfile(citations, profile) {
  const desired = [];
  const activityText = (profile.activities || []).join(' ').toLowerCase();
  const goalText = (profile.goals || []).join(' ').toLowerCase();
  const concernText = (profile.concerns || []).join(' ').toLowerCase();
  if (/padel|tennis|hyrox|hiit|crossfit|football|futsal/.test(activityText)) desired.push('stopStart');
  if (/running|padel|tennis|cycling|swimming|hiit|hyrox|crossfit|football|futsal/.test(activityText) || /endurance|performance|fatigue/.test(goalText)) desired.push('endurance');
  if (profile.gender === 'Female') desired.push('women');
  if (/kidney|heart|hair|dose|bloated|bulky|safe|women/.test(concernText)) desired.push('safety');
  if (/gym|weights/.test(activityText) || /strength|lean/.test(goalText)) desired.push('strength');
  if (/desk/.test(activityText) || /focus|mental|energy/.test(goalText)) desired.push('cognitive');
  if (Number(profile.freq || 0) >= 4 || /recovery|recover/.test(goalText)) desired.push('recovery');
  if (Number(profile.age || 0) >= 35 || /aging|longevity/.test(goalText)) desired.push('aging');
  desired.push('safety');

  const angleRank = new Map(desired.map((angle, index) => [angle, index]));
  return [...citations].sort((a, b) => {
    const aRank = angleRank.has(a.angle) ? angleRank.get(a.angle) : 99;
    const bRank = angleRank.has(b.angle) ? angleRank.get(b.angle) : 99;
    return aRank - bRank;
  });
}

function anglePriority(angle, scores) {
  const map = {
    strength: scores.strengthDemand,
    endurance: scores.repeatEffort + scores.moveDemand,
    stopStart: scores.stopStartDemand + scores.repeatEffort,
    cognitive: scores.cognitiveLoad,
    recovery: scores.recoveryPressure,
    women: scores.womenContext,
    aging: scores.strengthDemand + scores.recoveryPressure,
    safety: scores.trustBarrier + scores.educationNeed
  };
  return map[angle] || 0;
}

function chooseProfileType(scores) {
  if (scores.stopStartDemand >= 5 && scores.repeatEffort >= 5) return 'Stop-Start Athlete';
  if (scores.repeatEffort >= 5 && scores.cognitiveLoad >= 4) return 'Workday Athlete';
  if (scores.strengthDemand >= 5 && scores.repeatEffort >= 4) return 'The Hybrid Trainer';
  if (scores.moveDemand + scores.repeatEffort >= 10) return 'Active Everyday Mover';
  if (scores.strengthDemand >= 5 && scores.recoveryPressure >= 4) return 'The Strength Builder';
  if (scores.habitFriction >= 5) return 'Consistency Seeker';
  if (scores.trustBarrier >= 7 && scores.educationNeed >= 4) return 'Smart Beginner';
  return 'Daily Rhythm Builder';
}

function pickVisibleCitations(citations, profile) {
  const ordered = orderCitationsForProfile(citations, profile);
  const selected = [];
  const seenTitles = new Set();
  const angleCounts = {};

  for (const citation of ordered) {
    if (seenTitles.has(citation.title) || angleCounts[citation.angle]) continue;
    selected.push(citation);
    seenTitles.add(citation.title);
    angleCounts[citation.angle] = 1;
    if (selected.length >= 5) break;
  }

  for (const citation of ordered) {
    if (selected.length >= 7) break;
    if (seenTitles.has(citation.title)) continue;
    const count = angleCounts[citation.angle] || 0;
    if (count >= 2) continue;
    selected.push(citation);
    seenTitles.add(citation.title);
    angleCounts[citation.angle] = count + 1;
  }

  return selected;
}

function fallbackReport(profile, diagnosis) {
  const refs = pickVisibleCitations(diagnosis.selectedCitations, profile).map((citation, index) => ({ id: index + 1, ...citation }));
  const refByAngle = {};
  for (const ref of refs) {
    if (!refByAngle[ref.angle]) refByAngle[ref.angle] = ref.id;
  }
  const first = profile.name || 'there';
  const profileRead = buildProfileRead(profile, diagnosis);
  return {
    generatedBy: 'fallback',
    profileTitle: diagnosis.profileType,
    headline: buildHeadline(profile, first),
    summary: profileRead,
    scores: {
      Move: Math.round(Math.min(96, 46 + diagnosis.rawScores.moveDemand * 5 + diagnosis.rawScores.repeatEffort * 4 + diagnosis.rawScores.stopStartDemand * 3 + Number(profile.freq || 0))),
      Focus: Math.round(Math.min(94, 42 + diagnosis.rawScores.cognitiveLoad * 7 + (has(profile.activities, 'Desk') ? 8 : 0))),
      Recover: Math.round(Math.min(92, 44 + diagnosis.rawScores.recoveryPressure * 7 + (Number(profile.freq || 0) >= 4 ? 6 : 0)))
    },
    insights: buildFallbackInsights(profile, refByAngle),
    routine: [
      `Keep it boring: ${Number(profile.weight || 0) >= 80 ? '3-5g daily is a practical range to discuss' : '3g daily is a simple place to start'}. No loading plan is needed for this kind of everyday routine.`,
      `Attach it to something that already happens: ${has(profile.activities, 'Desk') ? 'breakfast, lunch, or the first drink you usually take at work' : 'breakfast, your post-training meal, or the same daily drink'}.`,
      `${profile.format || 'Your preferred format'} matters because the best routine is the one you can repeat on a normal, busy day.`
    ],
    footnotes: refs
  };
}

function buildProfileRead(profile, diagnosis) {
  const first = profile.name || 'there';
  const training = trainingContext(profile);
  const activity = readableActivity(profile);
  const concern = profile.concerns?.length ? ' The report also keeps the myth-check practical, so confidence comes before hype.' : '';
  return `Hi ${first}, your week mixes ${activity} with ${training}. Creatine is not the whole plan; it is a small daily support for the harder parts: moving well, staying sharp, and coming back ready enough for the next session.${concern}`;
}

function buildHeadline(profile, first) {
  const activities = (profile.activities || []).join(' ').toLowerCase();
  if (/padel|tennis/.test(activities)) return `Hi ${first}, your creatine story is more rally-to-rally than bodybuilder.`;
  if (/hyrox|hiit|crossfit/.test(activities)) return `Hi ${first}, your creatine story is about going again after the hard part starts.`;
  if (/running/.test(activities)) return `Hi ${first}, creatine fits the hard parts of your running week, not the easy miles.`;
  if (/desk/.test(activities)) return `Hi ${first}, your report connects movement support with the workday load around it.`;
  return `Hi ${first}, creatine fits your routine more like daily support than a bodybuilding shortcut.`;
}

function trainingContext(profile) {
  const freq = Number(profile.freq || 0);
  if (freq <= 1) return `${freq} session a week, where consistency matters more than optimization`;
  if (freq <= 3) return `${freq} sessions a week, enough for a daily habit to support the work you already do`;
  if (freq <= 5) return `${freq} sessions a week, where tired legs and tomorrow's readiness start to matter`;
  return `${freq} sessions a week, where recovery and repeatability become the main story`;
}

function buildFallbackInsights(profile, refByAngle) {
  const items = [];
  const activities = (profile.activities || []).join(' ').toLowerCase();
  const goals = (profile.goals || []).join(' ').toLowerCase();
  if (activities.includes('hyrox') || activities.includes('hiit') || activities.includes('crossfit')) {
    items.push({ icon: 'Repeat', title: 'For hybrid conditioning', text: `This kind of training is simple to describe and hard to do: run, push, pull, lift, breathe, then repeat. Creatine fits the part where short hard outputs keep stacking up, not as hype, but as support for the next effort.${cite(refByAngle.stopStart || refByAngle.endurance)} ${cite(refByAngle.strength)}`.trim() });
  }
  if (activities.includes('running')) {
    items.push({ icon: 'Run', title: 'For your runs', text: `For steady easy runs, creatine is not the star. The better fit is the part most runners recognize: intervals, short climbs, faster finishes, or another run when your legs are not fully fresh.${cite(refByAngle.endurance)}` });
  }
  if (activities.includes('padel') || activities.includes('tennis')) {
    items.push({ icon: 'Court', title: 'For padel or tennis', text: `I would not promise a better smash or cleaner stroke. The practical angle is what happens between points: quick starts, brakes, turns, and staying useful when your legs and timing start to fade.${cite(refByAngle.stopStart || refByAngle.endurance)}` });
  }
  if (activities.includes('football') || activities.includes('futsal')) {
    items.push({ icon: 'Field', title: 'For futsal-style bursts', text: `Futsal is full of repeat efforts: press, sprint, stop, turn, and recover just enough to do it again. That makes repeated-sprint evidence a better match than long-distance endurance language.${cite(refByAngle.stopStart || refByAngle.endurance)}` });
  }
  if (activities.includes('gym') || activities.includes('weights') || goals.includes('strength')) {
    items.push({ icon: 'Lift', title: 'For the gym work', text: `In the gym, creatine is more straightforward. The best evidence sits around strength training. For you, the useful part is not "getting bulky"; it is supporting better training quality when sets get hard.${cite(refByAngle.strength)}` });
  }
  if (activities.includes('desk') || goals.includes('focus')) {
    items.push({ icon: 'Focus', title: 'For work energy', text: `A busy day can drain you before training even starts. Long screen time, meetings, decisions, and focus all count as load. The cognitive research is useful here as context for demanding days, not as a magic focus pill.${cite(refByAngle.cognitive)}` });
  }
  if (Number(profile.freq || 0) >= 4 || goals.includes('recovery')) {
    items.push({ icon: 'Reset', title: 'For tomorrow', text: `${profile.freq || 0} sessions a week changes the goal. It is not about one perfect workout. It is about being ready enough tomorrow that the habit does not fall apart.${cite(refByAngle.recovery)}` });
  }
  if (profile.gender === 'Female') {
    items.push({ icon: 'You', title: 'For active women', text: `Creatine should not be explained only through male gym culture. The better frame is active wellness: training quality, daily energy, strength confidence, and a routine that fits your actual life.${cite(refByAngle.women)}` });
  }
  for (const concern of profile.concerns || []) {
    const card = concernInsight(concern, refByAngle.safety);
    if (card) items.push(card);
  }
  items.push({
    icon: 'Habit',
    title: 'The routine that wins',
    text: `The practical move is boring on purpose: small dose, same cue, same day-to-day rhythm. Creatine works best as a routine you actually repeat, not a plan you only follow when life is perfect.`
  });
  return items.slice(0, 9);
}

function readableActivity(profile) {
  const activities = profile.activities || [];
  if (!activities.length) return 'daily movement';
  const cleaned = activities.map(cleanPhrase);
  if (cleaned.length === 1) return cleaned[0].toLowerCase();
  return `${cleaned.slice(0, 2).join(' and ').toLowerCase()}${cleaned.length > 2 ? ', plus a few other active demands' : ''}`;
}

function cleanPhrase(value) {
  return String(value || '')
    .replace('Desk job / Light activity', 'desk work')
    .replace('Gym / Weights', 'gym work')
    .replace(/[^\w\s/&-]/g, '')
    .trim();
}

function concernInsight(concern, safetyRef) {
  const ref = cite(safetyRef);
  const cards = {
    'Will I get bloated?': {
      icon: 'Water',
      title: 'About bloating',
      text: `Some people notice water-weight changes early. The practical way to explain it is not fat gain; it is water held with muscle creatine. Start simple, stay consistent, and watch how your own body responds.${ref}`
    },
    'Will I get bulky?': {
      icon: 'Shape',
      title: 'About getting bulky',
      text: `Creatine does not choose your body shape. Training style, food intake, and consistency do. If your routine is active living, running, work, or general fitness, it should be framed as support, not a bodybuilder switch.${ref}`
    },
    'Is it safe for women?': {
      icon: 'You',
      title: 'About women and creatine',
      text: `The answer should not be "men use it, so women can too." Women-specific creatine research exists, and your report should use that lens instead of borrowing a male-only gym script.${ref}`
    },
    'Kidney & heart safety?': {
      icon: 'Safe',
      title: 'About safety',
      text: `For healthy adults, safety reviews are useful and reassuring. If someone has kidney disease, heart concerns, pregnancy, or medication questions, the smart answer is to ask a qualified clinician before using any supplement.${ref}`
    },
    'Hair loss?': {
      icon: 'Hair',
      title: 'About hair loss',
      text: `Hair loss needs a measured answer. Current evidence does not make it an expected creatine effect, but the concern still deserves to be treated seriously. If hair loss is already something you monitor, keep the routine simple and track changes clearly.${ref}`
    },
    'Right dose for me?': {
      icon: 'Dose',
      title: 'About dose',
      text: `You do not need to optimize everything from day one. Most people are better served by a small daily routine than by loading, cycling, or changing timing every week.${ref}`
    },
    'Brain / cognitive benefits?': {
      icon: 'Mind',
      title: 'About focus claims',
      text: `The brain angle is interesting, but it should be explained carefully. Think demanding days and mental fatigue support, not a promise that one supplement will turn you into a different person.${ref}`
    },
    'Aging & longevity?': {
      icon: 'Long',
      title: 'About the long game',
      text: `The long-game story is practical: keep useful muscle, keep moving, and keep routines that help you stay active. That is a better framing than vague "longevity" hype.${ref}`
    }
  };
  return cards[concern] || null;
}

function has(items = [], keyword) {
  return items.join(' ').toLowerCase().includes(String(keyword).toLowerCase());
}

function cite(id) {
  return id ? `^${id}` : '';
}

function list(items = []) {
  return items.length ? items.join(', ') : 'not selected';
}

async function generateWithAI(profile, diagnosis) {
  const provider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'fallback')).toLowerCase();
  if (provider === 'fallback' || provider === 'off') {
    return fallbackReport(profile, diagnosis);
  }

  const aiProfile = { ...profile };
  delete aiProfile.email;
  delete aiProfile.whatsapp;
  delete aiProfile.notes;
  const allowedFootnotes = pickVisibleCitations(diagnosis.selectedCitations, profile).map((citation, index) => ({ id: index + 1, ...citation }));

  const userPayload = JSON.stringify({
    task: 'Generate every visible statement for a personalized creatine quiz result infographic.',
    tone: 'Trustworthy sport scientist with a practical coach voice. Casual, specific, useful, not clinical, not salesy, not AI-sounding.',
    outputContract: {
      profileTitle: 'short shareable archetype; use simple words',
      headline: 'one sentence addressed to the user by first name',
      summary: 'short paragraph, maximum 85 words; do not mention height, weight, or BMI',
      scores: { Move: '0-100 number', Focus: '0-100 number', Recover: '0-100 number' },
      insights: '5-8 items, each {icon,title,text,citations:[numbers]}',
      routine: '3 practical bullets',
      footnotes: 'use allowedFootnotes exactly'
    },
    userProfile: aiProfile,
    diagnosis,
    guardrails: matrix.claimGuardrails,
    allowedFootnotes,
    hardRules: [
      'Do not write generic category blocks.',
      'Do not say "because you selected", "you flagged", "here is the read", "changes the equation", "trust barrier", or "claims matched".',
      'Do not restate the user inputs as a list. Interpret the pattern.',
      'Do not mention height, weight, BMI, or body frame in the summary.',
      'Each insight must connect at least two user signals, for example activity + goal, concern + experience, or frequency + recovery.',
      'Use practical phrases a normal person understands. Avoid "surges", "bioenergetics", "phosphocreatine system", "changes the equation", and "male gym culture" unless absolutely necessary.',
      'For running, explain that creatine is more relevant to harder parts of the week such as intervals, climbs, faster finishes, and repeat sessions; do not sell it as long-distance fuel.',
      'For Hyrox, HIIT, CrossFit, padel, tennis, football, or futsal, explain repeated short efforts in plain language.',
      'For padel or tennis, do not claim better stroke skill, better smash, or instant match performance.',
      'Every benefit statement must cite one or more allowedFootnotes by number.',
      'Use numbered citations like ^1 or ¹ in insight text.',
      'Do not mention the brand PWR UP.',
      'Do not use the words cure, treat, prevent, guaranteed, testosterone, fat loss, BPOM registered, or Halal certified.',
      'For hair loss, say it is a concern/myth area; do not claim creatine causes or prevents hair loss.',
      'Return only valid JSON. No markdown.'
    ]
  });

  if (provider === 'gemini') {
    return generateWithGemini(userPayload, allowedFootnotes, profile, diagnosis);
  }

  if (provider !== 'openai' || !process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) {
    return fallbackReport(profile, diagnosis);
  }

  const prompt = { role: 'user', content: [{ type: 'input_text', text: userPayload }] };

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL,
      input: [
        { role: 'system', content: [{ type: 'input_text', text: 'You write safe, practical, evidence-grounded wellness quiz reports as structured JSON. You never invent citations or medical claims.' }] },
        prompt
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'creatine_quiz_report',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              profileTitle: { type: 'string' },
              headline: { type: 'string' },
              summary: { type: 'string' },
              scores: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  Move: { type: 'number' },
                  Focus: { type: 'number' },
                  Recover: { type: 'number' }
                },
                required: ['Move', 'Focus', 'Recover']
              },
              insights: {
                type: 'array',
                minItems: 4,
                maxItems: 8,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    icon: { type: 'string' },
                    title: { type: 'string' },
                    text: { type: 'string' },
                    citations: { type: 'array', items: { type: 'number' } }
                  },
                  required: ['icon', 'title', 'text', 'citations']
                }
              },
              routine: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string' } },
              footnotes: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    id: { type: 'number' },
                    title: { type: 'string' },
                    citation: { type: 'string' },
                    url: { type: 'string' }
                  },
                  required: ['id', 'title', 'citation', 'url']
                }
              }
            },
            required: ['profileTitle', 'headline', 'summary', 'scores', 'insights', 'routine', 'footnotes']
          }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { ...fallbackReport(profile, diagnosis), generatedBy: 'fallback_after_ai_error', aiError: error.slice(0, 500) };
  }

  const data = await response.json();
  const text = data.output_text || data.output?.flatMap((item) => item.content || []).find((part) => part.type === 'output_text')?.text;
  if (!text) return fallbackReport(profile, diagnosis);
  const report = JSON.parse(text);
  return normalizeAIReport(report, allowedFootnotes, 'openai');
}

async function generateWithGemini(userPayload, allowedFootnotes, profile, diagnosis) {
  if (!process.env.GEMINI_API_KEY) return fallbackReport(profile, diagnosis);

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: 'You write safe, practical, evidence-grounded wellness quiz reports as structured JSON. You never invent citations or medical claims.' }]
      },
      contents: [{ role: 'user', parts: [{ text: userPayload }] }],
      generationConfig: {
        temperature: 0.75,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const error = await response.text();
    return { ...fallbackReport(profile, diagnosis), generatedBy: 'fallback_after_gemini_error', aiError: error.slice(0, 500) };
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('\n').trim();
  if (!text) return fallbackReport(profile, diagnosis);

  try {
    return normalizeAIReport(JSON.parse(stripCodeFences(text)), allowedFootnotes, 'gemini');
  } catch (error) {
    return { ...fallbackReport(profile, diagnosis), generatedBy: 'fallback_after_gemini_parse_error', aiError: error.message };
  }
}

function normalizeAIReport(report, allowedFootnotes, provider) {
  const clean = { ...report };
  clean.generatedBy = provider;
  clean.footnotes = allowedFootnotes;
  clean.insights = Array.isArray(clean.insights) ? clean.insights.slice(0, 8) : [];
  clean.routine = Array.isArray(clean.routine) ? clean.routine.slice(0, 3) : [];
  return clean;
}

function stripCodeFences(text) {
  return String(text).replace(/^```(?:json)?/i, '').replace(/```$/i, '').trim();
}

async function handleGenerate(req, res) {
  try {
    const body = await parseBody(req);
    const profile = body.profile || body;
    const diagnosis = diagnose(profile);
    const report = await generateWithAI(profile, diagnosis);
    jsonResponse(res, 200, { report, diagnosis });
  } catch (error) {
    jsonResponse(res, 500, { error: error.message });
  }
}

async function handleLeadPost(req, res) {
  try {
    const body = await parseBody(req);
    const profile = body.profile || body;
    const lead = normalizeLead(profile, body);
    const errors = validateLead(lead);

    if (Object.keys(errors).length) {
      return jsonResponse(res, 400, { ok: false, errors });
    }

    lead.id = randomUUID();
    lead.createdAt = new Date().toISOString();
    await fs.appendFile(leadsPath, `${JSON.stringify(lead)}\n`, 'utf8');
    if (process.env.CRM_WEBHOOK_URL) {
      forwardLeadToWebhook(lead).catch((error) => {
        console.error('CRM webhook failed:', error.message);
      });
    }
    jsonResponse(res, 201, { ok: true, leadId: lead.id, message: 'You are on the early testing list.' });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: error.message });
  }
}

async function handleLeadGet(req, res) {
  const leads = await readNdjson(leadsPath);
  jsonResponse(res, 200, { ok: true, leads });
}

async function handleLeadCsv(req, res) {
  const leads = await readNdjson(leadsPath);
  const columns = [
    'createdAt',
    'captureStage',
    'sessionId',
    'name',
    'email',
    'whatsapp',
    'gender',
    'age',
    'activities',
    'goals',
    'concerns',
    'experience',
    'format',
    'productInterest',
    'sampleInterest',
    'monthlyBudget',
    'notes',
    'profileType'
  ];
  const lines = [
    columns.join(','),
    ...leads.map((lead) => columns.map((column) => csvCell(Array.isArray(lead[column]) ? lead[column].join('; ') : lead[column] || '')).join(','))
  ];

  res.writeHead(200, {
    'content-type': 'text/csv; charset=utf-8',
    'content-disposition': 'attachment; filename="creatine-fit-leads.csv"'
  });
  res.end(lines.join('\n'));
}

async function handleEventPost(req, res) {
  try {
    const body = await parseBody(req);
    const event = {
      id: randomUUID(),
      name: sanitizeString(body.name, 80),
      payload: body.payload && typeof body.payload === 'object' ? body.payload : {},
      createdAt: new Date().toISOString()
    };
    await fs.appendFile(eventsPath, `${JSON.stringify(event)}\n`, 'utf8');
    jsonResponse(res, 201, { ok: true });
  } catch (error) {
    jsonResponse(res, 500, { ok: false, error: error.message });
  }
}

function normalizeLead(profile, body) {
  const analysis = body.analysis && typeof body.analysis === 'object' ? body.analysis : {};
  return {
    captureStage: sanitizeString(body.captureStage, 40) || 'email_unlocked',
    sessionId: sanitizeString(profile.sessionId || body.sessionId, 100),
    name: sanitizeString(profile.name, 80),
    email: sanitizeString(profile.email, 160).toLowerCase(),
    whatsapp: sanitizeString(profile.whatsapp, 40),
    gender: sanitizeString(profile.gender, 20),
    age: sanitizeString(profile.age, 12),
    height: sanitizeString(profile.height, 12),
    weight: sanitizeString(profile.weight, 12),
    freq: Number(profile.freq || 0),
    activities: sanitizeArray(profile.activities),
    goals: sanitizeArray(profile.goals),
    concerns: sanitizeArray(profile.concerns),
    experience: sanitizeString(profile.experience, 80),
    format: sanitizeString(profile.format, 80),
    productInterest: sanitizeString(profile.productInterest, 120),
    sampleInterest: sanitizeString(profile.sampleInterest, 80),
    monthlyBudget: Number(profile.monthlyBudget || 0),
    notes: sanitizeString(profile.notes, 500),
    profileType: sanitizeString(analysis.profileType, 80),
    source: `${sanitizeString(body.source || 'creatine_fit_quiz', 80)}:${sanitizeString(body.captureStage, 40) || 'email_unlocked'}`
  };
}

function validateLead(lead) {
  const errors = {};
  const isPreviewCapture = lead.captureStage === 'preview_reached';
  if (!isPreviewCapture && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email = 'Please enter a valid email.';
  if (lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) errors.email = 'Please enter a valid email.';
  if (lead.whatsapp && !/^[+\d][\d\s()-]{6,}$/.test(lead.whatsapp)) errors.whatsapp = 'Please enter a valid WhatsApp number.';
  return errors;
}

function sanitizeArray(items) {
  return Array.isArray(items) ? items.map((item) => sanitizeString(item, 120)).filter(Boolean) : [];
}

function sanitizeString(value, maxLength) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, maxLength);
}

async function readNdjson(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return content.split('\n').filter(Boolean).map((line) => JSON.parse(line)).reverse();
  } catch {
    return [];
  }
}

function csvCell(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

async function forwardLeadToWebhook(lead) {
  await fetch(process.env.CRM_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(lead)
  });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  let file;
  if (pathname === '/') {
    file = path.join(publicDir, 'index.html');
  } else if (pathname === '/creatine-fit-quiz' || pathname === '/creatine-fit-quiz/') {
    file = quizHtmlPath;
  } else {
    file = path.normalize(path.join(publicDir, pathname));
  }
  if (!file.startsWith(publicDir)) return textResponse(res, 403, 'text/plain', 'Forbidden');
  try {
    const body = await fs.readFile(file);
    const ext = path.extname(file).toLowerCase();
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon'
    };
    textResponse(res, 200, types[ext] || 'application/octet-stream', body);
  } catch {
    textResponse(res, 404, 'text/plain', 'Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return jsonResponse(res, 200, {});
  if (req.method === 'POST' && req.url === '/api/generate-creatine-report') return handleGenerate(req, res);
  if (req.method === 'POST' && req.url === '/api/leads') return handleLeadPost(req, res);
  if (req.method === 'GET' && req.url === '/api/leads') return handleLeadGet(req, res);
  if (req.method === 'GET' && req.url === '/api/leads.csv') return handleLeadCsv(req, res);
  if (req.method === 'POST' && req.url === '/api/events') return handleEventPost(req, res);
  return serveStatic(req, res);
});

server.listen(port, host, () => {
  console.log(`Creatine quiz server running at http://${host}:${port}`);
  const provider = (process.env.AI_PROVIDER || (process.env.GEMINI_API_KEY ? 'gemini' : process.env.OPENAI_API_KEY ? 'openai' : 'fallback')).toLowerCase();
  if (provider === 'gemini' && process.env.GEMINI_API_KEY) {
    console.log(`AI generation enabled with Gemini (${process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite'}).`);
  } else if (provider === 'openai' && process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL) {
    console.log(`AI generation enabled with OpenAI (${process.env.OPENAI_MODEL}).`);
  } else {
    console.log('AI generation disabled. Set AI_PROVIDER=gemini with GEMINI_API_KEY, or AI_PROVIDER=openai with OPENAI_API_KEY and OPENAI_MODEL.');
  }
});
