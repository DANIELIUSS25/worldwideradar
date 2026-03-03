import { useState, useEffect } from "react";
import { SEV_COLOR, ACLED_COLORS, TREND_COLOR } from "../data/zones.js";
import { MONO, DISPLAY, SectionHead, Spinner, Sparkline, Divider, Tag } from "./UI.jsx";
import { useWiki, useThreatScore } from "../hooks/index.js";
import { timeAgo, caiColor, deltaStr, deltaColor, exportCSV } from "../utils/geo.js";
import { useNavigate } from "react-router-dom";

// Fake historical CAI for sparkline — based on zone baseline
function generateHistory(baseCai, weeks = 12) {
  const out = [];
  let v = baseCai - 10;
  for (let i = 0; i < weeks; i++) {
    v = Math.max(10, Math.min(99, v + (Math.random() - 0.45) * 8));
    out.push(Math.round(v));
  }
  out[out.length - 1] = baseCai;
  return out;
}

function Timeline({ zone }) {
  // Static timeline events per zone — this would come from real data in production
  const events = [
    { date: "2024 Q4", event: "Latest escalation phase", type: "ESCALATION" },
    { date: "2024 Q2", event: "Ceasefire negotiations", type: "DIPLOMATIC" },
    { date: "2024 Q1", event: "Major offensive operations", type: "MILITARY" },
    { date: "2023 Q4", event: "International response", type: "DIPLOMATIC" },
    { date: "2023 Q3", event: "Conflict outbreak / intensification", type: "ESCALATION" },
  ];
  const typeColor = { ESCALATION: "#ff2d55", MILITARY: "#ff9f0a", DIPLOMATIC: "#0a84ff", HUMANITARIAN: "#ffd60a" };
  return (
    <div>
      {events.map((e, i) => (
        <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: typeColor[e.type] || "#636366", marginTop: 2 }}/>
            {i < events.length - 1 && <div style={{ width: 1, flex: 1, background: "rgba(255,255,255,0.06)", marginTop: 3, minHeight: 16 }}/>}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 7, color: "#3a3a3c", letterSpacing: 1, marginBottom: 2 }}>{e.date} · {e.type}</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#8e8e93" }}>{e.event}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function SourceCitations({ zone }) {
  const sources = [
    { name: "GDELT GEO", desc: "GPS conflict events from 65,000+ news sources", url: "https://gdeltproject.org", badge: "LIVE" },
    { name: "ReliefWeb / OCHA", desc: "UN humanitarian coordination reports", url: `https://reliefweb.int/updates?search=${encodeURIComponent(zone.name)}`, badge: "LIVE" },
    { name: "GDELT Artlist", desc: "Global news article index, 15-min updates", url: `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(zone.kw)}&mode=artlist&format=html`, badge: "LIVE" },
    { name: "Wikipedia", desc: "Background and historical context", url: `https://en.wikipedia.org/wiki/${zone.wiki}`, badge: "REF" },
    { name: "Crisis Group", desc: "Expert conflict analysis and risk assessments", url: "https://www.crisisgroup.org/crisiswatch", badge: "REF" },
    { name: "ISW Assessment", desc: "Daily battlefield and operational updates", url: "https://www.understandingwar.org", badge: "REF" },
    { name: "UN OCHA", desc: "Humanitarian situation reports", url: `https://reliefweb.int/updates?search=${encodeURIComponent(zone.name)}`, badge: "REF" },
  ];
  return (
    <div>
      {sources.map(s => (
        <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 9px", marginBottom: 3, borderRadius: 3, background: "rgba(255,255,255,0.02)", textDecoration: "none", transition: "background 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,200,80,0.06)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        >
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: "#c7c7cc", marginBottom: 1 }}>{s.name}</div>
            <div style={{ fontFamily: MONO, fontSize: 7, color: "#3a3a3c" }}>{s.desc}</div>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span style={{ fontFamily: MONO, fontSize: 7, padding: "1px 5px", borderRadius: 2, background: s.badge === "LIVE" ? "rgba(0,200,80,0.15)" : "rgba(255,255,255,0.05)", color: s.badge === "LIVE" ? "#00c864" : "#636366" }}>{s.badge}</span>
            <span style={{ color: "#3a3a3c", fontSize: 10 }}>↗</span>
          </div>
        </a>
      ))}
    </div>
  );
}

export default function IntelligenceDrawer({ zone, acledEvents, gdeltArticles, signals, onClose, isWatched, onToggleWatch }) {
  const [activeTab, setActiveTab] = useState("SUMMARY");
  const navigate = useNavigate();
  const wiki     = useWiki(zone?.wiki);
  const { score, loading: scoreLoading, refresh } = useThreatScore(
    zone, acledEvents, gdeltArticles, signals, wiki?.extract || ""
  );

  if (!zone) return null;

  const col     = SEV_COLOR[zone.sev] || "#ffd60a";
  const history = generateHistory(zone.cai);
  const q       = zone.name.split(/[\s–-]/)[0].toLowerCase();
  const zEvents = acledEvents.filter(e => (e.country || "").toLowerCase().includes(q));

  const tabs = [
    { id: "SUMMARY",  label: "SUMMARY"  },
    { id: "THREAT",   label: "AI THREAT" },
    { id: "TIMELINE", label: "TIMELINE"  },
    { id: "SOURCES",  label: "SOURCES"  },
  ];

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 900 }}/>

      {/* Drawer */}
      <div style={{
        position: "fixed", right: 0, top: 0, bottom: 0, width: 420,
        background: "#040e1a", borderLeft: `1px solid ${col}33`,
        zIndex: 901, display: "flex", flexDirection: "column",
        boxShadow: `-20px 0 60px rgba(0,0,0,0.8)`,
      }}>
        {/* Header */}
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${col}22`, flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 7, color: "#2a4a2a", letterSpacing: 3, marginBottom: 4 }}>
                INTELLIGENCE BRIEF · {new Date().toUTCString().slice(0, 25).toUpperCase()}
              </div>
              <div style={{ fontFamily: DISPLAY, fontSize: 26, color: col, letterSpacing: 2, lineHeight: 1 }}>
                {zone.name.toUpperCase()}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {/* Watchlist button */}
              <button onClick={() => onToggleWatch(zone.id)} style={{
                background: isWatched ? `${col}20` : "rgba(255,255,255,0.04)",
                border: `1px solid ${isWatched ? col : "rgba(255,255,255,0.1)"}`,
                color: isWatched ? col : "#3a3a3c",
                fontFamily: MONO, fontSize: 8, padding: "4px 8px", borderRadius: 3, cursor: "pointer", letterSpacing: 1,
              }}>
                {isWatched ? "★ WATCHING" : "☆ WATCH"}
              </button>
              <button onClick={onClose} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", color: "#636366", width: 28, height: 28, borderRadius: 3, cursor: "pointer", fontSize: 14 }}>×</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
            <Tag color={col}>{zone.sev}</Tag>
            <Tag>{zone.type}</Tag>
            <Tag>{zone.region}</Tag>
          </div>
          {/* CAI Score strip */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", background: "rgba(255,255,255,0.025)", borderRadius: 4 }}>
            <div>
              <div style={{ fontFamily: MONO, fontSize: 7, color: "#2a4a2a", letterSpacing: 2, marginBottom: 2 }}>CONFLICT ACTIVITY INDEX</div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                <span style={{ fontFamily: DISPLAY, fontSize: 32, color: caiColor(zone.cai), lineHeight: 1 }}>{zone.cai}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: deltaColor(zone.delta) }}>{deltaStr(zone.delta)} W/W</span>
              </div>
            </div>
            <Sparkline data={history} color={caiColor(zone.cai)} width={100} height={32}/>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: "8px 4px", fontSize: 7, letterSpacing: 1, cursor: "pointer",
              border: "none", borderBottom: `2px solid ${activeTab === t.id ? col : "transparent"}`,
              background: "transparent", color: activeTab === t.id ? col : "#3a3a3c",
              fontFamily: MONO, transition: "all 0.12s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>

          {activeTab === "SUMMARY" && (
            <div>
              <SectionHead>EXECUTIVE SUMMARY</SectionHead>
              {wiki ? (
                <>
                  {wiki.thumbnail?.source && (
                    <img src={wiki.thumbnail.source} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 3, marginBottom: 10, opacity: 0.75 }}/>
                  )}
                  <div style={{ fontFamily: MONO, fontSize: 10, color: "#8e8e93", lineHeight: 1.8, marginBottom: 14 }}>
                    {wiki.extract?.slice(0, 500)}...
                  </div>
                </>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#2a4a2a", marginBottom: 14 }}>Loading context...</div>
              )}
              <Divider/>
              <SectionHead>SEVERITY INDEX</SectionHead>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 }}>
                {[
                  { l: "ACTIVITY", v: zone.cai, color: caiColor(zone.cai) },
                  { l: "WEEKLY Δ", v: deltaStr(zone.delta), color: deltaColor(zone.delta) },
                  { l: "EVENTS", v: zEvents.length || "—", color: "#ff9f0a" },
                ].map(({ l, v, color }) => (
                  <div key={l} style={{ background: "rgba(255,255,255,0.025)", padding: "8px 10px", borderRadius: 3 }}>
                    <div style={{ fontFamily: MONO, fontSize: 7, color: "#2a4a2a", letterSpacing: 2, marginBottom: 3 }}>{l}</div>
                    <div style={{ fontFamily: DISPLAY, fontSize: 22, color, lineHeight: 1 }}>{v}</div>
                  </div>
                ))}
              </div>
              <Divider/>
              <div style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
                <button
                  onClick={() => navigate(`/region/${zone.slug}`)}
                  style={{ flex: 1, padding: "8px 10px", background: `${col}18`, border: `1px solid ${col}44`, color: col, fontFamily: MONO, fontSize: 8, letterSpacing: 2, cursor: "pointer", borderRadius: 3 }}
                >
                  → FULL REGION BRIEF
                </button>
                <button
                  onClick={() => exportCSV(zEvents, `wwr-${zone.name.replace(/\s/g,"-")}-events.csv`)}
                  style={{ padding: "8px 10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", color: "#636366", fontFamily: MONO, fontSize: 8, letterSpacing: 2, cursor: "pointer", borderRadius: 3 }}
                >
                  ↓ EXPORT CSV
                </button>
              </div>
            </div>
          )}

          {activeTab === "THREAT" && (
            <div>
              <SectionHead>AI THREAT ASSESSMENT · CLAUDE ENGINE</SectionHead>
              {scoreLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "24px 0" }}>
                  <Spinner size={14} color="#00c864"/>
                  <span style={{ fontFamily: MONO, fontSize: 10, color: "#2a4a2a", letterSpacing: 2 }}>CLAUDE ANALYZING ALL FEEDS...</span>
                </div>
              ) : score ? (
                <>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 8 }}>
                    <div style={{ fontFamily: DISPLAY, fontSize: 72, lineHeight: 1, color: score.score >= 75 ? "#ff2d55" : score.score >= 50 ? "#ff9f0a" : score.score >= 25 ? "#ffd60a" : "#30d158" }}>
                      {score.score}
                    </div>
                    <div style={{ paddingBottom: 12 }}>
                      <div style={{ fontFamily: MONO, fontSize: 11, color: TREND_COLOR[score.trend] || "#ffd60a", fontWeight: 700, marginBottom: 2 }}>{score.trend}</div>
                      <div style={{ fontFamily: MONO, fontSize: 8, color: "#3a3a3c" }}>/100 · {score.source === "claude" ? "CLAUDE AI" : "DEMO"}</div>
                    </div>
                    <button onClick={refresh} style={{ marginLeft: "auto", marginBottom: 12, background: "none", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", fontFamily: MONO, fontSize: 8, color: "#3a3a3c", padding: "4px 8px", borderRadius: 3 }}>↺ REFRESH</button>
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", marginBottom: 10 }}>
                    <div style={{ height: "100%", width: `${score.score}%`, background: score.score >= 75 ? "linear-gradient(90deg,#ff9f0a,#ff2d55)" : "linear-gradient(90deg,#30d158,#ffd60a)", borderRadius: 2, transition: "width 1s" }}/>
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 11, color: "#c7c7cc", fontStyle: "italic", lineHeight: 1.5, marginBottom: 12 }}>"{score.oneLiner}"</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginBottom: 12 }}>
                    {[
                      { l: "CIVILIAN RISK", v: score.civilianRisk, c: score.civilianRisk === "EXTREME" ? "#ff2d55" : score.civilianRisk === "HIGH" ? "#ff9f0a" : "#ffd60a" },
                      { l: "SPILLOVER", v: score.regionalSpillover, c: score.regionalSpillover === "HIGH" ? "#ff9f0a" : "#ffd60a" },
                      { l: "RISK LEVEL", v: score.riskLevel, c: SEV_COLOR[score.riskLevel] || "#ffd60a" },
                      { l: "TREND", v: score.trend, c: TREND_COLOR[score.trend] || "#ffd60a" },
                    ].map(({ l, v, c }) => (
                      <div key={l} style={{ background: "rgba(255,255,255,0.025)", padding: "7px 9px", borderRadius: 3 }}>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: "#3a3a3c", letterSpacing: 2, marginBottom: 3 }}>{l}</div>
                        <div style={{ fontFamily: MONO, fontSize: 10, color: c, fontWeight: 600 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                  {score.keyIndicators?.length > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <SectionHead>KEY INDICATORS</SectionHead>
                      {score.keyIndicators.map((ind, i) => (
                        <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 6 }}>
                          <span style={{ color: col, fontSize: 9, marginTop: 1, flexShrink: 0 }}>◆</span>
                          <span style={{ fontFamily: MONO, fontSize: 10, color: "#8e8e93", lineHeight: 1.5 }}>{ind}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {score.analystNote && (
                    <div style={{ padding: "10px 12px", background: "rgba(0,200,80,0.04)", border: "1px solid rgba(0,200,80,0.12)", borderRadius: 4 }}>
                      <SectionHead>ANALYST NOTE · CLAUDE AI</SectionHead>
                      <div style={{ fontFamily: MONO, fontSize: 10, color: "#8e8e93", lineHeight: 1.7 }}>{score.analystNote}</div>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 10, color: "#2a4a2a" }}>Analysis unavailable. Check API configuration.</div>
              )}
            </div>
          )}

          {activeTab === "TIMELINE" && (
            <div>
              <SectionHead>HISTORICAL TIMELINE</SectionHead>
              <Timeline zone={zone}/>
              <Divider margin="12px 0"/>
              <SectionHead>RECENT EVENTS (LIVE DATA)</SectionHead>
              {zEvents.slice(0, 10).map((e, i) => {
                const eventCol = ACLED_COLORS[e.type] || "#636366";
                return (
                  <div key={i} style={{ padding: "7px 9px", marginBottom: 4, background: "rgba(255,255,255,0.02)", borderLeft: `2px solid ${eventCol}44`, borderRadius: "0 3px 3px 0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: eventCol }}>{(e.type || "").split("/")[0]}</span>
                      <span style={{ fontFamily: MONO, fontSize: 8, color: "#3a3a3c" }}>{e.date}</span>
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 9, color: "#8e8e93" }}>{e.location} {e.fatalities > 0 ? `· ☠ ${e.fatalities}` : ""}</div>
                  </div>
                );
              })}
              {zEvents.length === 0 && <div style={{ fontFamily: MONO, fontSize: 10, color: "#2a4a2a" }}>No recent events in live feed</div>}
            </div>
          )}

          {activeTab === "SOURCES" && (
            <div>
              <SectionHead>SOURCE CITATIONS</SectionHead>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#3a3a3c", marginBottom: 12, lineHeight: 1.6 }}>
                All assessments are generated from open-source intelligence (OSINT). Data is aggregated from the following primary and secondary sources:
              </div>
              <SourceCitations zone={zone}/>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: "8px 18px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 7, color: "#1a3a1a" }}>
            WORLDWIDERADAR.COM · OSINT // UNCLASSIFIED · DATA UPDATES EVERY 5 MIN
          </div>
        </div>
      </div>
    </>
  );
}
