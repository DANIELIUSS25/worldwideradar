import { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import { ACLED_COLORS, SEV_COLOR } from "../data/zones.js";
import { W, H, PROJ, pt } from "../utils/geo.js";
import { MONO } from "./UI.jsx";

function useWorldMap(svgRef) {
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
        svg.select("#sphere").attr("d", path({ type: "Sphere" }));
        svg.select("#graticule").attr("d", path(d3.geoGraticule()()));
        svg.select("#land").selectAll("path").data(ctry.features).join("path").attr("d", path).attr("fill", "#0d2236").attr("stroke", "none");
        svg.select("#borders").attr("d", path(bord));
        setReady(true);
      } catch(_) {}
    })();
    return () => { alive = false; };
  }, []);
  return ready;
}

export default function WorldMap({ zones, acledEvents, selected, onSelect, filter, showACLED, timeRange }) {
  const svgRef = useRef(null);
  const ready  = useWorldMap(svgRef);
  const [pulse, setPulse] = useState(0);
  useEffect(() => { const t = setInterval(() => setPulse(p => p + 1), 900); return () => clearInterval(t); }, []);

  const visZones  = filter === "ALL" ? zones : zones.filter(z => z.sev === filter);
  const visEvents = useMemo(() => {
    if (!showACLED) return [];
    let evts = acledEvents.slice(0, 800);
    if (timeRange) {
      const cutoff = new Date(Date.now() - timeRange * 24 * 60 * 60 * 1000);
      evts = evts.filter(e => new Date(e.date) >= cutoff);
    }
    return evts;
  }, [acledEvents, showACLED, timeRange]);

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "100%", display: "block" }}>
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#051a2e"/>
          <stop offset="100%" stopColor="#020c18"/>
        </radialGradient>
        <pattern id="gp" width="36" height="24" patternUnits="userSpaceOnUse">
          <path d="M36 0L0 0 0 24" fill="none" stroke="rgba(0,200,80,0.035)" strokeWidth="0.5"/>
        </pattern>
        {["CRITICAL","HIGH","MEDIUM","LOW"].map(k => (
          <filter key={k} id={`g${k}`}>
            <feGaussianBlur stdDeviation="4" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        ))}
        <filter id="ae">
          <feGaussianBlur stdDeviation="1.5" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <rect width={W} height={H} fill="url(#bg)"/>
      <rect width={W} height={H} fill="url(#gp)"/>
      <path id="sphere"    fill="#061d35" stroke="rgba(0,200,80,0.12)" strokeWidth="0.8"/>
      <path id="graticule" fill="none"    stroke="rgba(0,200,80,0.05)" strokeWidth="0.4"/>
      <g id="land"/>
      <path id="borders" fill="none" stroke="rgba(0,200,80,0.18)" strokeWidth="0.5"/>
      {!ready && (
        <text x={W/2} y={H/2} textAnchor="middle" fill="#1a3a1a" fontSize="11"
          fontFamily={MONO} letterSpacing="4">LOADING NATURAL EARTH...</text>
      )}
      {visEvents.map((e, i) => {
        const c   = pt(e.lat, e.lon); if (!c) return null;
        const col = ACLED_COLORS[e.type] || "#636366";
        const r   = e.fatalities > 20 ? 3.2 : e.fatalities > 5 ? 2.4 : 1.8;
        return <circle key={e.id || i} cx={c[0]} cy={c[1]} r={r} fill={col} opacity="0.5" filter="url(#ae)"/>;
      })}
      {visZones.map(z => {
        const c   = pt(z.lat, z.lon); if (!c) return null;
        const col = SEV_COLOR[z.sev] || "#ffd60a";
        const sel = selected?.id === z.id;
        const odd = pulse % 2 === 0;
        return (
          <g key={z.id} style={{ cursor: "pointer" }} onClick={() => onSelect(z)}>
            <circle cx={c[0]} cy={c[1]} r={sel ? 25 : 19} fill="none" stroke={col} strokeWidth="0.8" opacity={odd ? 0.3 : 0.07} style={{ transition: "opacity 0.7s" }}/>
            <circle cx={c[0]} cy={c[1]} r={sel ? 15 : 11} fill="none" stroke={col} strokeWidth="1.3" opacity={odd ? 0.65 : 0.22}/>
            <circle cx={c[0]} cy={c[1]} r={sel ? 5.5 : 4} fill={col} opacity="0.95" filter={`url(#g${z.sev})`}/>
            <line x1={c[0]-12} y1={c[1]}   x2={c[0]-6}  y2={c[1]}   stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]+6}  y1={c[1]}   x2={c[0]+12} y2={c[1]}   stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]}    y1={c[1]-12} x2={c[0]}    y2={c[1]-6} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]}    y1={c[1]+6}  x2={c[0]}    y2={c[1]+12} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            {sel && <text x={c[0]+16} y={c[1]-8} fill={col} fontSize="9" fontFamily={MONO} fontWeight="600">{z.name.toUpperCase()}</text>}
          </g>
        );
      })}
      {[[0,0,0],[W,0,90],[0,H,270],[W,H,180]].map(([x,y,r],i) => (
        <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
          <line x1={8} y1={0} x2={30} y2={0} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
          <line x1={0} y1={8} x2={0}  y2={30} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
        </g>
      ))}
      <text x={10} y={H-6} fill="#1a3a1a" fontSize="7.5" fontFamily={MONO}>
        PROJ: NATURAL EARTH · GDELT GEO + RELIEFWEB · WORLDWIDERADAR.COM
      </text>
    </svg>
  );
}
