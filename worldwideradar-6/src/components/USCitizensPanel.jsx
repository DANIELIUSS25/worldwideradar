import { useState } from "react";
import { MONO } from "./UI.jsx";

const LEVEL_COLOR = { 4: "#ff2d55", 3: "#ff9f0a", 2: "#ffd60a", 1: "#30d158" };
const LEVEL_LABEL = { 4: "DO NOT TRAVEL", 3: "RECONSIDER", 2: "EXERCISE CAUTION", 1: "NORMAL" };

function LevelBadge({ level }) {
  const c = LEVEL_COLOR[level] || "#3a3a3c";
  return (
    <span style={{ fontSize: 7, padding: "2px 5px", borderRadius: 2, background: `${c}20`, color: c, letterSpacing: 1, fontFamily: MONO, whiteSpace: "nowrap" }}>
      LVL {level} · {LEVEL_LABEL[level]}
    </span>
  );
}

export default function USCitizensPanel({ advisories, liveAlerts, stats, loading }) {
  const [subTab, setSubTab] = useState("STRANDED");

  if (loading) return (
    <div style={{ padding: 16, textAlign: "center" }}>
      <div style={{ fontSize: 8, color: "#1a3a1a", letterSpacing: 3 }}>LOADING STATE DEPT DATA...</div>
    </div>
  );

  const stranded  = advisories.filter(a => a.stranded).sort((a,b) => b.level - a.level);
  const detained  = advisories.filter(a => !a.stranded).sort((a,b) => b.level - a.level);
  const all       = [...advisories].sort((a,b) => b.level - a.level);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>

      {/* Stats bar */}
      <div style={{ padding: "10px 12px", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0, background: "rgba(255,45,85,0.04)" }}>
        <div style={{ fontSize: 7, color: "#ff2d55", letterSpacing: 3, marginBottom: 7, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🇺🇸</span> US CITIZENS ABROAD · STATE DEPT
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 5 }}>
          {[
            { label: "LVL 4",      value: stats?.level4,        color: "#ff2d55" },
            { label: "STRANDED",   value: stats?.stranded,      color: "#ff9f0a" },
            { label: "DETAINED",   value: stats?.detained,      color: "#ff2d55" },
            { label: "TOTAL EST",  value: stats?.totalStranded ? `${(stats.totalStranded/1000).toFixed(0)}K+` : "—", color: "#ffd60a" },
          ].map(s => (
            <div key={s.label} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 3, padding: "5px 4px", textAlign: "center" }}>
              <div style={{ fontSize: 13, color: s.color, fontWeight: 700, lineHeight: 1.1 }}>{s.value ?? "—"}</div>
              <div style={{ fontSize: 6, color: "#1a3a1a", letterSpacing: 1.5, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sub tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[
          { id: "STRANDED", label: `STRANDED (${stranded.length})` },
          { id: "DETAINED", label: `DETAINED (${detained.length})` },
          { id: "ALL",      label: `ALL ADVISORIES` },
          { id: "ALERTS",   label: `LIVE ALERTS` },
        ].map(t => (
          <button key={t.id} onClick={() => setSubTab(t.id)} style={{
            flex: 1, padding: "6px 2px", fontSize: 6.5, letterSpacing: 0.8, cursor: "pointer",
            border: "none", borderBottom: `2px solid ${subTab === t.id ? "#ff2d55" : "transparent"}`,
            background: "transparent", color: subTab === t.id ? "#ff2d55" : "#3a3a3c",
            fontFamily: MONO, transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {subTab === "STRANDED" && (
          <>
            <div style={{ padding: "8px 12px 4px", fontSize: 7, color: "#3a3a3c", letterSpacing: 2 }}>
              COUNTRIES WITH STRANDED US CITIZENS
            </div>
            {stranded.map((a, i) => (
              <AdvisoryRow key={i} advisory={a}/>
            ))}
          </>
        )}

        {subTab === "DETAINED" && (
          <>
            <div style={{ padding: "8px 12px 4px", fontSize: 7, color: "#3a3a3c", letterSpacing: 2 }}>
              WRONGFUL DETENTION / HOSTAGE SITUATIONS
            </div>
            {detained.filter(a => a.count && a.count !== "Unknown").map((a, i) => (
              <AdvisoryRow key={i} advisory={a}/>
            ))}
            <div style={{ padding: "12px", fontSize: 7, color: "#3a3a3c", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
              Source: US Hostage Recovery Fusion Cell · State Dept SRCI · Published figures only.
              Actual numbers may be higher. Contact <span style={{ color: "#0a84ff" }}>1-888-407-4747</span> for emergencies.
            </div>
          </>
        )}

        {subTab === "ALL" && (
          <>
            <div style={{ padding: "8px 12px 4px", fontSize: 7, color: "#3a3a3c", letterSpacing: 2 }}>
              ALL ACTIVE TRAVEL ADVISORIES — LVL 3+
            </div>
            {all.map((a, i) => (
              <AdvisoryRow key={i} advisory={a}/>
            ))}
          </>
        )}

        {subTab === "ALERTS" && (
          <>
            <div style={{ padding: "8px 12px 4px", fontSize: 7, color: "#3a3a3c", letterSpacing: 2 }}>
              LIVE STATE DEPT ALERTS
            </div>
            {liveAlerts.length === 0 ? (
              <div style={{ padding: "16px 12px", fontSize: 8, color: "#3a3a3c" }}>
                No live alerts fetched. State Dept RSS may be unavailable.
              </div>
            ) : liveAlerts.map((a, i) => (
              <div key={i} style={{ padding: "9px 12px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ fontSize: 9, color: "#d1d1d6", marginBottom: 3 }}>{a.title}</div>
                <div style={{ fontSize: 7, color: "#3a3a3c", lineHeight: 1.5 }}>{(a.summary||"").slice(0, 160)}…</div>
                {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 7, color: "#0a84ff", marginTop: 3, display: "block" }}>→ STATE.GOV</a>}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
        <div style={{ fontSize: 6.5, color: "#1a3a1a", lineHeight: 1.5 }}>
          Data: US State Dept travel.state.gov · SRCI · HRFC · Updated every 30 min
        </div>
      </div>
    </div>
  );
}

function AdvisoryRow({ advisory: a }) {
  const [open, setOpen] = useState(false);
  const c = LEVEL_COLOR[a.level] || "#3a3a3c";
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.04)", cursor: "pointer" }} onClick={() => setOpen(o => !o)}>
      <div style={{ padding: "9px 12px", borderLeft: `3px solid ${c}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: "#d1d1d6", fontWeight: 600 }}>{a.country}</span>
            {a.stranded && <span style={{ fontSize: 6, padding: "1px 4px", borderRadius: 2, background: "rgba(255,159,10,0.2)", color: "#ff9f0a" }}>STRANDED</span>}
          </div>
          <LevelBadge level={a.level}/>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 7.5, color: "#3a3a3c" }}>{a.count && a.count !== "Unknown" ? `~${a.count} affected` : a.stranded ? "Count unknown" : "Advisory only"}</span>
          <span style={{ fontSize: 7, color: "#1a3a1a" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>
      {open && (
        <div style={{ padding: "0 12px 10px 15px", background: "rgba(0,0,0,0.2)" }}>
          <div style={{ fontSize: 7.5, color: "#8a8a8e", lineHeight: 1.6, marginBottom: 6 }}>{a.summary}</div>
          <div style={{ fontSize: 6.5, color: "#3a3a3c", marginBottom: 4 }}>Updated: {a.lastUpdate}</div>
          {a.url && <a href={a.url} target="_blank" rel="noreferrer" style={{ fontSize: 7, color: "#0a84ff" }}>→ Full Advisory on STATE.GOV</a>}
        </div>
      )}
    </div>
  );
}
