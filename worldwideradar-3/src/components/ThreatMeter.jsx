import { useMemo } from "react";
import { ZONES, SEV_COLOR, getGlobalThreatIndex } from "../data/zones.js";
import { MONO, DISPLAY } from "./UI.jsx";

function GaugeMeter({ value, size }) {
  size = size || 120;
  const cx = size / 2, cy = size / 2, r = size * 0.38, sw = size * 0.065;
  const SA = -210 * (Math.PI / 180);
  const TA = 240 * (Math.PI / 180);
  const EA = SA + TA * (value / 100);
  function arc(s, e, rd) {
    const x1 = cx + rd * Math.cos(s), y1 = cy + rd * Math.sin(s);
    const x2 = cx + rd * Math.cos(e), y2 = cy + rd * Math.sin(e);
    return `M ${x1} ${y1} A ${rd} ${rd} 0 ${e - s > Math.PI ? 1 : 0} 1 ${x2} ${y2}`;
  }
  const color = value >= 75 ? "#ff2d55" : value >= 50 ? "#ff9f0a" : value >= 30 ? "#ffd60a" : "#30d158";
  const label = value >= 75 ? "CRITICAL" : value >= 50 ? "ELEVATED" : value >= 30 ? "MODERATE" : "NOMINAL";
  return (
    <div style={{ position: "relative", width: size, height: size * 0.7 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <path d={arc(SA, SA + TA, r)} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={sw} strokeLinecap="round"/>
        <path d={arc(SA, EA, r)} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 ${size * 0.04}px ${color})`, transition: "all 0.8s ease" }}/>
        <text x={cx} y={cy - size * 0.03} textAnchor="middle" fill={color} fontSize={size * 0.22}
          fontFamily="'Bebas Neue', sans-serif" letterSpacing="2">{value}</text>
        <text x={cx} y={cy + size * 0.12} textAnchor="middle" fill={color} fontSize={size * 0.07}
          fontFamily="'Share Tech Mono', monospace" letterSpacing="3" opacity="0.8">{label}</text>
      </svg>
    </div>
  );
}

export default function ThreatMeter({ compact }) {
  const gti = useMemo(() => getGlobalThreatIndex(ZONES), []);
  const criticalCount = ZONES.filter(z => z.sev === "CRITICAL").length;
  const highCount = ZONES.filter(z => z.sev === "HIGH").length;
  const escalating = ZONES.filter(z => z.delta > 5).sort((a, b) => b.delta - a.delta).slice(0, 3);
  const color = gti >= 75 ? "#ff2d55" : gti >= 50 ? "#ff9f0a" : gti >= 30 ? "#ffd60a" : "#30d158";

  if (compact) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 3 }}>GLOBAL GTI</div>
          <div style={{ fontSize: 20, color, fontWeight: 700, letterSpacing: 1, lineHeight: 1 }}>{gti}</div>
        </div>
        <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.08)" }}/>
        <div>
          <div style={{ fontSize: 7, color: "#ff2d55" }}>{criticalCount} CRITICAL</div>
          <div style={{ fontSize: 7, color: "#ff9f0a", marginTop: 2 }}>{highCount} HIGH</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "14px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 4, marginBottom: 10, display: "flex", justifyContent: "space-between" }}>
        <span>GLOBAL THREAT INDEX</span>
        <span style={{ color: "#3a3a3c" }}>COMPOSITE</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 6 }}>
        <GaugeMeter value={gti}/>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 10 }}>
        {[["CRITICAL", criticalCount, "#ff2d55"], ["HIGH", highCount, "#ff9f0a"], ["ZONES", ZONES.length, "#3a3a3c"]].map(([l, n, c]) => (
          <div key={l} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 3, padding: "5px 4px", textAlign: "center" }}>
            <div style={{ fontSize: 14, color: c, fontWeight: 700 }}>{n}</div>
            <div style={{ fontSize: 6, color: "#1a3a1a", letterSpacing: 2, marginTop: 1 }}>{l}</div>
          </div>
        ))}
      </div>
      {escalating.length > 0 && (
        <>
          <div style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 3, marginBottom: 5 }}>TOP ESCALATING</div>
          {escalating.map(z => (
            <div key={z.id} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
              <span style={{ fontSize: 8, color: "#d1d1d6" }}>{z.name}</span>
              <span style={{ fontSize: 8, color: "#ff2d55", fontWeight: 700 }}>+{z.delta}%</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
