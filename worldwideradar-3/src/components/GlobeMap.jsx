import { useEffect, useRef, useState, useMemo } from "react";
import { SEV_COLOR, ACLED_COLORS } from "../data/zones.js";
import { MONO } from "./UI.jsx";

// Country ISO numeric → conflict severity mapping (topojson IDs)
const COUNTRY_CONFLICT = {
  804: "CRITICAL", // Ukraine
  275: "CRITICAL", // Palestinian Territory
  729: "HIGH",     // Sudan
  104: "HIGH",     // Myanmar
  466: "HIGH",     // Mali
  854: "HIGH",     // Burkina Faso
  562: "HIGH",     // Niger
  180: "HIGH",     // DR Congo
  887: "HIGH",     // Yemen
  706: "MEDIUM",   // Somalia
  332: "MEDIUM",   // Haiti
  231: "MEDIUM",   // Ethiopia
  704: "MEDIUM",   // Vietnam (SCS tension)
  608: "MEDIUM",   // Philippines (SCS)
  096: "LOW",      // Brunei (SCS)
  458: "LOW",      // Malaysia (SCS)
};

const SEV_FILL = {
  CRITICAL: "rgba(255,45,85,0.55)",
  HIGH:     "rgba(255,159,10,0.42)",
  MEDIUM:   "rgba(255,214,10,0.30)",
  LOW:      "rgba(48,209,88,0.18)",
};

const SEV_BORDER = {
  CRITICAL: "rgba(255,45,85,0.9)",
  HIGH:     "rgba(255,159,10,0.85)",
  MEDIUM:   "rgba(255,214,10,0.75)",
  LOW:      "rgba(48,209,88,0.6)",
};

export default function GlobeMap({ zones, acledEvents, fires, quakes, selected, onSelect, layers }) {
  const containerRef = useRef(null);
  const globeRef     = useRef(null);
  const [ready, setReady] = useState(false);

  const conflictArcs = useMemo(() => {
    // Draw arcs between sponsor states and proxy conflicts
    return [
      { startLat: 35.7,  startLng: 51.4,  endLat: 31.5,  endLng: 34.5,  label: "Iran → Gaza",       color: "#ff2d55" },
      { startLat: 35.7,  startLng: 51.4,  endLat: 15.5,  endLng: 48.5,  label: "Iran → Yemen",       color: "#ff2d55" },
      { startLat: 55.75, startLng: 37.6,  endLat: 49.0,  endLng: 31.0,  label: "Russia → Ukraine",   color: "#ff9f0a" },
      { startLat:-1.94,  startLng: 30.06, endLat:-1.5,   endLng: 28.5,  label: "Rwanda → DRC",       color: "#ff9f0a" },
      { startLat: 24.4,  startLng: 54.4,  endLat: 15.5,  endLng: 32.5,  label: "UAE → Sudan (RSF)",  color: "#ffd60a" },
    ];
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    let alive = true;

    (async () => {
      try {
        // Dynamic import to avoid SSR issues
        const { default: Globe } = await import("globe.gl");
        if (!alive || !containerRef.current) return;

        const W = containerRef.current.clientWidth  || 800;
        const H = containerRef.current.clientHeight || 500;

        const globe = Globe({ animateIn: true, waitForGlobeReady: true })(containerRef.current);
        globeRef.current = globe;

        globe
          .width(W)
          .height(H)
          .backgroundColor("rgba(0,0,0,0)")
          .atmosphereColor("#00c864")
          .atmosphereAltitude(0.18)
          .globeImageUrl("https://unpkg.com/three-globe/example/img/earth-dark.jpg")
          .bumpImageUrl("https://unpkg.com/three-globe/example/img/earth-topology.png");

        // Initial position: centered on conflict zones
        globe.pointOfView({ lat: 20, lng: 20, altitude: 2.0 }, 0);

        // Auto-rotate slowly
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.25;
        globe.controls().enableZoom = true;

        setReady(true);
        globeRef.current = globe;
      } catch (e) {
        console.error("Globe init failed:", e);
      }
    })();

    const handleResize = () => {
      if (globeRef.current && containerRef.current) {
        globeRef.current.width(containerRef.current.clientWidth);
        globeRef.current.height(containerRef.current.clientHeight);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => { alive = false; window.removeEventListener("resize", handleResize); };
  }, []);

  // Update layers whenever data or toggles change
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !ready) return;

    // ── CONFLICT ZONE RINGS ───────────────────────────────────────────────────
    const zonePoints = zones.map(z => ({
      ...z,
      color: SEV_COLOR[z.sev] || "#ffd60a",
      radius: z.sev === "CRITICAL" ? 0.9 : z.sev === "HIGH" ? 0.65 : 0.45,
      altitude: z.sev === "CRITICAL" ? 0.06 : z.sev === "HIGH" ? 0.04 : 0.025,
      isSelected: selected?.id === z.id,
    }));

    globe
      .pointsData(zonePoints)
      .pointLat("lat")
      .pointLng("lon")
      .pointColor(d => d.isSelected ? "#ffffff" : d.color)
      .pointRadius(d => d.isSelected ? d.radius * 1.8 : d.radius)
      .pointAltitude(d => d.isSelected ? d.altitude * 2.5 : d.altitude)
      .pointResolution(24)
      .pointLabel(d => `<div style="fontFamily:monospace;background:rgba(2,12,24,0.9);border:1px solid ${d.color};padding:8px 12px;borderRadius:4px;minWidth:180px;color:#ebebf0">
        <div style="color:${d.color};fontSize:11px;fontWeight:bold;letterSpacing:2px;marginBottom:4px">${d.name.toUpperCase()}</div>
        <div style="fontSize:9px;color:#636366;letterSpacing:1px">${d.sev} · ${d.type}</div>
        <div style="fontSize:9px;color:#8e8e93;marginTop:4px">CAI: ${d.cai} · ${d.cai > d.cai - d.delta ? "↑" : "↓"} ${Math.abs(d.delta)}% W/W</div>
      </div>`)
      .onPointClick(d => {
        onSelect(d);
        globe.controls().autoRotate = false;
        globe.pointOfView({ lat: d.lat, lng: d.lon, altitude: 1.2 }, 1200);
        setTimeout(() => { if (globeRef.current) globeRef.current.controls().autoRotate = true; }, 5000);
      });

    // ── CONFLICT ARCS ─────────────────────────────────────────────────────────
    globe
      .arcsData(conflictArcs)
      .arcStartLat("startLat").arcStartLng("startLng")
      .arcEndLat("endLat").arcEndLng("endLng")
      .arcColor("color")
      .arcAltitude(0.22)
      .arcStroke(0.6)
      .arcDashLength(0.35)
      .arcDashGap(0.18)
      .arcDashAnimateTime(2200)
      .arcLabel(d => `<div style="background:rgba(2,12,24,0.85);padding:4px 8px;borderRadius:3px;fontFamily:monospace;fontSize:9px;color:#ff9f0a;letterSpacing:1px">${d.label}</div>`);

    // ── ACLED EVENTS ──────────────────────────────────────────────────────────
    if (layers.events && acledEvents.length > 0) {
      const evtPoints = acledEvents.slice(0, 600).filter(e => e.lat && e.lon).map(e => ({
        lat: e.lat, lon: e.lon,
        color: ACLED_COLORS[e.type] || "#636366",
        r: e.fatalities > 20 ? 0.25 : e.fatalities > 5 ? 0.18 : 0.12,
        label: `${e.type || ""}: ${e.location || ""} (☠${e.fatalities || 0})`,
        alt: 0.005,
      }));
      globe
        .customLayerData(evtPoints)
        .customThreeObject(d => {
          const THREE = globe.scene ? globe.scene().__proto__.constructor : window.THREE;
          if (!THREE) return null;
          // Fallback to dots via rings
          return null;
        });
      // Use rings for ACLED events (more performant)
      globe
        .ringsData(layers.events ? acledEvents.slice(0, 300).filter(e => e.lat && e.lon).map(e => ({
          lat: e.lat, lng: e.lon,
          maxR: e.fatalities > 20 ? 0.9 : e.fatalities > 5 ? 0.6 : 0.35,
          propagationSpeed: 1.5,
          repeatPeriod: 1800,
          color: ACLED_COLORS[e.type] || "#636366",
        })) : [])
        .ringColor(d => t => `${d.color}${Math.round((1-t)*255).toString(16).padStart(2,"0")}`)
        .ringMaxRadius("maxR")
        .ringPropagationSpeed("propagationSpeed")
        .ringRepeatPeriod("repeatPeriod");
    } else {
      globe.ringsData([]);
    }

    // ── SATELLITE FIRES ───────────────────────────────────────────────────────
    const firePoints = layers.fires && fires.length > 0
      ? fires.slice(0, 2000).map(f => ({
          lat: f.lat, lng: f.lon,
          size: Math.min(0.8, 0.1 + f.frp / 300),
          color: f.frp > 100 ? "#ff2d55" : f.frp > 40 ? "#ff6b35" : "#ff9f0a",
          label: `🔥 FRP: ${Math.round(f.frp)} MW · ${f.daynight === "N" ? "Night" : "Day"}`,
          alt: 0.003,
        }))
      : [];

    // ── SEISMIC ───────────────────────────────────────────────────────────────
    const quakePoints = layers.seismic && quakes.length > 0
      ? quakes.map(q => ({
          lat: q.lat, lng: q.lon,
          label: `M${q.mag} · ${q.place}`,
          color: q.mag >= 7 ? "#bf5af2" : q.mag >= 6 ? "#ff2d55" : q.mag >= 5 ? "#ff9f0a" : "#ffd60a",
          size: 0.15 + (q.mag - 4.5) * 0.12,
          alt: 0.002,
        }))
      : [];

    // Combine fires + quakes into labels layer
    const allHexPoints = [...firePoints, ...quakePoints];
    globe
      .hexBinPointsData(allHexPoints)
      .hexBinPointWeight("size")
      .hexAltitude(d => d.sumWeight * 0.04)
      .hexBinResolution(4)
      .hexTopColor(d => firePoints.length ? "#ff6b35" : "#bf5af2")
      .hexSideColor(d => firePoints.length ? "rgba(255,107,53,0.5)" : "rgba(191,90,242,0.5)")
      .hexLabel(d => `${d.points.length} detections`);

    // ── LABELS for major zones ─────────────────────────────────────────────
    globe
      .labelsData(zones.filter(z => z.sev === "CRITICAL" || z.sev === "HIGH"))
      .labelLat("lat")
      .labelLng("lon")
      .labelText("name")
      .labelSize(d => d.sev === "CRITICAL" ? 1.4 : 1.0)
      .labelDotRadius(d => d.sev === "CRITICAL" ? 0.4 : 0.25)
      .labelColor(d => SEV_COLOR[d.sev] || "#ffd60a")
      .labelResolution(3)
      .labelAltitude(0.01);

  }, [ready, zones, acledEvents, fires, quakes, selected, layers, conflictArcs]);

  // Zoom to selected zone
  useEffect(() => {
    if (!selected || !globeRef.current || !ready) return;
    globeRef.current.controls().autoRotate = false;
    globeRef.current.pointOfView({ lat: selected.lat, lng: selected.lon, altitude: 1.4 }, 1200);
    setTimeout(() => {
      if (globeRef.current) globeRef.current.controls().autoRotate = true;
    }, 6000);
  }, [selected?.id, ready]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", position: "relative", background: "radial-gradient(ellipse at center, #051a2e 0%, #020c18 100%)" }}>
      {!ready && (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, zIndex: 2 }}>
          <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: "spin 2s linear infinite" }}>
            <circle cx={24} cy={24} r={20} fill="none" stroke="#00c864" strokeWidth="1.5" strokeDasharray="30 96"/>
            <circle cx={24} cy={24} r={12} fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
            <circle cx={24} cy={24} r={5} fill="#00c864"/>
          </svg>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#1a3a1a", letterSpacing: 4 }}>INITIALIZING 3D GLOBE ENGINE...</div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); }}`}</style>
        </div>
      )}
      {/* Attribution */}
      <div style={{ position: "absolute", bottom: 8, left: 12, fontFamily: MONO, fontSize: 7, color: "#1a3a1a", letterSpacing: 2, zIndex: 1, pointerEvents: "none" }}>
        SATELLITE: {fires.length > 0 ? `NASA FIRMS · ${fires.length} HOTSPOTS` : "DEMO MODE"} · SEISMIC: USGS · DRAG TO ROTATE · SCROLL TO ZOOM
      </div>
    </div>
  );
}
