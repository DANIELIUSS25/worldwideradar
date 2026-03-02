// netlify/functions/gdelt.js
// SECURITY: Proxy to avoid exposing GDELT API structure to client, adds caching

const fetch = require("node-fetch");

const CACHE_TTL     = 10 * 60 * 1000;
const FETCH_TIMEOUT = 10000;
const ALLOWED_ORIGINS = ["https://worldwideradar.com", "https://worldwideradar.netlify.app"];

let cache = { data: null, ts: 0 };

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

exports.handler = async (event) => {
  const headers = safeHeaders(event);
  if (!headers) return { statusCode: 403, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

    const res = await fetch(
      "https://api.gdeltproject.org/api/v2/doc/doc?query=war+attack+airstrike+military+conflict+bombing&mode=artlist&format=json&maxrecords=40&timespan=6h",
      { signal: controller.signal }
    );
    clearTimeout(timer);

    if (!res.ok) throw new Error(`GDELT ${res.status}`);
    const data = await res.json();

    // SECURITY: Whitelist only safe fields from GDELT response
    const articles = (data.articles || [])
      .filter(a => a.language === "English")
      .map(a => ({
        title:    (a.title || "").slice(0, 200),
        url:      (a.url || "").startsWith("http") ? a.url : "",
        domain:   (a.domain || "").slice(0, 80),
        seendate: (a.seendate || "").slice(0, 20),
      }));

    const result = { articles, count: articles.length, updated: new Date().toISOString() };
    cache = { data: result, ts: Date.now() };
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    // SECURITY: Never expose error details to client
    console.error("[gdelt] fetch error:", err.name);
    return { statusCode: 200, headers, body: JSON.stringify({ articles: [], count: 0 }) };
  }
};
