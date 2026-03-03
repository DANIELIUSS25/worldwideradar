"use strict";
// Polymarket — prediction market odds for active geopolitical/conflict events
// Public API, no auth required

const CONFLICT_KEYWORDS = [
  "war","conflict","ceasefire","invasion","nato","nuclear","attack",
  "russia","ukraine","israel","gaza","iran","china","taiwan",
  "escalate","military","missile","troops","coup","sanctions"
];

let cache = { data: null, ts: 0 };
const CACHE_TTL = 10 * 60 * 1000;

function isConflictMarket(q) {
  const lower = (q || "").toLowerCase();
  return CONFLICT_KEYWORDS.some(k => lower.includes(k));
}

exports.handler = async function() {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=600",
  };

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  try {
    const fetch = require("node-fetch");
    // Gamma API — Polymarket markets, conflict/geopolitical filter
    const url = "https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=200&order=volume&ascending=false";
    const res = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error("Polymarket " + res.status);
    const data = await res.json();
    const markets = (Array.isArray(data) ? data : (data.markets || []));
    const filtered = markets
      .filter(m => isConflictMarket(m.question) || isConflictMarket(m.description))
      .slice(0, 30)
      .map(m => ({
        id:       m.id || m.conditionId,
        question: m.question,
        prob:     parseFloat(m.outcomePrices?.[0] || m.outcomes?.[0]?.price || 0.5),
        volume:   parseFloat(m.volumeNum || m.volume || 0),
        endDate:  m.endDate,
        active:   m.active !== false,
      }));
    const result = { markets: filtered, source: "polymarket", count: filtered.length };
    cache = { data: result, ts: Date.now() };
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    // Demo data if Polymarket unavailable
    const demo = {
      markets: [
        { id:"d1", question:"Will Russia control Kharkiv by end of 2025?",      prob:0.12, volume:2400000 },
        { id:"d2", question:"Will there be a ceasefire in Gaza in Q1 2025?",     prob:0.38, volume:1800000 },
        { id:"d3", question:"Will Iran launch a direct strike on Israel in 2025?",prob:0.24, volume:3200000 },
        { id:"d4", question:"Will NATO invoke Article 5 in 2025?",               prob:0.08, volume:980000  },
        { id:"d5", question:"Will China conduct military exercises near Taiwan?", prob:0.61, volume:1500000 },
        { id:"d6", question:"Will Sudan peace talks succeed by mid-2025?",       prob:0.19, volume:420000  },
        { id:"d7", question:"Will North Korea conduct nuclear test in 2025?",    prob:0.31, volume:2100000 },
        { id:"d8", question:"Will Ukraine join NATO by 2026?",                   prob:0.09, volume:890000  },
      ],
      source: "demo",
      count: 8,
    };
    return { statusCode: 200, headers, body: JSON.stringify(demo) };
  }
};
