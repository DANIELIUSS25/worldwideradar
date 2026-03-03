import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SEV_COLOR, ACLED_COLORS } from "../data/zones.js";
import { MONO } from "./UI.jsx";

// ── Military dark map style (no API key required) ─────────────────────────────
const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

// Pulse ring sizes for animation
const PULSE_SIZES = {
  CRITICAL: { base: 14, ring: 28, shadow: "0 0 18px #ff2d5580" },
  HIGH:     { base: 11, ring: 22, shadow: "0 0 14px #ff9f0a80" },
  MEDIUM:   { base: 9,  ring: 18, shadow: "0 0 10px #ffd60a60" },
};

// Create animated HTML marker element for a zone
function createZoneMarker(zone, isSelected) {
  const color = SEV_COLOR[zone.sev] || "#ffd60a";
  const sizes = PULSE_SIZES[zone.sev] || PULSE_SIZES.MEDIUM;

  const el = document.createElement("div");
  el.className = `wwr-zone-marker zone-${zone.sev.toLowerCase()}`;
  el.style.cssText = `
    position: relative;
    width: ${sizes.base * 2}px;
    height: ${sizes.base * 2}px;
    cursor: pointer;
    z-index: ${isSelected ? 999 : 100};
  `;
  el.dataset.zoneId = zone.id;

  el.innerHTML = `
    <div class="wwr-marker-ring" style="
      position: absolute;
      inset: 0;
      border-radius: 50%;
      border: 2px solid ${color};
      opacity: 0;
      animation: wwr-ring-pulse ${zone.sev === "CRITICAL" ? "1.2" : "1.8"}s ease-out infinite;
      transform: scale(1);
    "></div>
    <div class="wwr-marker-ring wwr-ring2" style="
      position: absolute;
      inset: -${sizes.ring - sizes.base}px;
      border-radius: 50%;
      border: 1px solid ${color};
      opacity: 0;
      animation: wwr-ring-pulse ${zone.sev === "CRITICAL" ? "1.2" : "1.8"}s ease-out infinite;
      animation-delay: 0.35s;
    "></div>
    <div style="
      position: absolute;
      inset: 0;
      border-radius: 50%;
      background: ${color}${isSelected ? "ff" : "cc"};
      box-shadow: ${sizes.shadow}${isSelected ? ", 0 0 30px " + color : ""};
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    ">
      ${zone.sev === "CRITICAL" ? `<div style="width: ${sizes.base * 0.35}px; height: ${sizes.base * 0.35}px; border-radius: 50%; background: #fff; opacity: 0.9;"></div>` : ""}
    </div>
    ${isSelected ? `<div style="
      position: absolute;
      bottom: 100%;
      left: 50%;
      transform: translateX(-50%);
      margin-bottom: 6px;
      background: rgba(2,12,24,0.95);
      border: 1px solid ${color};
      padding: 4px 8px;
      border-radius: 3px;
      white-space: nowrap;
      font-family: 'Share Tech Mono', monospace;
      font-size: 9px;
      color: ${color};
      letter-spacing: 1.5px;
      pointer-events: none;
    ">${zone.name.toUpperCase()}</div>` : ""}
  `;
  return el;
}

// Convert ACLED events to GeoJSON FeatureCollection
function eventsToGeoJSON(events) {
  const features = events
    .filter(e => e.latitude && e.longitude)
    .map(e => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [parseFloat(e.longitude), parseFloat(e.latitude)] },
      properties: {
        type: e.event_type || e.type || "Unknown",
        fatalities: parseInt(e.fatalities) || 0,
        weight: (parseInt(e.fatalities) || 0) * 2 + 1,
      },
    }));
  return { type: "FeatureCollection", features };
}

// ── Main Map Component ─────────────────────────────────────────────────────────
export default function MapLibreMap({ zones, acledEvents, selected, onSelect, filter, showACLED, timeRange }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const markersRef   = useRef({});
  const prevSelected = useRef(null);

  const visZones = filter === "ALL" ? zones : zones.filter(z => z.sev === filter);

  // ── Initialize map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [20, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 14,
      pitchWithRotate: false,
      attributionControl: false,
    });

    // Minimal attribution
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");

    map.on("load", () => {
      // ── Custom dark overlay for military look ──
      map.setPaintProperty("background", "background-color", "#020c18");

      // ── Event heatmap layer (GDELT/ACLED) ──
      map.addSource("events-heat", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "events-heatmap",
        type: "heatmap",
        source: "events-heat",
        maxzoom: 8,
        paint: {
          "heatmap-weight":     ["interpolate", ["linear"], ["get", "weight"], 0, 0, 10, 1],
          "heatmap-intensity":  ["interpolate", ["linear"], ["zoom"], 0, 0.6, 8, 2],
          "heatmap-color": [
            "interpolate", ["linear"], ["heatmap-density"],
            0,   "rgba(0,200,100,0)",
            0.2, "rgba(255,159,10,0.4)",
            0.4, "rgba(255,45,85,0.6)",
            0.7, "rgba(255,45,85,0.85)",
            1,   "rgba(255,255,255,0.95)",
          ],
          "heatmap-radius":   ["interpolate", ["linear"], ["zoom"], 0, 18, 8, 38],
          "heatmap-opacity":  0.78,
        },
      });

      // ── Event circle layer (high zoom) ──
      map.addSource("events-points", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 6,
        clusterRadius: 40,
      });
      map.addLayer({
        id: "events-circles",
        type: "circle",
        source: "events-points",
        minzoom: 5,
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-radius":       4,
          "circle-color":        ["match", ["get", "type"],
            "Battles",                      "#ff2d55",
            "Explosions/Remote violence",   "#ff6b35",
            "Violence against civilians",   "#ff9f0a",
            "Protests",                     "#ffd60a",
            "#0a84ff",
          ],
          "circle-opacity":      0.85,
          "circle-stroke-width": 0.5,
          "circle-stroke-color": "rgba(255,255,255,0.3)",
        },
      });

      // Cluster circles
      map.addLayer({
        id: "events-clusters",
        type: "circle",
        source: "events-points",
        filter: ["has", "point_count"],
        paint: {
          "circle-color":  ["step", ["get", "point_count"], "#ff9f0a", 10, "#ff6b35", 50, "#ff2d55"],
          "circle-radius": ["step", ["get", "point_count"], 10, 10, 15, 50, 22],
          "circle-opacity": 0.7,
          "circle-stroke-width": 1,
          "circle-stroke-color": "rgba(255,255,255,0.2)",
        },
      });
      map.addLayer({
        id: "events-cluster-count",
        type: "symbol",
        source: "events-points",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-font":  ["Noto Sans Regular"],
          "text-size":  10,
        },
        paint: { "text-color": "#fff" },
      });

      // Cluster click → zoom in
      map.on("click", "events-clusters", e => {
        const f = map.queryRenderedFeatures(e.point, { layers: ["events-clusters"] })[0];
        const clusterId = f.properties.cluster_id;
        map.getSource("events-points").getClusterExpansionZoom(clusterId, (err, zoom) => {
          if (err) return;
          map.easeTo({ center: f.geometry.coordinates, zoom });
        });
      });
      map.on("mouseenter", "events-clusters", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "events-clusters", () => (map.getCanvas().style.cursor = ""));

      mapRef.current = map;
    });

    return () => {
      Object.values(markersRef.current).forEach(m => m.remove());
      markersRef.current = {};
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // ── Update zone markers ─────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.loaded()) return;

    const activeIds = new Set(visZones.map(z => z.id));

    // Remove stale markers
    Object.keys(markersRef.current).forEach(id => {
      if (!activeIds.has(parseInt(id))) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });

    // Add/update markers
    visZones.forEach(zone => {
      const isSelected = selected?.id === zone.id;
      const existing   = markersRef.current[zone.id];

      if (existing) {
        // Re-render if selection changed
        if (prevSelected.current?.id === zone.id || isSelected) {
          existing.remove();
          delete markersRef.current[zone.id];
        } else return;
      }

      const el = createZoneMarker(zone, isSelected);
      el.addEventListener("click", e => {
        e.stopPropagation();
        onSelect(zone);
      });

      const marker = new maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([zone.lon, zone.lat])
        .addTo(map);

      markersRef.current[zone.id] = marker;
    });

    prevSelected.current = selected;
  }, [visZones, selected, onSelect]);

  // ── Fly to selected zone ────────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selected) return;
    const wait = map.loaded() ? 0 : 800;
    setTimeout(() => {
      if (!mapRef.current) return;
      mapRef.current.flyTo({
        center:   [selected.lon, selected.lat],
        zoom:     Math.max(mapRef.current.getZoom(), 4.5),
        duration: 1200,
        essential: true,
      });
    }, wait);
  }, [selected]);

  // ── Update event data layers ────────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src1 = map.getSource("events-heat");
      const src2 = map.getSource("events-points");
      if (!src1 || !src2) return;
      const data = showACLED && acledEvents.length ? eventsToGeoJSON(acledEvents.slice(0, 1000)) : { type: "FeatureCollection", features: [] };
      src1.setData(data);
      src2.setData(data);
    };
    if (map.loaded()) apply();
    else map.once("load", apply);
  }, [acledEvents, showACLED, timeRange]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#020c18" }}>
      {/* Map container */}
      <div ref={containerRef} style={{ width: "100%", height: "100%", background: "#020c18" }}/>

      {/* Corner radar crosshair decorations */}
      {[
        { top: 10, left: 10 },
        { top: 10, right: 10 },
        { bottom: 10, left: 10 },
        { bottom: 10, right: 10 },
      ].map((pos, i) => (
        <svg key={i} width="28" height="28" viewBox="0 0 28 28" style={{ position: "absolute", ...pos, opacity: 0.25, pointerEvents: "none" }}>
          <line x1="14" y1="0" x2="14" y2="10" stroke="#00c864" strokeWidth="1"/>
          <line x1="14" y1="18" x2="14" y2="28" stroke="#00c864" strokeWidth="1"/>
          <line x1="0" y1="14" x2="10" y2="14" stroke="#00c864" strokeWidth="1"/>
          <line x1="18" y1="14" x2="28" y2="14" stroke="#00c864" strokeWidth="1"/>
          <circle cx="14" cy="14" r="3" fill="none" stroke="#00c864" strokeWidth="1"/>
        </svg>
      ))}

      {/* Severity legend */}
      <div style={{ position: "absolute", bottom: 28, left: 12, background: "rgba(2,12,24,0.88)", border: "1px solid rgba(0,200,80,0.15)", borderRadius: 4, padding: "7px 10px", fontFamily: MONO, fontSize: 8, pointerEvents: "none" }}>
        {[["CRITICAL","#ff2d55"], ["HIGH","#ff9f0a"], ["MEDIUM","#ffd60a"]].map(([label, color]) => (
          <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color, boxShadow: `0 0 6px ${color}` }}/>
            <span style={{ color, letterSpacing: 1 }}>{label}</span>
          </div>
        ))}
        <div style={{ marginTop: 5, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 5 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,45,85,0.7)" }}/>
            <span style={{ color: "#3a3a3c", letterSpacing: 1 }}>BATTLES</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "rgba(255,215,10,0.7)" }}/>
            <span style={{ color: "#3a3a3c", letterSpacing: 1 }}>PROTESTS</span>
          </div>
        </div>
      </div>

      {/* Heatmap label */}
      {acledEvents.length > 0 && (
        <div style={{ position: "absolute", top: 10, right: 10, background: "rgba(2,12,24,0.8)", border: "1px solid rgba(255,159,10,0.2)", borderRadius: 3, padding: "3px 8px", fontFamily: MONO, fontSize: 7, color: "#ff9f0a", letterSpacing: 2, pointerEvents: "none" }}>
          ↑ EVENT DENSITY HEATMAP
        </div>
      )}

      {/* Pulse animation keyframe injected once */}
      <style>{`
        @keyframes wwr-ring-pulse {
          0%   { transform: scale(0.6); opacity: 0.8; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        .maplibregl-ctrl-attrib { opacity: 0.3 !important; font-size: 8px !important; }
        .maplibregl-ctrl-attrib a { color: #3a3a3c !important; }
        .maplibregl-ctrl-attrib-button { display: none !important; }
      `}</style>
    </div>
  );
}
