import { useState } from "react";
import { ZONES, SEV_COLOR } from "../data/zones.js";
import { MONO, DISPLAY, SectionHead } from "./UI.jsx";
import { caiColor, deltaStr, deltaColor, exportCSV } from "../utils/geo.js";

// ── CONFLICT ACTIVITY INDEX PANEL ─────────────────────────────────────────────
export function ConflictActivityIndex({ zones, onSelect }) {
  const sorted = [...zones].sort((a, b) => b.cai - a.cai);
  const globalCAI = Math.round(sorted.reduce((s, z) => s + z.cai, 0) / sorted.length);

  return (
    <div style={{ padding: "10px 14px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <SectionHead style={{ margin: 0 }}>CONFLICT ACTIVITY INDEX</SectionHead>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: DISPLAY, fontSize: 28, color: caiColor(globalCAI), lineHeight: 1 }}>{globalCAI}</div>
          <div style={{ fontFamily: MONO, fontSize: 7, color: "#2a4a2a", letterSpacing: 1 }}>GLOBAL AVG</div>
        </div>
      </div>
      <div style={{ height: 1, background: "rgba(255,255,255,0.04)", marginBottom: 8 }}/>
      {sorted.map(z => {
        const col = caiColor(z.cai);
        return (
          <div key={z.id}
            onClick={() => onSelect(z)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.03)" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#8e8e93", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{z.name}</div>
            <div style={{ width: 60, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, flexShrink: 0, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${z.cai}%`, background: col, borderRadius: 2 }}/>
            </div>
            <div style={{ fontFamily: DISPLAY, fontSize: 16, color: col, width: 30, textAlign: "right", flexShrink: 0 }}>{z.cai}</div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: deltaColor(z.delta), width: 36, textAlign: "right", flexShrink: 0 }}>{deltaStr(z.delta)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── TIME SLIDER ────────────────────────────────────────────────────────────────
export function TimeSlider({ value, onChange }) {
  const OPTIONS = [
    { label: "72H",   days: 3   },
    { label: "7D",    days: 7   },
    { label: "14D",   days: 14  },
    { label: "30D",   days: 30  },
    { label: "ALL",   days: null },
  ];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontFamily: MONO, fontSize: 7, color: "#2a4a2a", letterSpacing: 2, marginRight: 4 }}>EVENTS:</span>
      {OPTIONS.map(o => {
        const on = value === o.days;
        return (
          <button key={o.label} onClick={() => onChange(o.days)} style={{
            padding: "2px 7px", fontSize: 7, letterSpacing: 1, cursor: "pointer", borderRadius: 2,
            border: `1px solid ${on ? "#ff9f0a" : "rgba(255,255,255,0.06)"}`,
            background: on ? "rgba(255,159,10,0.12)" : "transparent",
            color: on ? "#ff9f0a" : "#3a3a3c",
            fontFamily: MONO,
          }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── WATCHLIST PANEL ────────────────────────────────────────────────────────────
export function WatchlistPanel({ watchlist, onSelect, onRemove }) {
  if (watchlist.length === 0) {
    return (
      <div style={{ padding: "14px 16px" }}>
        <SectionHead>WATCHLIST</SectionHead>
        <div style={{ fontFamily: MONO, fontSize: 9, color: "#2a4a2a", lineHeight: 1.8 }}>
          No zones monitored.<br/>
          Click ☆ WATCH on any zone to track it here.
        </div>
      </div>
    );
  }
  const watchedZones = ZONES.filter(z => watchlist.includes(z.id));
  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "14px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <SectionHead style={{ margin: 0 }}>WATCHLIST</SectionHead>
        <span style={{ fontFamily: MONO, fontSize: 7, color: "#3a3a3c" }}>{watchedZones.length} zones</span>
      </div>
      {watchedZones.map(z => {
        const col = SEV_COLOR[z.sev] || "#ffd60a";
        return (
          <div key={z.id} style={{ padding: "9px 10px", marginBottom: 4, borderLeft: `3px solid ${col}66`, background: "rgba(255,255,255,0.02)", borderRadius: "0 4px 4px 0", cursor: "pointer" }}
            onClick={() => onSelect(z)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#d1d1d6" }}>{z.name}</span>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontFamily: MONO, fontSize: 7, padding: "1px 5px", borderRadius: 2, background: `${col}20`, color: col }}>{z.sev}</span>
                <button onClick={e => { e.stopPropagation(); onRemove(z.id); }} style={{ background: "none", border: "none", color: "#3a3a3c", cursor: "pointer", fontSize: 12, padding: "0 2px" }}>×</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: "#3a3a3c" }}>{z.type}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: caiColor(z.cai) }}>CAI {z.cai} <span style={{ color: deltaColor(z.delta) }}>{deltaStr(z.delta)}</span></span>
            </div>
          </div>
        );
      })}
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <button
          onClick={() => exportCSV(watchedZones.map(z => ({ name: z.name, region: z.region, severity: z.sev, cai: z.cai, delta: z.delta, type: z.type })), "wwr-watchlist.csv")}
          style={{ width: "100%", padding: "6px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#636366", fontFamily: MONO, fontSize: 8, letterSpacing: 2, cursor: "pointer", borderRadius: 3 }}
        >
          ↓ EXPORT WATCHLIST CSV
        </button>
      </div>
    </div>
  );
}
