// netlify/functions/rss.js
// Server-side RSS proxy — avoids rss2json rate limits (422 errors)
// Parses RSS XML directly, no third-party service needed

const fetch = require("node-fetch");

const CACHE_TTL     = 8 * 60 * 1000; // 8 min
const FETCH_TIMEOUT = 10000;
const ALLOWED_ORIGINS = ["https://worldwideradar.com", "https://worldwideradar.netlify.app"];

const FEEDS = [
  { url:"https://feeds.reuters.com/reuters/worldNews",                                                      name:"Reuters",   icon:"R",  color:"#ff8c00" },
  { url:"https://www.aljazeera.com/xml/rss/all.xml",                                                        name:"Al Jazeera",icon:"AJ", color:"#00a651" },
  { url:"http://feeds.bbci.co.uk/news/world/rss.xml",                                                       name:"BBC World", icon:"B",  color:"#bb1919" },
  { url:"https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml",                  name:"UN News",   icon:"UN", color:"#009edb" },
  { url:"https://rss.dw.com/rdf/rss-en-world",                                                              name:"DW News",   icon:"DW", color:"#00bcff" },
];

const KEYWORDS = ["war","attack","conflict","military","killed","strike","missile","bomb","troops",
  "ceasefire","offensive","invasion","airstrike","drone","battle","coup","artillery","shelling","insurgent"];

let cache = { data: null, ts: 0 };

function safeHeaders(event) {
  const origin = (event.headers?.origin || event.headers?.referer || "").toLowerCase();
  const isLocal   = origin.includes("localhost") || origin.includes("127.0.0.1");
  const isAllowed = ALLOWED_ORIGINS.some(o => origin.includes(o.replace("https://',"")));
  if (!isLocal && !isAllowed && origin !== "") return null;
  const corsOrigin = isAllowed ? ALLOWED_ORIGINS.find(o => origin.includes(o.replace("https://",""))) : "*";
  return {
    "Access-Control-Allow-Origin": corsOrigin || "*",
    "Content-Type": "application/json",
    "X-Content-Type-Options": "nosniff",
  };
}

async function timedFetch(url) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "WorldwideRadar/1.0 RSS Reader" } });
    clearTimeout(timer);
    return res;
  } catch(e) { clearTimeout(timer); throw e; }
}

// Minimal XML RSS parser — no dependencies needed
function parseRSS(xml, feedMeta) {
  const items = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const get   = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i'));
      return m ? m[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const title   = get("title").slice(0, 200);
    const link    = get("link").slice(0, 300);
    const pubDate = get("pubDate");
    const txt     = (title + " " + get("description")).toLowerCase();
    if (title && KEYWORDS.some(k => txt.includes(k))) {
      items.push({
        id:    link || `${feedMeta.name}-${Date.now()}-${items.length}`,
        title,
        link,
        date:  pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
        src:   feedMeta,
      });
    }
  }
  return items;
}

exports.handler = async (event) => {
  const headers = safeHeaders(event);
  if (!headers) return { statusCode: 403, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  const allItems = [];
  for (const feed of FEEDS) {
    try {
      const res = await timedFetch(feed.url);
      if (!res.ok) continue;
      const xml   = await res.text();
      const items = parseRSS(xml, { name: feed.name, icon: feed.icon, color: feed.color });
      allItems.push(...items);
    } catch(e) {
      console.error(`[rss] ${feed.name} failed:`, e.name);
    }
  }

  allItems.sort((a, b) => new Date(b.date) - new Date(a.date));
  const result = { signals: allItems.slice(0, 100), count: allItems.length };
  cache = { data: result, ts: Date.now() };
  return { statusCode: 200, headers, body: JSON.stringify(result) };
};
