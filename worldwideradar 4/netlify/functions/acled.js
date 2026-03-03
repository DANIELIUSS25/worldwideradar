// netlify/functions/acled.js
// Primary source: GDELT GEO API — GPS-located conflict events from 65k+ news sources
// Updated every 15 minutes, completely free, zero auth required
// Falls back to ReliefWeb (UN/OCHA reports) if GDELT fails
// Falls back to demo data if both fail

const fetch = require("node-fetch");

const CACHE_TTL      = 10 * 60 * 1000; // 10 min cache
const FETCH_TIMEOUT  = 12000;
const ALLOWED_ORIGINS = ["https://worldwideradar.com", "https://worldwideradar.netlify.app"];

let cache = { data: null, ts: 0 };

// Conflict keywords for GDELT query
const GDELT_QUERY = encodeURIComponent(
  "war OR airstrike OR shelling OR bombing OR troops OR battle OR killed OR attack OR offensive OR ceasefire OR invasion OR drone OR artillery OR insurgent OR militant"
);

// Map of known countries to approximate centers for ReliefWeb fallback
const COUNTRY_CENTERS = {
  "Ukraine":{"lat":49.0,"lon":31.0},
  "Sudan":{"lat":15.5,"lon":30.0},
  "Myanmar":{"lat":19.0,"lon":96.0},
  "Mali":{"lat":17.0,"lon":-4.0},
  "Democratic Republic of the Congo":{"lat":-2.5,"lon":23.5},
  "Yemen":{"lat":15.5,"lon":48.0},
  "Somalia":{"lat":6.0,"lon":46.0},
  "Haiti":{"lat":19.0,"lon":-72.3},
  "Ethiopia":{"lat":9.0,"lon":40.0},
  "Nigeria":{"lat":9.0,"lon":8.0},
  "Syria":{"lat":35.0,"lon":38.0},
  "Afghanistan":{"lat":33.0,"lon":65.0},
  "Burkina Faso":{"lat":12.3,"lon":-1.5},
  "Niger":{"lat":17.0,"lon":8.0},
  "Libya":{"lat":26.0,"lon":17.0},
  "Mozambique":{"lat":-18.0,"lon":35.0},
  "Iraq":{"lat":33.0,"lon":43.0},
  "Israel":{"lat":31.5,"lon":34.8},
  "Palestinian Territory":{"lat":31.5,"lon":34.5},
};

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

async function timedFetch(url, opts = {}) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { ...opts, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch(e) { clearTimeout(timer); throw e; }
}

// Classify event type from headline text
function classify(text) {
  const t = (text || "").toLowerCase();
  if (/airstrike|drone|bomb|missile|shelling|artillery|rocket|explosion/.test(t))
    return "Explosions/Remote violence";
  if (/battle|clash|offensive|troops|forces|assault|frontline|fighting/.test(t))
    return "Battles";
  if (/kill|dead|civilian|massacre|murder|execution/.test(t))
    return "Violence against civilians";
  if (/protest|demonstrat|march|rally/.test(t))
    return "Protests";
  if (/coup|riot|unrest|uprising|looting/.test(t))
    return "Riots";
  return "Battles";
}

// ── SOURCE 1: GDELT GEO API ───────────────────────────────────────────────────
async function fetchGDELT() {
  const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${GDELT_QUERY}&mode=pointdata&format=json&timespan=72h&maxpoints=600`;
  const res  = await timedFetch(url);
  if (!res.ok) throw new Error(`GDELT GEO ${res.status}`);
  const data = await res.json();

  const features = data.features || [];
  return features
    .filter(f => f.geometry?.coordinates?.length === 2)
    .map((f, i) => {
      const [lon, lat] = f.geometry.coordinates;
      const p = f.properties || {};
      const title = (p.name || p.title || "Conflict event").slice(0, 200);
      return {
        id:         `gdelt-${i}-${lon.toFixed(2)}-${lat.toFixed(2)}`,
        date:       new Date().toISOString().split("T")[0],
        type:       classify(title),
        subtype:    "News-sourced",
        actor1:     "Reported Forces",
        actor2:     "",
        country:    (p.countryCode || ""),
        location:   (p.name || "").slice(0, 80),
        lat:        parseFloat(lat.toFixed(4)),
        lon:        parseFloat(lon.toFixed(4)),
        fatalities: 0,
        notes:      title,
        url:        (p.url || "").startsWith("http") ? p.url.slice(0, 300) : "",
        count:      parseInt(p.count) || 1,
        source:     "gdelt_geo",
      };
    })
    .filter(e => Math.abs(e.lat) > 0.1 || Math.abs(e.lon) > 0.1);
}

// ── SOURCE 2: ReliefWeb (UN/OCHA) — country-level fallback ───────────────────
async function fetchReliefWeb() {
  const url = "https://api.reliefweb.int/v2/reports"
    + "?appname=worldwideradar"
    + "&filter[operator]=AND"
    + "&filter[conditions][0][field]=theme.name&filter[conditions][0][value]=Conflict%20and%20Violence"
    + "&filter[conditions][1][field]=language.name&filter[conditions][1][value]=English"
    + "&sort[0][field]=date.created&sort[0][direction]=desc"
    + "&limit=60"
    + "&fields[include][]=title"
    + "&fields[include][]=country"
    + "&fields[include][]=date"
    + "&fields[include][]=source"
    + "&fields[include][]=url_alias"
    + "&slim=1";

  const res  = await timedFetch(url);
  if (!res.ok) throw new Error(`ReliefWeb ${res.status}`);
  const data = await res.json();

  return (data.data || []).flatMap((item, i) => {
    const f  = item.fields || {};
    const countries = Array.isArray(f.country) ? f.country : (f.country ? [f.country] : []);
    return countries.map(c => {
      const center = COUNTRY_CENTERS[c.name] || null;
      if (!center) return null;
      // Scatter points within country so they don't all stack
      const jitter = () => (Math.random() - 0.5) * 3;
      return {
        id:         `rw-${item.id}-${i}`,
        date:       (f.date?.created || "").slice(0, 10),
        type:       "Situation Report",
        subtype:    "UN/OCHA Report",
        actor1:     (Array.isArray(f.source) ? f.source[0]?.name : f.source?.name) || "UN/OCHA",
        actor2:     "",
        country:    c.name || "",
        location:   c.name || "",
        lat:        parseFloat((center.lat + jitter()).toFixed(4)),
        lon:        parseFloat((center.lon + jitter()).toFixed(4)),
        fatalities: 0,
        notes:      (f.title || "").slice(0, 200),
        url:        f.url_alias ? `https://reliefweb.int${f.url_alias}` : "",
        count:      1,
        source:     "reliefweb",
      };
    }).filter(Boolean);
  });
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = safeHeaders(event);
  if (!headers) return { statusCode: 403, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ error: "Forbidden" }) };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers };
  if (event.httpMethod !== "GET")     return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };

  // Serve cache if fresh
  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
  }

  let events  = [];
  let source  = "demo";

  // Try GDELT GEO first
  try {
    events = await fetchGDELT();
    source = "gdelt_geo";
    console.log(`[acled] GDELT GEO: ${events.length} events`);
  } catch(e) {
    console.error("[acled] GDELT failed:", e.name);
  }

  // If GDELT returned nothing useful, try ReliefWeb
  if (events.length < 10) {
    try {
      const rwEvents = await fetchReliefWeb();
      events  = [...events, ...rwEvents];
      source  = events.length > 0 ? (source === "gdelt_geo" ? "gdelt+reliefweb" : "reliefweb") : "demo";
      console.log(`[acled] ReliefWeb added: ${rwEvents.length} events`);
    } catch(e) {
      console.error("[acled] ReliefWeb failed:", e.name);
    }
  }

  // Both failed — use demo data
  if (events.length === 0) {
    events = generateDemo();
    source = "demo";
  }

  const result = {
    events: events.slice(0, 800),
    source,
    count:  events.length,
    updated: new Date().toISOString(),
  };

  cache = { data: result, ts: Date.now() };
  return { statusCode: 200, headers, body: JSON.stringify(result) };
};

// ── DEMO FALLBACK ─────────────────────────────────────────────────────────────
function generateDemo() {
  const types = ["Battles","Explosions/Remote violence","Violence against civilians","Protests","Riots"];
  const zones = [
    { country:"Ukraine",  locs:[{n:"Donetsk",lat:48.015,lon:37.802},{n:"Zaporizhzhia",lat:47.838,lon:35.139},{n:"Kharkiv",lat:49.993,lon:36.230},{n:"Kherson",lat:46.635,lon:32.617}]},
    { country:"Gaza",     locs:[{n:"Gaza City",lat:31.501,lon:34.467},{n:"Rafah",lat:31.297,lon:34.258},{n:"Khan Yunis",lat:31.344,lon:34.306}]},
    { country:"Sudan",    locs:[{n:"Khartoum",lat:15.552,lon:32.532},{n:"El Fasher",lat:13.627,lon:25.349},{n:"Omdurman",lat:15.644,lon:32.480}]},
    { country:"Myanmar",  locs:[{n:"Mandalay",lat:21.978,lon:96.083},{n:"Sagaing",lat:21.878,lon:95.979}]},
    { country:"Mali",     locs:[{n:"Bamako",lat:12.653,lon:-8.000},{n:"Mopti",lat:14.488,lon:-4.186}]},
    { country:"DRC",      locs:[{n:"Goma",lat:-1.679,lon:29.221},{n:"Butembo",lat:0.131,lon:29.288}]},
    { country:"Yemen",    locs:[{n:"Hodeidah",lat:14.800,lon:42.954},{n:"Sanaa",lat:15.369,lon:44.191}]},
    { country:"Somalia",  locs:[{n:"Mogadishu",lat:2.046,lon:45.341}]},
    { country:"Nigeria",  locs:[{n:"Maiduguri",lat:11.848,lon:13.160}]},
  ];
  const out = [];
  const now = new Date();
  zones.forEach(z => z.locs.forEach(loc => {
    for (let i = 0; i < Math.floor(Math.random()*7)+2; i++) {
      const daysAgo = Math.floor(Math.random()*30);
      const type    = types[Math.floor(Math.random()*types.length)];
      out.push({
        id:`demo-${z.country}-${i}-${daysAgo}`,
        date: new Date(now - daysAgo*86400000).toISOString().split("T")[0],
        type, subtype: type, actor1:"Armed Group", actor2:"Military Forces",
        country:z.country, location:loc.n,
        lat: loc.lat + (Math.random()-0.5)*0.5,
        lon: loc.lon + (Math.random()-0.5)*0.5,
        fatalities: type==="Battles"?Math.floor(Math.random()*25):Math.floor(Math.random()*8),
        notes:`${type} reported in ${loc.n}, ${z.country}.`,
        url:"", count:1, source:"demo",
      });
    }
  }));
  return out.sort((a,b)=>new Date(b.date)-new Date(a.date));
}
