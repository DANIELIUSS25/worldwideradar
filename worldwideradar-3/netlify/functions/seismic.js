"use strict";
// USGS Earthquake feed — free, no API key needed
// Returns M4.5+ earthquakes from past 7 days globally

exports.handler = async function(event) {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
    "Cache-Control": "public, max-age=600",
  };
  try {
    const fetch = require("node-fetch");
    const url   = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson";
    const res   = await fetch(url, { timeout: 10000 });
    if (!res.ok) throw new Error(`USGS ${res.status}`);
    const data  = await res.json();
    const quakes = (data.features || []).map(f => ({
      id:    f.id,
      lat:   f.geometry.coordinates[1],
      lon:   f.geometry.coordinates[0],
      depth: f.geometry.coordinates[2],
      mag:   f.properties.mag,
      place: f.properties.place,
      time:  f.properties.time,
      sig:   f.properties.sig,
    }));
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ quakes, source: "usgs", count: quakes.length }),
    };
  } catch (err) {
    return {
      statusCode: 200, headers,
      body: JSON.stringify({ quakes: [], source: "error", error: err.message }),
    };
  }
};
