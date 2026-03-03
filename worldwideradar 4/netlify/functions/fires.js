"use strict";
// NASA FIRMS — Satellite thermal fire hotspots (near real-time)
// Register free API key at: https://firms.modaps.eosdis.nasa.gov/api/map_key/
// Set env var: FIRMS_API_KEY in Netlify dashboard
// Without key → returns realistic demo data for conflict zones

function demoFires() {
  const seeds = [
    // Ukraine frontline arc
    { lat:48.0,lon:38.5,frp:45 },{ lat:48.2,lon:37.8,frp:67 },
    { lat:47.8,lon:39.1,frp:32 },{ lat:48.5,lon:36.2,frp:89 },
    { lat:47.5,lon:37.5,frp:123 },{ lat:49.1,lon:36.8,frp:28 },
    { lat:48.8,lon:37.2,frp:54 },{ lat:47.2,lon:38.8,frp:76 },
    // Gaza strip
    { lat:31.4,lon:34.4,frp:210 },{ lat:31.5,lon:34.5,frp:180 },
    { lat:31.3,lon:34.3,frp:155 },{ lat:31.6,lon:34.6,frp:199 },
    // Sudan / Darfur
    { lat:13.5,lon:22.4,frp:38 },{ lat:12.8,lon:23.1,frp:52 },
    { lat:15.2,lon:31.8,frp:29 },{ lat:14.1,lon:25.2,frp:41 },
    // Myanmar
    { lat:20.1,lon:94.5,frp:41 },{ lat:19.3,lon:96.2,frp:35 },
    { lat:21.5,lon:97.1,frp:48 },{ lat:18.8,lon:95.8,frp:33 },
    // Sahel
    { lat:14.2,lon:-2.1,frp:25 },{ lat:13.8,lon:1.2,frp:31 },
    { lat:15.1,lon:3.4,frp:27 },{ lat:12.9,lon:-0.8,frp:19 },
    // DRC
    { lat:-1.2,lon:28.9,frp:44 },{ lat:-2.1,lon:27.5,frp:39 },
    { lat:-0.8,lon:29.3,frp:36 },{ lat:-1.8,lon:28.1,frp:43 },
    // Yemen
    { lat:15.5,lon:44.2,frp:62 },{ lat:14.8,lon:45.1,frp:48 },
    { lat:15.9,lon:43.8,frp:55 },
  ];
  const result = [];
  seeds.forEach(s => {
    result.push({ lat: s.lat, lon: s.lon, frp: s.frp, brightness: 290 + s.frp * 0.8, daynight: "N", confidence: "h" });
    for (let i = 0; i < 5; i++) {
      result.push({
        lat: s.lat + (Math.random()-0.5)*2.2,
        lon: s.lon + (Math.random()-0.5)*2.2,
        frp: Math.max(5, s.frp * (0.3 + Math.random()*0.7)),
        brightness: 280 + Math.random()*80,
        daynight: Math.random()>0.5?"D":"N",
        confidence: "n",
      });
    }
  });
  return result;
}

function parseFIRMSCsv(csv) {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/"/g,""));
  const out = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(",").map(v => v.trim().replace(/"/g,""));
    if (vals.length < 3) continue;
    const row = {};
    headers.forEach((h,idx) => { row[h] = vals[idx]; });
    const lat = parseFloat(row.latitude);
    const lon = parseFloat(row.longitude);
    if (isNaN(lat)||isNaN(lon)) continue;
    out.push({
      lat, lon,
      frp: parseFloat(row.frp)||0,
      brightness: parseFloat(row.bright_ti4||row.brightness)||300,
      daynight: row.daynight||"D",
      confidence: row.confidence||"n",
    });
  }
  return out;
}

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin":"*",
    "Content-Type":"application/json",
    "Cache-Control":"public, max-age=900",
  };
  const MAP_KEY = process.env.FIRMS_API_KEY;
  if (!MAP_KEY) {
    const d = demoFires();
    return { statusCode:200, headers, body: JSON.stringify({ fires:d, source:"demo", count:d.length }) };
  }
  try {
    const fetch = require("node-fetch");
    const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${MAP_KEY}/VIIRS_NOAA20_NRT/world/1`;
    const res = await fetch(url, { timeout:12000 });
    if (!res.ok) throw new Error(`FIRMS ${res.status}`);
    const csv = await res.text();
    const fires = parseFIRMSCsv(csv).filter(f => f.frp > 8 && f.confidence !== "l");
    return { statusCode:200, headers, body: JSON.stringify({ fires, source:"nasa_firms", count:fires.length }) };
  } catch(err) {
    const d = demoFires();
    return { statusCode:200, headers, body: JSON.stringify({ fires:d, source:"demo_fallback", count:d.length }) };
  }
};
