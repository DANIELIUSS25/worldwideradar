// netlify/functions/threat-score.js
// SECURITY: Claude API key stays server-side only
// SECURITY: Input sanitized before prompt construction to block injection

const fetch = require("node-fetch");

const CACHE_TTL      = 20 * 60 * 1000;
const MAX_BODY_BYTES = 32 * 1024; // 32KB max request body
const FETCH_TIMEOUT  = 20000;
const ALLOWED_ORIGINS = ["https://worldwideradar.com", "https://worldwideradar.netlify.app"];

// Zone ID allowlist — only accept known conflict zone IDs
const VALID_ZONE_IDS = new Set([1,2,3,4,5,6,7,8,9,10,11,12]);

const scoreCache = new Map();

function safeHeaders(event) {
  const origin = (event.headers?.origin || event.headers?.referer || "").toLowerCase();
  const isLocal  = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.includes(o.replace("https://","")));
  if (!isLocal && !isAllowed && origin !== "") return null;
  const corsOrigin = isAllowed ? ALLOWED_ORIGINS.find(o => origin.includes(o.replace("https://",""))) : "*";
  return {
    "Access-Control-Allow-Origin": corsOrigin || "*",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
}

// SECURITY: Strip any characters that could be used for prompt injection
function sanitizeStr(s, maxLen = 200) {
  if (typeof s !== "string") return "";
  return s
    .replace(/[<>{}\\`]/g, "")          // Remove template/html chars
    .replace(/\n{3,}/g, "\n\n")         // Collapse excessive newlines
    .replace(/system:|assistant:|human:|user:/gi, "")  // Block role injection
    .trim()
    .slice(0, maxLen);
}

function sanitizeZone(zone) {
  if (!zone || typeof zone !== "object") return null;
  const id = parseInt(zone.id);
  if (!VALID_ZONE_IDS.has(id)) return null; // Reject unknown zones
  return {
    id,
    name:    sanitizeStr(zone.name, 60),
    region:  sanitizeStr(zone.region, 60),
    type:    sanitizeStr(zone.type, 60),
    sev:     ["CRITICAL","HIGH","MEDIUM","LOW"].includes(zone.sev) ? zone.sev : "MEDIUM",
    kw:      sanitizeStr(zone.kw, 100),
  };
}

function sanitizeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.slice(0, 25).map(e => ({
    date:       sanitizeStr(e.date, 12),
    type:       sanitizeStr(e.type, 50),
    location:   sanitizeStr(e.location, 60),
    country:    sanitizeStr(e.country, 50),
    fatalities: Math.max(0, parseInt(e.fatalities) || 0),
    notes:      sanitizeStr(e.notes, 150),
  }));
}

function sanitizeArticles(articles) {
  if (!Array.isArray(articles)) return [];
  return articles.slice(0, 12).map(a => ({
    title:  sanitizeStr(a.title, 120),
    domain: sanitizeStr(a.domain, 50),
  }));
}

function sanitizeSignals(signals) {
  if (!Array.isArray(signals)) return [];
  return signals.slice(0, 8).map(s => ({
    title: sanitizeStr(s.title, 120),
    src:   { name: sanitizeStr(s?.src?.name || "", 30) },
  }));
}

exports.handler = async (event) => {
  const headers = safeHeaders(event);
  if (!headers) return { statusCode: 403, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "POST")    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  // SECURITY: Reject oversized payloads
  const bodyLen = Buffer.byteLength(event.body || "", "utf8");
  if (bodyLen > MAX_BODY_BYTES) {
    return { statusCode: 413, headers, body: JSON.stringify({ error: "Payload too large" }) };
  }

  let raw;
  try { raw = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid request" }) }; }

  // SECURITY: Sanitize ALL inputs before touching Claude
  const zone    = sanitizeZone(raw.zone);
  if (!zone) return { statusCode: 400, headers, body: JSON.stringify({ error: "Invalid zone" }) };

  const cached = scoreCache.get(zone.id);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cached.score) };
  }

  const events   = sanitizeEvents(raw.acledEvents);
  const articles = sanitizeArticles(raw.gdeltArticles);
  const signals  = sanitizeSignals(raw.signals);
  const wiki     = sanitizeStr(raw.wikiSummary || "", 500);

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const demo = buildDemoScore(zone);
    return { statusCode: 200, headers, body: JSON.stringify(demo) };
  }

  // Build prompt from sanitized data only
  const recentEvents = events.map(e => `[${e.date}] ${e.type} in ${e.location} (${e.country}) — ${e.fatalities} fatalities. ${e.notes}`).join("\n");
  const headlines    = articles.map(a => `• ${a.title} (${a.domain})`).join("\n");
  const feedSignals  = signals.map(s => `• [${s.src.name}] ${s.title}`).join("\n");

  const prompt = `You are a conflict intelligence analyst for WorldwideRadar. Analyze this data and return ONLY a JSON object.

CONFLICT ZONE: ${zone.name} | Region: ${zone.region} | Type: ${zone.type} | Severity: ${zone.sev}

RECENT EVENTS:
${recentEvents || "None available."}

RECENT HEADLINES:
${headlines || "None available."}

SIGNAL FEEDS:
${feedSignals || "None available."}

BACKGROUND:
${wiki || "Not available."}

Return ONLY valid JSON with this exact structure (no markdown, no preamble):
{"score":<0-100>,"trend":"ESCALATING|STABLE|DE-ESCALATING|VOLATILE","riskLevel":"CRITICAL|HIGH|MEDIUM|LOW","oneLiner":"<max 12 words>","keyIndicators":["<indicator>","<indicator>","<indicator>"],"primaryActors":["<actor>","<actor>"],"escalationDrivers":["<driver max 60 chars>","<driver max 60 chars>"],"deescalationFactors":["<factor max 60 chars>"],"civilianRisk":"EXTREME|HIGH|MODERATE|LOW","regionalSpillover":"HIGH|MEDIUM|LOW","analystNote":"<2 sentences, analyst tone>"}`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const text = data.content?.[0]?.text || "{}";

    let parsed;
    try {
      parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      parsed = buildDemoScore(zone);
    }

    // SECURITY: Whitelist output fields — never pass raw Claude output to client
    const result = {
      score:               Math.min(100, Math.max(0, parseInt(parsed.score) || 50)),
      trend:               ["ESCALATING","STABLE","DE-ESCALATING","VOLATILE"].includes(parsed.trend) ? parsed.trend : "STABLE",
      riskLevel:           ["CRITICAL","HIGH","MEDIUM","LOW"].includes(parsed.riskLevel) ? parsed.riskLevel : zone.sev,
      oneLiner:            sanitizeStr(parsed.oneLiner, 100),
      keyIndicators:       Array.isArray(parsed.keyIndicators) ? parsed.keyIndicators.slice(0,3).map(s=>sanitizeStr(s,120)) : [],
      primaryActors:       Array.isArray(parsed.primaryActors) ? parsed.primaryActors.slice(0,3).map(s=>sanitizeStr(s,60)) : [],
      escalationDrivers:   Array.isArray(parsed.escalationDrivers) ? parsed.escalationDrivers.slice(0,3).map(s=>sanitizeStr(s,80)) : [],
      deescalationFactors: Array.isArray(parsed.deescalationFactors) ? parsed.deescalationFactors.slice(0,2).map(s=>sanitizeStr(s,80)) : [],
      civilianRisk:        ["EXTREME","HIGH","MODERATE","LOW"].includes(parsed.civilianRisk) ? parsed.civilianRisk : "HIGH",
      regionalSpillover:   ["HIGH","MEDIUM","LOW"].includes(parsed.regionalSpillover) ? parsed.regionalSpillover : "MEDIUM",
      analystNote:         sanitizeStr(parsed.analystNote, 400),
      generatedAt:         new Date().toISOString(),
      source:              "claude",
      zone:                zone.name,
    };

    scoreCache.set(zone.id, { score: result, ts: Date.now() });
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    // SECURITY: Only log error name server-side, never expose to client
    console.error("[threat-score] error:", err.name);
    const demo = buildDemoScore(zone);
    return { statusCode: 200, headers, body: JSON.stringify(demo) };
  }
};

function buildDemoScore(zone) {
  const base = { CRITICAL:82, HIGH:64, MEDIUM:41, LOW:18 }[zone.sev] || 50;
  return {
    score:               Math.min(100, Math.max(0, base + Math.floor(Math.random()*8)-4)),
    trend:               zone.sev==="CRITICAL"?"ESCALATING":zone.sev==="HIGH"?"VOLATILE":"STABLE",
    riskLevel:           zone.sev,
    oneLiner:            `Active ${zone.type.toLowerCase()} with ${zone.sev.toLowerCase()} escalation risk.`,
    keyIndicators:       ["Continued military operations reported","Civilian displacement ongoing","Regional actors increasing involvement"],
    primaryActors:       ["State Military Forces","Non-State Armed Groups"],
    escalationDrivers:   ["External arms supply","Humanitarian crisis deepening"],
    deescalationFactors: ["Ceasefire negotiations ongoing"],
    civilianRisk:        zone.sev==="CRITICAL"?"EXTREME":zone.sev==="HIGH"?"HIGH":"MODERATE",
    regionalSpillover:   zone.sev==="CRITICAL"?"HIGH":"MEDIUM",
    analystNote:         `The situation in ${zone.name} remains ${zone.sev.toLowerCase()} with no clear resolution pathway. International pressure has failed to produce durable ceasefire conditions.`,
    generatedAt:         new Date().toISOString(),
    source:              "demo",
    zone:                zone.name,
  };
}
