import { useState, useEffect } from "react";

export const MONO = "'Share Tech Mono', monospace";
export const DISPLAY = "'Bebas Neue', sans-serif";

export function Spinner({ size = 10, color = "#00c864" }) {
  const [r, setR] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setR(p => (p + 24) % 360), 50);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `1.5px solid ${color}33`, borderTop: `1.5px solid ${color}`,
      borderRadius: "50%", transform: `rotate(${r}deg)`, flexShrink: 0,
    }}/>
  );
}

export function Dot({ size = 5, color = "#00c864", glow = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%", background: color,
      boxShadow: glow ? `0 0 6px ${color}` : "none", flexShrink: 0,
    }}/>
  );
}

export function SectionHead({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: MONO, fontSize: 8, color: "#2a4a2a",
      letterSpacing: 3, marginBottom: 8, ...style,
    }}>
      {children}
    </div>
  );
}

export function Loader({ msg }) {
  const [d, setD] = useState("");
  useEffect(() => {
    const t = setInterval(() => setD(p => p.length >= 3 ? "" : p + "."), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: "#2a4a2a", letterSpacing: 3 }}>
        {msg}{d}
      </span>
    </div>
  );
}

export function EmptyState({ msg }) {
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ opacity: 0.12 }}>
        <circle cx={18} cy={18} r={16} fill="none" stroke="#00c864" strokeWidth="1.5"/>
        <circle cx={18} cy={18} r={9}  fill="none" stroke="#00c864" strokeWidth="1"/>
        <circle cx={18} cy={18} r={3.5} fill="#00c864"/>
        <line x1={18} y1={2}  x2={18} y2={34} stroke="#00c864" strokeWidth="0.8"/>
        <line x1={2}  y1={18} x2={34} y2={18} stroke="#00c864" strokeWidth="0.8"/>
      </svg>
      <div style={{ fontFamily: MONO, fontSize: 9, color: "#2a2a2e", letterSpacing: 3 }}>{msg}</div>
    </div>
  );
}

export function Tag({ children, color = "#636366" }) {
  return (
    <span style={{
      fontSize: 7, padding: "2px 6px", borderRadius: 2,
      background: `${color}20`, color, fontFamily: MONO, letterSpacing: 1,
    }}>
      {children}
    </span>
  );
}

export function Divider({ color = "rgba(255,255,255,0.05)", margin = "10px 0" }) {
  return <div style={{ height: 1, background: color, margin }}/>;
}

// Mini sparkline using pure SVG — no chart library needed
export function Sparkline({ data = [], color = "#00c864", width = 80, height = 24 }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const step  = width / (data.length - 1);
  const pts   = data.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={width} height={height} style={{ overflow: "visible" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <polyline points={`0,${height} ${pts} ${width},${height}`}
        fill={`${color}18`} stroke="none"/>
    </svg>
  );
}
