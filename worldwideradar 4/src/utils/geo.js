import * as d3 from "d3";

export const W = 920, H = 470;
export const PROJ = d3.geoNaturalEarth1().scale(152).translate([W/2, H/2]);

export function pt(lat, lon) {
  try {
    const [x, y] = PROJ([lon, lat]);
    return isNaN(x) || isNaN(y) ? null : [x, y];
  } catch { return null; }
}

export function timeAgo(d) {
  if (!d) return "";
  const m = Math.floor((Date.now() - new Date(d)) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

export function exportCSV(data, filename = "worldwideradar-export.csv") {
  if (!data?.length) return;
  const keys = Object.keys(data[0]);
  const rows = [keys.join(","), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? "")).join(","))];
  const blob = new Blob([rows.join("\n")], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// Conflict Activity Index color
export function caiColor(cai) {
  if (cai >= 75) return "#ff2d55";
  if (cai >= 50) return "#ff9f0a";
  if (cai >= 30) return "#ffd60a";
  return "#30d158";
}

export function deltaStr(delta) {
  if (!delta && delta !== 0) return "";
  return delta > 0 ? `+${delta}%` : delta < 0 ? `${delta}%` : "0%";
}

export function deltaColor(delta) {
  if (delta > 3)  return "#ff2d55";
  if (delta > 0)  return "#ff9f0a";
  if (delta < -3) return "#30d158";
  if (delta < 0)  return "#ffd60a";
  return "#636366";
}
