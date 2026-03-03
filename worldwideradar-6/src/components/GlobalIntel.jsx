import { useMemo } from "react";
import { SEV_COLOR } from "../data/zones.js";
import { MONO } from "./UI.jsx";

function ArcGauge({ value, size }) {
  size = size || 90;
  const r  = size * 0.38;
  const cx = size / 2;
  const cy = size * 0.55;
  const PI  = Math.PI;
  const start = PI * 1.1;
  const end   = PI * 1.9;
  const pct   = Math.min(1, Math.max(0, value / 100));
  const angle = start + pct * (end - start);
  const arcD = (a1, a2) => {
    const x1 = cx + r * Math.cos(a1); const y1 = cy + r * Math.sin(a1);
    const x2 = cx + r * Math.cos(a2); const y2 = cy + r * Math.sin(a2);
    const lg = (a2 - a1) > Math.PI ? 1 : 0;
    return "M " + x1 + " " + y1 + " A " + r + " " + r + " 0 " + lg + " 1 " + x2 + " " + y2;
  };
  const nc = value > 75 ? "#ff453a" : value > 50 ? "#ff9f0a" : value > 25 ? "#ffd60a" : "#30d158";
  const lb = value > 75 ? "CRITICAL" : value > 50 ? "ELEVATED" : value > 25 ? "MODERATE" : "LOW";
  const nx = cx + (r - 8) * Math.cos(angle);
  const ny = cy + (r - 8) * Math.sin(angle);
  return (
    <svg width={size} height={size * 0.75} viewBox={"0 0 " + size + " " + (size * 0.75)}>
      <path d={arcD(start,end)}   fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" strokeLinecap="round"/>
      <path d={arcD(start,angle)} fill="none" stroke={nc} strokeWidth="5" strokeLinecap="round" opacity="0.9"/>
      <circle cx={cx} cy={cy} r={3} fill={nc}/>
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke={nc} strokeWidth="1.5" strokeLinecap="round"/>
      <text x={cx} y={cy - 10} textAnchor="middle" fill={nc} fontSize={size * 0.18} fontFamily="Share Tech Mono,monospace" fontWeight="700">{Math.round(value)}</text>
      <text x={cx} y={cy + 6}  textAnchor="middle" fill={nc} fontSize={size * 0.085} fontFamily="Share Tech Mono,monospace" letterSpacing="1">{lb}</text>
    </svg>
  );
}

export function GlobalTensionGauge({ zones, fireCount, quakeCount }) {
  const tension = useMemo(() => {
    if (!zones || !zones.length) return 0;
    const weights = { CRITICAL: 1.6, HIGH: 1.2, MEDIUM: 0.9, LOW: 0.6 };
    let sum = 0, wt = 0;
    zones.forEach(z => { const w = weights[z.sev] || 1; sum += (z.cai || 50) * w; wt += w; });
    let base = wt > 0 ? sum / wt : 50;
    if ((fireCount || 0) > 200) base = Math.min(100, base + 5);
    return Math.round(base);
  }, [zones, fireCount]);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:10, padding:"3px 12px", borderRight:"1px solid rgba(255,255,255,0.05)" }}>
      <div>
        <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:3, marginBottom:1, fontFamily:MONO }}>GLOBAL TENSION</div>
        <ArcGauge value={tension} size={62}/>
      </div>
      {(quakeCount || 0) > 0 && (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:2, fontFamily:MONO }}>SEISMIC</div>
          <div style={{ fontSize:14, color:"#00e5ff", fontWeight:700, fontFamily:MONO }}>{quakeCount}</div>
          <div style={{ fontSize:6, color:"#1a3a4a", fontFamily:MONO }}>M4.5+ 7D</div>
        </div>
      )}
      {(fireCount || 0) > 0 && (
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:2, fontFamily:MONO }}>SAT FIRES</div>
          <div style={{ fontSize:14, color:"#ff4500", fontWeight:700, fontFamily:MONO }}>{fireCount}</div>
          <div style={{ fontSize:6, color:"#3a1a0a", fontFamily:MONO }}>NASA FIRMS</div>
        </div>
      )}
    </div>
  );
}

export function PredictionMarketsPanel({ markets, loading, source }) {
  if (loading) return <div style={{ padding:16, textAlign:"center", fontFamily:MONO, fontSize:9, color:"#1a3a1a", letterSpacing:3 }}>SCANNING PREDICTION MARKETS...</div>;
  if (!markets || !markets.length) return <div style={{ padding:16, textAlign:"center", fontFamily:MONO, fontSize:9, color:"#1a3a1a" }}>NO ACTIVE MARKETS</div>;
  return (
    <div style={{ overflowY:"auto", flex:1 }}>
      <div style={{ padding:"8px 12px 6px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:3, fontFamily:MONO }}>POLYMARKET · CONFLICT ODDS</div>
        <div style={{ fontSize:7, padding:"1px 5px", borderRadius:2, fontFamily:MONO,
          background: source === "demo" ? "rgba(255,159,10,0.1)" : "rgba(0,200,80,0.1)",
          color:      source === "demo" ? "#ff9f0a" : "#00c864",
          border:     "1px solid " + (source === "demo" ? "rgba(255,159,10,0.2)" : "rgba(0,200,80,0.2)"),
        }}>{source === "demo" ? "DEMO" : "LIVE"}</div>
      </div>
      {markets.slice(0,12).map(m => {
        const pct = Math.round((m.prob || 0.5) * 100);
        const col = pct > 60 ? "#ff453a" : pct > 40 ? "#ff9f0a" : pct > 20 ? "#ffd60a" : "#30d158";
        const vol = (m.volume || 0) > 1e6 ? ((m.volume/1e6).toFixed(1)+"M") : (m.volume || 0) > 1000 ? ((m.volume/1000).toFixed(0)+"K") : String(m.volume||0);
        return (
          <div key={m.id} style={{ padding:"7px 12px", borderBottom:"1px solid rgba(255,255,255,0.03)", borderLeft:"2px solid "+col+"40" }}>
            <div style={{ fontSize:9, color:"#c7c7cc", lineHeight:1.3, marginBottom:4 }}>{m.question}</div>
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ flex:1, height:3, background:"rgba(255,255,255,0.05)", borderRadius:2 }}>
                <div style={{ width:pct+"%", height:"100%", background:col, borderRadius:2 }}/>
              </div>
              <span style={{ fontSize:10, color:col, fontWeight:700, fontFamily:MONO, minWidth:32 }}>{pct}%</span>
              <span style={{ fontSize:7, color:"#2a4a2a", fontFamily:MONO }}>VOL {vol}</span>
            </div>
          </div>
        );
      })}
      <div style={{ padding:"8px 12px", fontSize:7, color:"#1a2a1a", fontFamily:MONO }}>PREDICTION MARKETS ARE PROBABILISTIC · SOURCE: POLYMARKET</div>
    </div>
  );
}
