// US Citizens Status — State Dept Travel Advisories + Alerts
// Sources: travel.state.gov RSS + static Level 3/4 advisory data
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

// Static Level 3 (Reconsider Travel) + Level 4 (Do Not Travel) advisories
// with known stuck/stranded situations as of early 2025
// Augmented at runtime with live RSS feed
const STATIC_ADVISORIES = [
  {
    country: "Ukraine",         level: 4, lat: 49.0,  lon: 31.0,
    summary: "Do Not Travel. Active war zones. ~1,000 US citizens registered.",
    evacuated: false, stranded: true, count: "~1,000+",
    lastUpdate: "2025-02-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/ukraine-travel-advisory.html",
  },
  {
    country: "Gaza / West Bank", level: 4, lat: 31.5,  lon: 34.5,
    summary: "Do Not Travel. Active conflict. Limited consular access.",
    evacuated: false, stranded: true, count: "Unknown",
    lastUpdate: "2025-02-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/israel-west-bank-and-gaza-travel-advisory.html",
  },
  {
    country: "Sudan",           level: 4, lat: 15.5,  lon: 32.5,
    summary: "Do Not Travel. Civil war. Embassy Khartoum suspended operations.",
    evacuated: true, stranded: true, count: "~16,000",
    lastUpdate: "2025-01-15", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/sudan-travel-advisory.html",
  },
  {
    country: "Russia",          level: 4, lat: 61.5,  lon: 105.0,
    summary: "Do Not Travel. Wrongful detention risk. 16 Americans currently detained.",
    evacuated: false, stranded: false, count: "16 detained",
    lastUpdate: "2025-02-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/russia-travel-advisory.html",
  },
  {
    country: "Haiti",           level: 4, lat: 18.9,  lon: -72.3,
    summary: "Do Not Travel. Gang control of Port-au-Prince. Limited evacuation options.",
    evacuated: false, stranded: true, count: "~30,000+",
    lastUpdate: "2025-01-20", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/haiti-travel-advisory.html",
  },
  {
    country: "Myanmar",         level: 4, lat: 19.0,  lon: 96.0,
    summary: "Do Not Travel. Civil war. Embassy Yangon operating at reduced capacity.",
    evacuated: false, stranded: true, count: "~1,500",
    lastUpdate: "2025-01-10", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/burma-travel-advisory.html",
  },
  {
    country: "Iran",            level: 4, lat: 32.4,  lon: 53.7,
    summary: "Do Not Travel. High risk of wrongful detention. 4+ Americans held.",
    evacuated: false, stranded: false, count: "4+ detained",
    lastUpdate: "2025-02-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/iran-travel-advisory.html",
  },
  {
    country: "North Korea",     level: 4, lat: 40.0,  lon: 127.0,
    summary: "Do Not Travel. No US Embassy. Severe risk of arbitrary detention.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/north-korea-travel-advisory.html",
  },
  {
    country: "Afghanistan",     level: 4, lat: 33.9,  lon: 67.7,
    summary: "Do Not Travel. Taliban control. Embassy Kabul suspended. ~400 Americans sought evacuation.",
    evacuated: false, stranded: true, count: "~400",
    lastUpdate: "2025-01-15", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/afghanistan-travel-advisory.html",
  },
  {
    country: "Belarus",         level: 4, lat: 53.9,  lon: 27.6,
    summary: "Do Not Travel. Wrongful detention risk. Restricted embassy operations.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/belarus-travel-advisory.html",
  },
  {
    country: "Libya",           level: 4, lat: 26.3,  lon: 17.2,
    summary: "Do Not Travel. Civil conflict. Embassy Tripoli suspended.",
    evacuated: false, stranded: true, count: "~100",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/libya-travel-advisory.html",
  },
  {
    country: "Venezuela",       level: 4, lat: 6.4,   lon: -66.6,
    summary: "Do Not Travel. Arbitrary detention risk. 6 Americans wrongfully detained.",
    evacuated: false, stranded: false, count: "6 detained",
    lastUpdate: "2025-01-15", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/venezuela-travel-advisory.html",
  },
  {
    country: "Mali",            level: 3, lat: 17.6,  lon: -4.0,
    summary: "Reconsider Travel. Terrorist kidnapping threat. Embassy Bamako reduced capacity.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/mali-travel-advisory.html",
  },
  {
    country: "Somalia",         level: 4, lat: 5.0,   lon: 46.0,
    summary: "Do Not Travel. Al-Shabaab threat. No Embassy in Mogadishu.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/somalia-travel-advisory.html",
  },
  {
    country: "Yemen",           level: 4, lat: 15.5,  lon: 48.5,
    summary: "Do Not Travel. Active conflict. US Embassy Sanaa suspended 2015.",
    evacuated: false, stranded: true, count: "~5,000",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/yemen-travel-advisory.html",
  },
  {
    country: "Central African Republic", level: 4, lat: 6.6, lon: 20.9,
    summary: "Do Not Travel. Armed groups. Limited government control outside capital.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/central-african-republic-travel-advisory.html",
  },
  {
    country: "South Sudan",     level: 4, lat: 6.9,   lon: 31.3,
    summary: "Do Not Travel. Ongoing armed conflict. High crime.",
    evacuated: false, stranded: false, count: "Unknown",
    lastUpdate: "2025-01-01", url: "https://travel.state.gov/content/travel/en/traveladvisories/traveladvisories/south-sudan-travel-advisory.html",
  },
];

// Fetch live State Dept alerts RSS
async function fetchStateDeptRSS() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(
      "https://travel.state.gov/content/travel/en/news/travel-alerts.html.rss",
      { headers: { "User-Agent": "WorldwideRadar/1.0 (worldwideradar.com)" }, signal: controller.signal }
    );
    clearTimeout(timer);
    const xml = await res.text();
    const items = [];
    const itemRx = /<item>([\s\S]*?)<\/item>/g;
    let m;
    while ((m = itemRx.exec(xml)) !== null) {
      const get = (tag) => { const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`); const x = r.exec(m[1]); return x ? (x[1]||x[2]||"").trim() : ""; };
      items.push({ title: get("title"), summary: get("description"), url: get("link"), date: get("pubDate") });
    }
    return items.slice(0, 10);
  } catch(_) { return []; }
}

exports.handler = async () => {
  const [liveAlerts] = await Promise.all([fetchStateDeptRSS()]);

  const stranded = STATIC_ADVISORIES.filter(a => a.stranded);
  const detained = STATIC_ADVISORIES.filter(a => !a.stranded && a.count && a.count !== "Unknown");
  const totalStranded = stranded.reduce((s, a) => {
    const n = parseInt((a.count||"0").replace(/[^0-9]/g, ""));
    return s + (isNaN(n) ? 0 : n);
  }, 0);

  return {
    statusCode: 200,
    headers: CORS,
    body: JSON.stringify({
      advisories: STATIC_ADVISORIES,
      liveAlerts,
      stats: {
        level4: STATIC_ADVISORIES.filter(a => a.level === 4).length,
        level3: STATIC_ADVISORIES.filter(a => a.level === 3).length,
        stranded: stranded.length,
        totalStranded,
        detained: detained.length,
      },
      updated: new Date().toISOString(),
    }),
  };
};
