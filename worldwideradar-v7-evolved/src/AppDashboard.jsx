import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ZONES, SEV_COLOR, ACLED_COLORS } from "./data/zones.js";
import { MONO, DISPLAY, Dot, Spinner } from "./components/UI.jsx";
import { useACLED, useGDELT, useRSS, useWatchlist } from "./hooks/index.js";
import WorldMap from "./components/WorldMap.jsx";
import IntelligenceDrawer from "./components/IntelligenceDrawer.jsx";
import { ConflictActivityIndex, TimeSlider, WatchlistPanel } from "./components/DataProduct.jsx";
import { ThreatScorePanel, IntelPanel, SignalTracker, ACLEDFeed, Ticker } from "./components/Panels.jsx";
import { exportCSV } from "./utils/geo.js";

// ── LEFT SIDEBAR ───────────────────────────────────────────────────────────────
function ZoneSidebar({ zones, selected, filter, acledEvents, onSelect, watchlist, onToggleWatch, sideTab, setSideTab }) {
  const navigate = useNavigate();
  const filtered = zones.filter(z => filter === "ALL" || z.sev === filter);

  return (
    <div style={{ width: 210, flexShrink: 0, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.45)", borderRight: "1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[
          { id: "ZONES", label: "ZONES"  },
          { id: "INDEX", label: "CAI"    },
          { id: "WATCH", label: `WATCH${watchlist.length ? ` (${watchlist.length})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setSideTab(t.id)} style={{
            flex: 1, padding: "7px 2px", fontSize: 7, letterSpacing: 1, cursor: "pointer",
            border: "none", borderBottom: `2px solid ${sideTab === t.id ? "#00c864" : "transparent"}`,
            background: "transparent", color: sideTab === t.id ? "#00c864" : "#3a3a3c",
            fontFamily: MONO, transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>

      {sideTab === "ZONES" && (
        <>
          <div style={{ padding: "8px 12px 5px", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <div style={{ fontSize: 8, color: "#1a3a1a", letterSpacing: 3 }}>CONFLICT ZONES</div>
            <div style={{ fontSize: 9, color: "#3a3a3c", marginTop: 1 }}>{filtered.length} monitored</div>
          </div>
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map(z => {
              const c   = SEV_COLOR[z.sev] || "#ffd60a";
              const on  = selected?.id === z.id;
              const q   = z.name.split(/[\s–-]/)[0].toLowerCase();
              const cnt = acledEvents.filter(e => (e.country || "").toLowerCase().includes(q)).length;
              return (
                <div key={z.id} onClick={() => onSelect(z)}
                  style={{ padding: "9px 12px", cursor: "pointer", borderLeft: `3px solid ${on ? c : "transparent"}`, background: on ? `${c}0c` : "transparent", transition: "all 0.12s" }}
                  onMouseEnter={e => !on && (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                  onMouseLeave={e => !on && (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 10, color: "#d1d1d6", fontWeight: 600 }}>{z.name}</span>
                    <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                      {watchlist.includes(z.id) && <span style={{ color: c, fontSize: 8 }}>★</span>}
                      <span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 2, background: `${c}20`, color: c }}>{z.sev}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 8, color: "#3a3a3c" }}>{z.type}</span>
                    {cnt > 0 && <span style={{ fontSize: 7, color: "#ff9f0a" }}>{cnt} events</span>}
                  </div>
                  <div style={{ marginTop: 4, height: 2, background: "rgba(255,255,255,0.05)", borderRadius: 1, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${z.cai}%`, background: c, borderRadius: 1 }}/>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding: "8px 12px", borderTop: "1px solid rgba(255,255,255,0.04)", flexShrink: 0 }}>
            <button onClick={() => navigate("/methodology")} style={{ width: "100%", padding: "5px 0", background: "none", border: "1px solid rgba(0,200,80,0.15)", color: "#2a4a2a", fontFamily: MONO, fontSize: 7, letterSpacing: 2, cursor: "pointer", borderRadius: 2 }}>
              → METHODOLOGY
            </button>
          </div>
        </>
      )}

      {sideTab === "INDEX" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <ConflictActivityIndex zones={filtered} onSelect={onSelect}/>
        </div>
      )}

      {sideTab === "WATCH" && (
        <div style={{ flex: 1, overflowY: "auto" }}>
          <WatchlistPanel watchlist={watchlist} onSelect={onSelect} onRemove={onToggleWatch}/>
        </div>
      )}
    </div>
  );
}

// ── RIGHT PANEL ────────────────────────────────────────────────────────────────
function RightPanel({ tab, setTab, selected, acledEvents, articles, signals, aLoad, rLoad }) {
  return (
    <div style={{ width: 298, flexShrink: 0, display: "flex", flexDirection: "column", background: "rgba(0,0,0,0.5)", borderLeft: "1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
        {[
          { id: "THREAT",  label: "AI THREAT" },
          { id: "INTEL",   label: "INTEL"     },
          { id: "SIGNALS", label: `SIGNALS${signals.length ? ` (${signals.length})` : ""}` },
          { id: "ACLED",   label: `EVENTS${acledEvents.length ? ` (${acledEvents.length})` : ""}` },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "8px 2px", fontSize: 7, letterSpacing: 1, cursor: "pointer",
            border: "none", borderBottom: `2px solid ${tab === t.id ? "#00c864" : "transparent"}`,
            background: "transparent", color: tab === t.id ? "#00c864" : "#3a3a3c",
            fontFamily: MONO, transition: "all 0.12s",
          }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex: 1, overflow: "hidden" }}>
        {tab === "THREAT"  && <ThreatScorePanel zone={selected} acledEvents={acledEvents} gdeltArticles={articles} signals={signals}/>}
        {tab === "INTEL"   && <IntelPanel zone={selected} acledEvents={acledEvents}/>}
        {tab === "SIGNALS" && <SignalTracker signals={signals} loading={rLoad}/>}
        {tab === "ACLED"   && <ACLEDFeed events={acledEvents} loading={aLoad}/>}
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────
export default function AppDashboard() {
  const navigate = useNavigate();

  const [sel, setSel]               = useState(null);
  const [filter, setFilter]         = useState("ALL");
  const [tab, setTab]               = useState("THREAT");
  const [sideTab, setSideTab]       = useState("ZONES");
  const [showACLED, setShowACLED]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timeRange, setTimeRange]   = useState(7);
  const [clock, setClock]           = useState("");
  const [blink, setBlink]           = useState(true);

  const { events: acledEvents, loading: aLoad, source: aSource } = useACLED();
  const { articles, loading: gLoad }                              = useGDELT();
  const { signals, loading: rLoad }                               = useRSS();
  const { watchlist, toggle: toggleWatch, isWatched }             = useWatchlist();

  useEffect(() => {
    setClock(new Date().toUTCString().slice(17, 25));
    const t1 = setInterval(() => setClock(new Date().toUTCString().slice(17, 25)), 1000);
    const t2 = setInterval(() => setBlink(b => !b), 800);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const sevCnt = useMemo(() => ({
    CRITICAL: ZONES.filter(z => z.sev === "CRITICAL").length,
    HIGH:     ZONES.filter(z => z.sev === "HIGH").length,
    MEDIUM:   ZONES.filter(z => z.sev === "MEDIUM").length,
  }), []);

  function handleSelectZone(z) {
    setSel(z);
    setTab("THREAT");
    setDrawerOpen(true);
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0 }
        ::-webkit-scrollbar { width: 3px }
        ::-webkit-scrollbar-thumb { background: rgba(0,200,80,0.2) }
        html, body, #root { width: 100%; height: 100%; overflow: hidden; background: #000 }
        input::placeholder { color: #2a4a2a; letter-spacing: 2px }
      `}</style>

      {/* CRT scanline overlay */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 9999, background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,255,80,0.01) 3px, rgba(0,255,80,0.01) 4px)" }}/>

      <div style={{ width: "100vw", height: "100vh", background: "#020c18", display: "flex", flexDirection: "column", color: "#ebebf0", overflow: "hidden", fontFamily: MONO }}>

        {/* ── TOP BAR ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 52, padding: "0 18px", flexShrink: 0, background: "rgba(0,0,0,0.75)", borderBottom: "1px solid rgba(0,200,80,0.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ cursor: "pointer" }} onClick={() => navigate("/")}>
              <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
              <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
              <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
              <line x1={16} y1={2}  x2={16} y2={30} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
              <line x1={2}  y1={16} x2={30} y2={16} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
            </svg>
            <div>
              <div style={{ fontFamily: DISPLAY, fontSize: 22, letterSpacing: 5, color: "#00c864", lineHeight: 1 }}>WORLDWIDE RADAR</div>
              <div style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 4, marginTop: 1 }}>GLOBAL CONFLICT INTELLIGENCE · GDELT GEO · RELIEFWEB · CLAUDE AI THREAT ENGINE</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 20 }}>
            {[
              { l: "LIVE EVENTS",  v: acledEvents.length || "...", c: "#ff9f0a", spin: aLoad  },
              { l: "LIVE SIGNALS", v: signals.length || "...",     c: "#ffd60a", spin: rLoad  },
              { l: "GDELT (6H)",   v: articles.length || "...",    c: "#0a84ff", spin: gLoad  },
              { l: "THREAT LEVEL", v: "ELEVATED",                  c: "#ff9f0a", spin: false  },
            ].map(s => (
              <div key={s.l} style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, marginBottom: 2 }}>
                  {s.spin && <Spinner size={7} color={s.c}/>}
                  <span style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 2 }}>{s.l}</span>
                </div>
                <div style={{ fontSize: 15, color: s.c, fontWeight: 700, letterSpacing: 1 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button onClick={() => navigate("/methodology")} style={{ background: "none", border: "1px solid rgba(0,200,80,0.2)", color: "#2a4a2a", fontFamily: MONO, fontSize: 7, letterSpacing: 2, padding: "4px 10px", borderRadius: 2, cursor: "pointer" }}>METHODOLOGY</button>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 19, letterSpacing: 2 }}>{clock}<span style={{ color: blink ? "#00c864" : "transparent", marginLeft: 5, fontSize: 9 }}>●</span></div>
              <div style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 2 }}>COORDINATED UNIVERSAL TIME</div>
            </div>
          </div>
        </div>

        {/* ── FILTER BAR ── */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 16px", background: "rgba(0,0,0,0.4)", borderBottom: "1px solid rgba(255,255,255,0.04)", flexShrink: 0, flexWrap: "wrap" }}>
          <span style={{ fontSize: 7, color: "#1a3a1a", letterSpacing: 3, marginRight: 4 }}>SEVERITY:</span>
          {["ALL", "CRITICAL", "HIGH", "MEDIUM"].map(f => {
            const c  = SEV_COLOR[f] || "#00c864";
            const on = filter === f;
            return (
              <button key={f} onClick={() => setFilter(f)} style={{ padding: "2px 9px", fontSize: 7, letterSpacing: 2, cursor: "pointer", borderRadius: 2, border: `1px solid ${on ? c : "rgba(255,255,255,0.06)"}`, background: on ? `${c}20` : "transparent", color: on ? c : "#3a3a3c", fontFamily: MONO, transition: "all 0.12s" }}>
                {f}{f !== "ALL" && <span style={{ opacity: 0.6, marginLeft: 4 }}>({sevCnt[f]})</span>}
              </button>
            );
          })}

          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)", margin: "0 4px" }}/>

          <button onClick={() => setShowACLED(v => !v)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 9px", fontSize: 7, letterSpacing: 2, cursor: "pointer", borderRadius: 2, border: `1px solid ${showACLED ? "#ff9f0a" : "rgba(255,255,255,0.06)"}`, background: showACLED ? "rgba(255,159,10,0.1)" : "transparent", color: showACLED ? "#ff9f0a" : "#3a3a3c", fontFamily: MONO }}>
            <Dot size={5} color="#ff9f0a"/>EVENTS {showACLED ? "ON" : "OFF"}
          </button>

          {showACLED && Object.entries(ACLED_COLORS).slice(0, 4).map(([type, color]) => (
            <div key={type} style={{ display: "flex", alignItems: "center", gap: 3 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: color }}/>
              <span style={{ fontSize: 7, color: "#3a3a3c" }}>{type.split("/")[0].split(" ").slice(0, 2).join(" ")}</span>
            </div>
          ))}

          <div style={{ width: 1, height: 16, background: "rgba(255,255,255,0.06)", margin: "0 4px" }}/>

          <TimeSlider value={timeRange} onChange={setTimeRange}/>

          <button onClick={() => exportCSV(acledEvents, "worldwideradar-events.csv")} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 9px", fontSize: 7, letterSpacing: 2, cursor: "pointer", borderRadius: 2, border: "1px solid rgba(255,255,255,0.06)", background: "transparent", color: "#3a3a3c", fontFamily: MONO }}>
            ↓ CSV
          </button>

          <div style={{ flex: 1 }}/>

          {[
            { label: "EVENTS", color: aSource === "demo" ? "#ff9f0a" : "#00c864", on: !aLoad, title: aSource === "demo" ? "EVENTS DEMO" : aSource === "gdelt_geo" ? "GDELT LIVE" : "UN/OCHA LIVE" },
            { label: "GDELT",  color: "#00c864", on: !gLoad },
            { label: "RSS",    color: "#ffd60a", on: !rLoad },
            { label: "WIKI",   color: "#0a84ff", on: true   },
          ].map(s => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 7px", borderRadius: 2, background: "rgba(255,255,255,0.03)" }}>
              <Dot size={5} color={s.on ? s.color : "#3a3a3c"} glow={s.on && s.color === "#00c864"}/>
              <span style={{ fontSize: 7, color: s.on ? s.color : "#3a3a3c", letterSpacing: 1 }}>{s.title || s.label}</span>
            </div>
          ))}
        </div>

        {/* ── MAIN ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>
          <ZoneSidebar zones={ZONES} selected={sel} filter={filter} acledEvents={acledEvents} onSelect={handleSelectZone} watchlist={watchlist} onToggleWatch={toggleWatch} sideTab={sideTab} setSideTab={setSideTab}/>

          <div style={{ flex: 1, overflow: "hidden", minWidth: 0, position: "relative" }}>
            <WorldMap zones={ZONES} acledEvents={acledEvents} selected={sel} onSelect={handleSelectZone} filter={filter} showACLED={showACLED} timeRange={timeRange}/>
            {!sel && (
              <div style={{ position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)", fontFamily: MONO, fontSize: 8, color: "#1a3a1a", letterSpacing: 3, pointerEvents: "none" }}>
                SELECT HOTSPOT FOR INTELLIGENCE BRIEF
              </div>
            )}
          </div>

          <RightPanel tab={tab} setTab={setTab} selected={sel} acledEvents={acledEvents} articles={articles} signals={signals} aLoad={aLoad} rLoad={rLoad}/>
        </div>

        <Ticker articles={articles} signals={signals} acledEvents={acledEvents}/>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 16px", flexShrink: 0, background: "rgba(0,0,0,0.8)", borderTop: "1px solid rgba(0,200,80,0.06)" }}>
          <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}><Dot size={5} color="#00c864" glow/><span style={{ fontSize: 8, color: "#00c864", letterSpacing: 1 }}>SYSTEMS NOMINAL</span></div>
            <span style={{ fontSize: 7, color: "#1a3a1a" }}>GDELT GEO · RELIEFWEB · NATURAL EARTH · WIKIPEDIA · REUTERS · AL JAZEERA · BBC · UN NEWS · CLAUDE AI</span>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <span onClick={() => navigate("/methodology")} style={{ fontSize: 7, color: "#1a3a1a", cursor: "pointer" }}>METHODOLOGY</span>
            <span style={{ fontSize: 7, color: "#1a3a1a" }}>WORLDWIDERADAR.COM · OSINT // UNCLASSIFIED</span>
          </div>
        </div>
      </div>

      {/* Intelligence Drawer */}
      {drawerOpen && sel && (
        <IntelligenceDrawer zone={sel} acledEvents={acledEvents} gdeltArticles={articles} signals={signals} onClose={() => setDrawerOpen(false)} isWatched={isWatched(sel.id)} onToggleWatch={toggleWatch}/>
      )}

      {/* SEO indexable content — hidden visually, readable by crawlers */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", top: 0, width: 1, height: 1, overflow: "hidden" }}>
        <h1>WorldwideRadar — Global Conflict Intelligence Map</h1>
        <p>Live war tracker and global conflict map. Real-time military conflict monitor covering Ukraine Russia war, Gaza conflict, Sudan civil war, Myanmar war, and 8 other active conflict zones. Powered by GDELT, UN OCHA, and Claude AI threat assessment engine.</p>
        {ZONES.map(z => (
          <div key={z.id}>
            <h2>{z.name} — Live Conflict Map {new Date().getFullYear()}</h2>
            <p>Live {z.sev.toLowerCase()} alert for {z.name} in {z.region}. Conflict type: {z.type}. Real-time event tracking, fatality data, and AI-powered threat assessment.</p>
          </div>
        ))}
        <p>global conflict map · live war tracker · ukraine war live map · middle east conflict monitor · conflict intelligence · real-time military tracker · geopolitical risk dashboard</p>
      </div>
    </>
  );
}
