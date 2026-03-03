import { useRef, useEffect, useState, useMemo, useCallback } from "react";
import * as d3 from "d3";
import { ACLED_COLORS, SEV_COLOR } from "../data/zones.js";
import { MILITARY_BASES, BASE_COLORS } from "../data/bases.js";
import { W, H, PROJ, pt } from "../utils/geo.js";
import { MONO } from "./UI.jsx";

function LayerPanel({ layers, onToggle }) {
  const items = [
    { key:"events",  label:"EVENTS",   color:"#ff9f0a" },
    { key:"zones",   label:"ZONES",    color:"#00c864" },
    { key:"fires",   label:"SAT FIRE", color:"#ff4500" },
    { key:"seismic", label:"SEISMIC",  color:"#00e5ff" },
    { key:"bases",   label:"BASES",    color:"#4fc3f7" },
  ];
  return (
    <div style={{
      position:"absolute", bottom:28, right:10, zIndex:10,
      background:"rgba(2,12,24,0.92)", border:"1px solid rgba(0,200,80,0.15)",
      borderRadius:3, padding:"6px 8px",
    }}>
      <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:3, marginBottom:5, fontFamily:MONO }}>MAP LAYERS</div>
      {items.map(item => (
        <div key={item.key} onClick={() => onToggle(item.key)}
          style={{ display:"flex", alignItems:"center", gap:5, padding:"3px 0", cursor:"pointer" }}>
          <div style={{
            width:10, height:10, borderRadius:2,
            background: layers[item.key] ? item.color : "rgba(255,255,255,0.06)",
            border:"1px solid " + item.color + "40", transition:"background 0.15s",
          }}/>
          <span style={{ fontSize:8, color: layers[item.key] ? item.color : "#2a3a2a", fontFamily:MONO, letterSpacing:1 }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function ZoomControls({ onZoom, onReset }) {
  const btn = (label, cb) => (
    <button onClick={cb} style={{
      display:"block", width:22, height:22, background:"rgba(2,12,24,0.92)",
      border:"1px solid rgba(0,200,80,0.2)", color:"#00c864", fontFamily:MONO,
      fontSize:13, cursor:"pointer", lineHeight:"20px", textAlign:"center",
    }}>{label}</button>
  );
  return (
    <div style={{ position:"absolute", top:10, right:10, zIndex:10, display:"flex", flexDirection:"column", gap:2 }}>
      {btn("+", () => onZoom(1.5))}
      {btn("\u2212", () => onZoom(1/1.5))}
      {btn("\u2302", onReset)}
    </div>
  );
}

function useWorldMapGeo(svgRef) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!svgRef.current) return;
    let alive = true;
    const loadTopo = () => new Promise(res => {
      if (window.topojson) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
    (async () => {
      await loadTopo();
      try {
        const world = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r => r.json());
        if (!alive) return;
        const path = d3.geoPath().projection(PROJ);
        const svg  = d3.select(svgRef.current);
        const ctry = window.topojson.feature(world, world.objects.countries);
        const bord = window.topojson.mesh(world, world.objects.countries, (a, b) => a !== b);
        svg.select("#sphere").attr("d", path({ type:"Sphere" }));
        svg.select("#graticule").attr("d", path(d3.geoGraticule()()));
        svg.select("#land").selectAll("path").data(ctry.features).join("path")
          .attr("d", path).attr("fill", "#0d2236").attr("stroke", "none");
        svg.select("#borders").attr("d", path(bord));
        setReady(true);
      } catch(_) {}
    })();
    return () => { alive = false; };
  }, []);
  return ready;
}

export default function WorldMap({
  zones, acledEvents, selected, onSelect, filter,
  showACLED, timeRange, fires, quakes, layers, onLayerToggle,
  usAdvisories,
}) {
  fires  = fires  || [];
  quakes = quakes || [];
  usAdvisories = usAdvisories || [];
  const svgRef       = useRef(null);
  const zoomRef      = useRef(null);
  const containerRef = useRef(null);
  const ready        = useWorldMapGeo(svgRef);
  const [pulse, setPulse]     = useState(0);
  const [zoomK, setZoomK]     = useState(1);
  const [hovBase, setHovBase] = useState(null);

  useEffect(() => {
    const t = setInterval(() => setPulse(p => p + 1), 900);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.8, 14])
      .on("zoom", (event) => {
        if (containerRef.current) {
          d3.select(containerRef.current).attr("transform", event.transform.toString());
        }
        setZoomK(event.transform.k);
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    return () => { svg.on(".zoom", null); };
  }, []);

  const handleZoom = useCallback((factor) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300)
      .call(zoomRef.current.scaleBy, factor);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(500)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const handleZoneClick = useCallback((zone, e) => {
    e.stopPropagation();
    onSelect(zone);
    if (!svgRef.current || !zoomRef.current) return;
    const c = pt(zone.lat, zone.lon);
    if (!c) return;
    const targetK = Math.max(zoomK, 3);
    const tx = W / 2 - c[0] * targetK;
    const ty = H / 2 - c[1] * targetK;
    d3.select(svgRef.current).transition().duration(600)
      .call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(targetK));
  }, [zoomK, onSelect]);

  const visZones = filter === "ALL" ? zones : zones.filter(z => z.sev === filter);

  const visEvents = useMemo(() => {
    if (!showACLED || layers?.events === false) return [];
    let evts = acledEvents.slice(0, 1200);
    if (timeRange) {
      const cutoff = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      evts = evts.filter(e => new Date(e.date) >= cutoff);
    }
    return evts;
  }, [acledEvents, showACLED, timeRange, layers]);

  const visFires  = useMemo(() => layers?.fires  === false ? [] : fires.filter(f => f.frp > 8).slice(0, 1500), [fires, layers]);
  const visQuakes = useMemo(() => layers?.seismic === false ? [] : quakes.filter(q => q.mag >= 4.5).slice(0, 200), [quakes, layers]);
  const visBases  = useMemo(() => layers?.bases  === false ? [] : MILITARY_BASES, [layers]);

  const sk = 1 / Math.max(1, zoomK);

  const fireCircles = useMemo(() => visFires.map((f, i) => {
    const c = pt(f.lat, f.lon); if (!c) return null;
    const intensity = Math.min(1, f.frp / 120);
    const r = (1.2 + intensity * 2.8) * Math.max(0.5, sk);
    const g = Math.round(60 + (1 - intensity) * 80);
    return <circle key={"fire-" + i} cx={c[0]} cy={c[1]} r={r}
      fill={"rgba(255," + g + ",0," + (0.55 + intensity * 0.35) + ")"} filter="url(#fire-glow)"/>;
  }), [visFires, sk]);

  const quakeCircles = useMemo(() => visQuakes.map((q, i) => {
    const c = pt(q.lat, q.lon); if (!c) return null;
    const r  = Math.max(2, (q.mag - 3.5) * 1.8) * Math.max(0.5, sk);
    const al = Math.min(0.75, 0.3 + (q.mag - 4.5) * 0.1);
    return (
      <g key={"q-" + (q.id || i)}>
        <circle cx={c[0]} cy={c[1]} r={r * 2.2} fill="none" stroke="rgba(0,229,255,0.15)" strokeWidth={0.8 * sk}/>
        <circle cx={c[0]} cy={c[1]} r={r} fill={"rgba(0,229,255," + al + ")"} filter="url(#seismic-glow)"/>
      </g>
    );
  }), [visQuakes, sk]);

  return (
    <div style={{ position:"relative", width:"100%", height:"100%" }}>
      <svg ref={svgRef} viewBox={"0 0 " + W + " " + H}
        style={{ width:"100%", height:"100%", display:"block", cursor:"crosshair" }}>
        <defs>
          <radialGradient id="bg" cx="50%" cy="50%" r="70%">
            <stop offset="0%"   stopColor="#051a2e"/>
            <stop offset="100%" stopColor="#020c18"/>
          </radialGradient>
          <pattern id="gp" width="36" height="24" patternUnits="userSpaceOnUse">
            <path d="M36 0L0 0 0 24" fill="none" stroke="rgba(0,200,80,0.035)" strokeWidth="0.5"/>
          </pattern>
          {["CRITICAL","HIGH","MEDIUM","LOW"].map(k => (
            <filter key={k} id={"g" + k}>
              <feGaussianBlur stdDeviation="4" result="b"/>
              <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          ))}
          <filter id="ae"><feGaussianBlur stdDeviation="1.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="fire-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="seismic-glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
          <filter id="us-glow"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        </defs>
        <rect width={W} height={H} fill="url(#bg)"/>
        <rect width={W} height={H} fill="url(#gp)"/>
        <g ref={containerRef}>
          <path id="sphere"    fill="#061d35" stroke="rgba(0,200,80,0.12)" strokeWidth="0.8"/>
          <path id="graticule" fill="none"    stroke="rgba(0,200,80,0.05)" strokeWidth="0.4"/>
          <g id="land"/>
          <path id="borders" fill="none" stroke="rgba(0,200,80,0.18)" strokeWidth="0.5"/>
          {!ready && <text x={W/2} y={H/2} textAnchor="middle" fill="#1a3a1a" fontSize="11" fontFamily={MONO} letterSpacing="4">LOADING NATURAL EARTH...</text>}
          {fireCircles}
          {quakeCircles}
          {visEvents.map((e, i) => {
            const c = pt(e.lat, e.lon); if (!c) return null;
            const col = ACLED_COLORS[e.type] || "#636366";
            const r = Math.max(1, (e.fatalities > 20 ? 3.2 : e.fatalities > 5 ? 2.4 : 1.8) * sk);
            return <circle key={e.id || "ae-" + i} cx={c[0]} cy={c[1]} r={r} fill={col} opacity="0.55" filter="url(#ae)"/>;
          })}
          {visBases.map(base => {
            const c = pt(base.lat, base.lon); if (!c) return null;
            const col = BASE_COLORS[base.side] || "#4fc3f7";
            const s = 3.5 * Math.max(0.4, sk);
            const pts = c[0] + "," + (c[1]-s) + " " + (c[0]+s) + "," + c[1] + " " + c[0] + "," + (c[1]+s) + " " + (c[0]-s) + "," + c[1];
            return (
              <g key={base.id} style={{ cursor:"pointer" }}
                onMouseEnter={() => setHovBase(base.id)}
                onMouseLeave={() => setHovBase(null)}>
                <polygon points={pts} fill={col} opacity={hovBase === base.id ? 0.9 : 0.4}/>
                <polygon points={pts} fill="none" stroke={col} strokeWidth={0.6 * sk} opacity="0.6"/>
                {zoomK > 4 && <text x={c[0] + s + 2} y={c[1] + 3} fill={col} fontSize={6 * sk} fontFamily={MONO} opacity="0.85">{base.name}</text>}
              </g>
            );
          })}
          {layers?.zones !== false && visZones.map(z => {
            const c   = pt(z.lat, z.lon); if (!c) return null;
            const col = SEV_COLOR[z.sev] || "#ffd60a";
            const sel = selected?.id === z.id;
            const odd = pulse % 2 === 0;
            const r1  = (sel ? 25 : 19) * sk;
            const r2  = (sel ? 15 : 11) * sk;
            const r3  = (sel ? 5.5 : 4) * sk;
            const arm = (sel ? 12 : 9) * sk;
            const gap = (sel ? 5 : 4) * sk;
            return (
              <g key={z.id} style={{ cursor:"pointer" }} onClick={(e) => handleZoneClick(z, e)}>
                <circle cx={c[0]} cy={c[1]} r={r1} fill="none" stroke={col} strokeWidth={0.8*sk} opacity={odd ? 0.3 : 0.07} style={{ transition:"opacity 0.7s" }}/>
                <circle cx={c[0]} cy={c[1]} r={r2} fill="none" stroke={col} strokeWidth={1.3*sk} opacity={odd ? 0.65 : 0.22}/>
                <circle cx={c[0]} cy={c[1]} r={r3} fill={col} opacity="0.95" filter={"url(#g" + z.sev + ")"}/>
                <line x1={c[0]-arm} y1={c[1]}    x2={c[0]-gap} y2={c[1]}    stroke={col} strokeWidth={0.8*sk} opacity="0.4"/>
                <line x1={c[0]+gap} y1={c[1]}    x2={c[0]+arm} y2={c[1]}    stroke={col} strokeWidth={0.8*sk} opacity="0.4"/>
                <line x1={c[0]}    y1={c[1]-arm} x2={c[0]}    y2={c[1]-gap} stroke={col} strokeWidth={0.8*sk} opacity="0.4"/>
                <line x1={c[0]}    y1={c[1]+gap} x2={c[0]}    y2={c[1]+arm} stroke={col} strokeWidth={0.8*sk} opacity="0.4"/>
                {(sel || zoomK > 3) && (
                  <text x={c[0] + (sel ? 16 : 12) * sk} y={c[1] - 6 * sk}
                    fill={col} fontSize={8 * sk} fontFamily={MONO} fontWeight="600">
                    {z.name.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
          {usAdvisories.filter(a => a.lat && a.lon).map((a, i) => {
            const c = pt(a.lat, a.lon); if (!c) return null;
            const col = a.level === 4 ? "#ff2d55" : a.level === 3 ? "#ff9f0a" : "#ffd60a";
            const s = (a.stranded ? 5.5 : 4) * Math.max(0.4, sk);
            const pts = `${c[0]},${c[1]-s} ${c[0]+s},${c[1]} ${c[0]},${c[1]+s} ${c[0]-s},${c[1]}`;
            return (
              <g key={"us-"+i} style={{ cursor:"pointer" }}>
                <polygon points={pts} fill={col} opacity="0.85" filter="url(#us-glow)"/>
                <polygon points={pts} fill="none" stroke={col} strokeWidth={0.7*sk} opacity="0.9"/>
                <text x={c[0]} y={c[1]+0.35*s} textAnchor="middle" fill="#fff" fontSize={3.5*sk} fontFamily={MONO} fontWeight="700" opacity="0.9">US</text>
                {zoomK > 3 && (
                  <text x={c[0] + s + 2} y={c[1] + 3*sk} fill={col} fontSize={6*sk} fontFamily={MONO}>{a.country.toUpperCase()}</text>
                )}
              </g>
            );
          })}
        </g>
        {[[0,0,0],[W,0,90],[0,H,270],[W,H,180]].map(([x,y,r],i) => (
          <g key={i} transform={"translate(" + x + "," + y + ") rotate(" + r + ")"}>
            <line x1={8} y1={0} x2={30} y2={0} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
            <line x1={0} y1={8} x2={0}  y2={30} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
          </g>
        ))}
      </svg>
      <ZoomControls onZoom={handleZoom} onReset={handleReset}/>
      <LayerPanel layers={layers || {}} onToggle={onLayerToggle}/>
      {hovBase && (() => {
        const base = MILITARY_BASES.find(b => b.id === hovBase);
        if (!base) return null;
        const col = BASE_COLORS[base.side] || "#4fc3f7";
        return (
          <div style={{
            position:"absolute", top:10, left:10, zIndex:20,
            background:"rgba(2,12,24,0.95)", border:"1px solid " + col + "40",
            borderLeft:"2px solid " + col, padding:"5px 10px", fontFamily:MONO,
            pointerEvents:"none",
          }}>
            <div style={{ fontSize:9, color:col, fontWeight:700 }}>{base.name}</div>
            <div style={{ fontSize:7, color:"#3a3a3c", marginTop:2 }}>{base.country} · {base.type} · {base.side}</div>
          </div>
        );
      })()}
      <div style={{ position:"absolute", bottom:8, left:8, fontFamily:MONO, fontSize:7, color:"#1a3a1a", letterSpacing:1, pointerEvents:"none" }}>
        {visFires.length > 0 && "SAT FIRES: " + visFires.length + "  "}
        {visQuakes.length > 0 && "SEISMIC: " + visQuakes.length + "  "}
        ZOOM: {zoomK.toFixed(1) + "x  "}
        PROJ: NATURAL EARTH
      </div>
    </div>
  );
}
