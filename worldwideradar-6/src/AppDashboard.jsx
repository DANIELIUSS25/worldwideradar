import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ZONES, SEV_COLOR } from "./data/zones.js";
import { MONO, Dot, Spinner } from "./components/UI.jsx";
import { useACLED, useGDELT, useRSS, useWatchlist, useFireData, useSeismic, usePolymarket, useUSStatus } from "./hooks/index.js";
import WorldMap from "./components/WorldMap.jsx";
import IntelligenceDrawer from "./components/IntelligenceDrawer.jsx";
import { ConflictActivityIndex, TimeSlider, WatchlistPanel } from "./components/DataProduct.jsx";
import { ThreatScorePanel, IntelPanel, SignalTracker, ACLEDFeed, Ticker } from "./components/Panels.jsx";
import { GlobalTensionGauge, PredictionMarketsPanel } from "./components/GlobalIntel.jsx";
import USCitizensPanel from "./components/USCitizensPanel.jsx";
import { exportCSV } from "./utils/geo.js";

const DEFAULT_LAYERS = { events:true, zones:true, fires:true, seismic:false, bases:false };

// ─── MOBILE DETECTION HOOK ───────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

// ─── ZONE LIST (shared) ──────────────────────────────────────────────────────
function ZoneList({ zones, selected, acledEvents, onSelect, watchlist, compact }) {
  return (
    <div style={{ flex:1, overflowY:"auto" }}>
      {zones.map(z => {
        const c = SEV_COLOR[z.sev]||"#ffd60a";
        const on = selected?.id === z.id;
        const q = z.name.split(/[\s\u2013-]/)[0].toLowerCase();
        const cnt = acledEvents.filter(e => (e.country||"").toLowerCase().includes(q)).length;
        return (
          <div key={z.id} onClick={() => onSelect(z)}
            style={{ padding: compact ? "10px 16px" : "9px 12px", cursor:"pointer",
              borderLeft:`3px solid ${on?c:"transparent"}`,
              background: on ? `${c}12` : "transparent", transition:"all 0.12s" }}
            onMouseEnter={e => !on && (e.currentTarget.style.background="rgba(255,255,255,0.025)")}
            onMouseLeave={e => !on && (e.currentTarget.style.background="transparent")}
          >
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:3 }}>
              <span style={{ fontSize: compact ? 13 : 10, color:"#d1d1d6", fontWeight:600 }}>{z.name}</span>
              <div style={{ display:"flex", gap:5, alignItems:"center" }}>
                {watchlist.includes(z.id) && <span style={{ color:c, fontSize:9 }}>★</span>}
                <span style={{ fontSize:8, padding:"2px 6px", borderRadius:2, background:`${c}20`, color:c }}>{z.sev}</span>
              </div>
            </div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <span style={{ fontSize: compact ? 11 : 8, color:"#3a3a3c" }}>{z.type}</span>
              {cnt > 0 && <span style={{ fontSize: compact ? 10 : 7, color:"#ff9f0a" }}>{cnt} events</span>}
            </div>
            <div style={{ marginTop:5, height:2, background:"rgba(255,255,255,0.05)", borderRadius:1, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${z.cai}%`, background:c, borderRadius:1 }}/>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── DESKTOP SIDEBAR ─────────────────────────────────────────────────────────
function ZoneSidebar({ zones, selected, filter, acledEvents, onSelect, watchlist, onToggleWatch, sideTab, setSideTab, usAdvisories, usAlerts, usStats, usLoading }) {
  const navigate = useNavigate();
  const filtered = zones.filter(z => filter === "ALL" || z.sev === filter);
  return (
    <div style={{ width:210, flexShrink:0, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.45)", borderRight:"1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
        {[{id:"ZONES",label:"ZONES"},{id:"INDEX",label:"CAI"},{id:"WATCH",label:"WATCH"+(watchlist.length?" ("+watchlist.length+")":"")},{id:"USCIT",label:"🇺🇸"}].map(t => (
          <button key={t.id} onClick={() => setSideTab(t.id)} style={{ flex:1,padding:"7px 2px",fontSize:7,letterSpacing:1,cursor:"pointer",border:"none",borderBottom:"2px solid "+(sideTab===t.id?"#00c864":"transparent"),background:"transparent",color:sideTab===t.id?"#00c864":"#3a3a3c",fontFamily:MONO,transition:"all 0.12s" }}>{t.label}</button>
        ))}
      </div>
      {sideTab==="ZONES" && (<>
        <div style={{ padding:"8px 12px 5px", borderBottom:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
          <div style={{ fontSize:8, color:"#1a3a1a", letterSpacing:3 }}>CONFLICT ZONES</div>
          <div style={{ fontSize:9, color:"#3a3a3c", marginTop:1 }}>{filtered.length} monitored</div>
        </div>
        <ZoneList zones={filtered} selected={selected} acledEvents={acledEvents} onSelect={onSelect} watchlist={watchlist}/>
        <div style={{ padding:"8px 12px", borderTop:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
          <button onClick={() => navigate("/methodology")} style={{ width:"100%",padding:"5px 0",background:"none",border:"1px solid rgba(0,200,80,0.15)",color:"#2a4a2a",fontFamily:MONO,fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2 }}>→ METHODOLOGY</button>
        </div>
      </>)}
      {sideTab==="INDEX" && <div style={{ flex:1,overflowY:"auto" }}><ConflictActivityIndex zones={filtered} onSelect={onSelect}/></div>}
      {sideTab==="WATCH" && <div style={{ flex:1,overflowY:"auto" }}><WatchlistPanel watchlist={watchlist} onSelect={onSelect} onRemove={onToggleWatch}/></div>}
      {sideTab==="USCIT" && <div style={{ flex:1,overflowY:"auto",overflow:"hidden",display:"flex",flexDirection:"column" }}><USCitizensPanel advisories={usAdvisories} liveAlerts={usAlerts} stats={usStats} loading={usLoading}/></div>}
    </div>
  );
}

// ─── DESKTOP RIGHT PANEL ─────────────────────────────────────────────────────
function RightPanel({ tab, setTab, selected, acledEvents, articles, signals, markets, marketsLoading, marketsSource, aLoad, rLoad, usAdvisories, usAlerts, usStats, usLoading }) {
  const tabs = [
    {id:"THREAT",label:"AI THREAT"},
    {id:"INTEL",label:"INTEL"},
    {id:"MARKETS",label:"MARKETS"},
    {id:"SIGNALS",label:"SIGNALS"+(signals.length?" ("+signals.length+")":"")},
    {id:"USCIT",label:"US CITIZENS"},
  ];
  return (
    <div style={{ width:300, flexShrink:0, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.5)", borderLeft:"1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
        {tabs.map(t => <button key={t.id} onClick={() => setTab(t.id)} style={{ flex:1,padding:"8px 2px",fontSize:7,letterSpacing:1,cursor:"pointer",border:"none",borderBottom:"2px solid "+(tab===t.id?"#00c864":"transparent"),background:"transparent",color:tab===t.id?"#00c864":"#3a3a3c",fontFamily:MONO,transition:"all 0.12s" }}>{t.label}</button>)}
      </div>
      <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>
        {tab==="THREAT"  && <ThreatScorePanel zone={selected} acledEvents={acledEvents} gdeltArticles={articles} signals={signals}/>}
        {tab==="INTEL"   && <IntelPanel zone={selected} acledEvents={acledEvents}/>}
        {tab==="MARKETS" && <PredictionMarketsPanel markets={markets} loading={marketsLoading} source={marketsSource}/>}
        {tab==="SIGNALS" && <SignalTracker signals={signals} loading={rLoad}/>}
        {tab==="USCIT"   && <USCitizensPanel advisories={usAdvisories} liveAlerts={usAlerts} stats={usStats} loading={usLoading}/>}
      </div>
    </div>
  );
}

// ─── MOBILE BOTTOM SHEET ─────────────────────────────────────────────────────
function MobileSheet({ activeTab, sel, acledEvents, articles, signals, markets, marketsLoading, marketsSource, rLoad, watchlist, onToggleWatch, onSelect, filter, usAdvisories, usAlerts, usStats, usLoading }) {
  const navigate = useNavigate();
  const filtered = ZONES.filter(z => filter === "ALL" || z.sev === filter);
  const [intelTab, setIntelTab] = useState("THREAT");

  if (activeTab === "MAP") return null;

  const content = () => {
    if (activeTab === "ZONES") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ padding:"12px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ fontSize:9, color:"#1a3a1a", letterSpacing:3 }}>CONFLICT ZONES · {filtered.length} MONITORED</div>
        </div>
        <ZoneList zones={filtered} selected={sel} acledEvents={acledEvents} onSelect={onSelect} watchlist={watchlist} compact/>
      </div>
    );
    if (activeTab === "INTEL") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          {[{id:"THREAT",label:"AI THREAT"},{id:"INTEL",label:"INTEL"},{id:"MARKETS",label:"MARKETS"}].map(t => (
            <button key={t.id} onClick={() => setIntelTab(t.id)} style={{ flex:1,padding:"10px 4px",fontSize:8,letterSpacing:1,cursor:"pointer",border:"none",borderBottom:"2px solid "+(intelTab===t.id?"#00c864":"transparent"),background:"transparent",color:intelTab===t.id?"#00c864":"#3a3a3c",fontFamily:MONO }}>
              {t.label}
            </button>
          ))}
        </div>
        <div style={{ flex:1, overflow:"hidden" }}>
          {intelTab==="THREAT"  && <ThreatScorePanel zone={sel} acledEvents={acledEvents} gdeltArticles={articles} signals={signals}/>}
          {intelTab==="INTEL"   && <IntelPanel zone={sel} acledEvents={acledEvents}/>}
          {intelTab==="MARKETS" && <PredictionMarketsPanel markets={markets} loading={marketsLoading} source={marketsSource}/>}
        </div>
      </div>
    );
    if (activeTab === "SIGNALS") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ padding:"12px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ fontSize:9, color:"#1a3a1a", letterSpacing:3 }}>LIVE INTELLIGENCE SIGNALS</div>
        </div>
        <SignalTracker signals={signals} loading={rLoad}/>
      </div>
    );
    if (activeTab === "WATCH") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <div style={{ padding:"12px 16px 8px", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <div style={{ fontSize:9, color:"#1a3a1a", letterSpacing:3 }}>WATCHLIST · {watchlist.length} ZONES</div>
        </div>
        <WatchlistPanel watchlist={watchlist} onSelect={onSelect} onRemove={onToggleWatch}/>
        <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
          <button onClick={() => navigate("/methodology")} style={{ width:"100%",padding:"10px",background:"none",border:"1px solid rgba(0,200,80,0.2)",color:"#2a4a2a",fontFamily:MONO,fontSize:9,letterSpacing:2,cursor:"pointer",borderRadius:4 }}>→ METHODOLOGY</button>
        </div>
      </div>
    );
    if (activeTab === "USCIT") return (
      <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>
        <USCitizensPanel advisories={usAdvisories} liveAlerts={usAlerts} stats={usStats} loading={usLoading}/>
      </div>
    );
    return null;
  };

  return (
    <div style={{ position:"absolute", bottom:52, left:0, right:0, height:"62%", background:"rgba(2,10,20,0.97)", borderTop:"1px solid rgba(0,200,80,0.25)", zIndex:200, display:"flex", flexDirection:"column", overflowY:"hidden" }}>
      {content()}
    </div>
  );
}

// ─── MOBILE BOTTOM NAV ───────────────────────────────────────────────────────
function MobileNav({ activeTab, setActiveTab, signals, watchlist, hasSelected }) {
  const tabs = [
    { id:"MAP",     icon:"◎", label:"MAP"     },
    { id:"ZONES",   icon:"⊞", label:"ZONES"   },
    { id:"INTEL",   icon:"⬡", label:"INTEL"   },
    { id:"SIGNALS", icon:"⌾", label: signals.length ? `FEED (${signals.length})` : "FEED" },
    { id:"USCIT",   icon:"US", label:"CITIZENS" },
  ];
  return (
    <div style={{ display:"flex", height:52, background:"rgba(0,0,0,0.95)", borderTop:"1px solid rgba(0,200,80,0.2)", flexShrink:0 }}>
      {tabs.map(t => {
        const on = activeTab === t.id;
        const highlight = t.id === "INTEL" && hasSelected;
        return (
          <button key={t.id} onClick={() => setActiveTab(on && t.id !== "MAP" ? "MAP" : t.id)}
            style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:2, border:"none", borderTop:`2px solid ${on ? "#00c864" : "transparent"}`, background: highlight && !on ? "rgba(0,200,80,0.05)" : "transparent", cursor:"pointer", transition:"all 0.15s" }}>
            <span style={{ fontSize:13, color: on ? "#00c864" : highlight ? "#2a5a2a" : "#3a3a3c" }}>{t.icon}</span>
            <span style={{ fontSize:7, letterSpacing:1, fontFamily:MONO, color: on ? "#00c864" : highlight ? "#2a5a2a" : "#3a3a3c" }}>{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function AppDashboard() {
  const navigate   = useNavigate();
  const isMobile   = useIsMobile();

  const [sel, setSel]               = useState(null);
  const [filter, setFilter]         = useState("ALL");
  const [tab, setTab]               = useState("THREAT");
  const [sideTab, setSideTab]       = useState("ZONES");
  const [mobileTab, setMobileTab]   = useState("MAP");
  const [showACLED, setShowACLED]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timeRange, setTimeRange]   = useState(7);
  const [clock, setClock]           = useState("");
  const [blink, setBlink]           = useState(true);
  const [layers, setLayers]         = useState(DEFAULT_LAYERS);

  const { events:acledEvents, loading:aLoad, source:aSource } = useACLED();
  const { articles, loading:gLoad }  = useGDELT();
  const { signals,  loading:rLoad }  = useRSS();
  const { watchlist, toggle:toggleWatch, isWatched } = useWatchlist();
  const { fires,  loading:fLoad, source:fSource }    = useFireData();
  const { quakes, loading:qLoad }    = useSeismic();
  const { markets,loading:mLoad, source:mSource }    = usePolymarket();
  const { advisories:usAdvisories, liveAlerts:usAlerts, stats:usStats, loading:usLoad } = useUSStatus();

  useEffect(() => {
    setClock(new Date().toUTCString().slice(17,25));
    const t1 = setInterval(() => setClock(new Date().toUTCString().slice(17,25)), 1000);
    const t2 = setInterval(() => setBlink(b => !b), 800);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const sevCnt = useMemo(() => ({
    CRITICAL: ZONES.filter(z => z.sev==="CRITICAL").length,
    HIGH:     ZONES.filter(z => z.sev==="HIGH").length,
    MEDIUM:   ZONES.filter(z => z.sev==="MEDIUM").length,
  }), []);

  const handleSelectZone = useCallback((z) => {
    setSel(z); setTab("THREAT");
    setDrawerOpen(true);
    if (isMobile) setMobileTab("INTEL");
  }, [isMobile]);

  const highFires = fires.filter(f => f.frp > 30).length;

  // ─── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; -webkit-tap-highlight-color:transparent; }
        html,body,#root { width:100%; height:100%; overflow:hidden; background:#000; }
        ::-webkit-scrollbar { width:2px; } ::-webkit-scrollbar-thumb { background:rgba(0,200,80,0.2); }
      `}</style>

      <div style={{ width:"100vw", height:"100vh", display:"flex", flexDirection:"column", background:"#020c18", fontFamily:MONO, color:"#ebebf0", overflow:"hidden", position:"relative" }}>

        {/* Mobile header — compact */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", height:46, padding:"0 14px", flexShrink:0, background:"rgba(0,0,0,0.9)", borderBottom:"1px solid rgba(0,200,80,0.2)", zIndex:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <svg width="26" height="26" viewBox="0 0 32 32" onClick={() => navigate("/")}>
              <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
              <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
              <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
              <line x1={16} y1={2} x2={16} y2={30} stroke="#00c864" strokeWidth="0.8" opacity="0.35"/>
              <line x1={2}  y1={16} x2={30} y2={16} stroke="#00c864" strokeWidth="0.8" opacity="0.35"/>
            </svg>
            <div>
              <div style={{ fontFamily:"Bebas Neue,sans-serif", fontSize:18, letterSpacing:4, color:"#00c864", lineHeight:1 }}>WORLDWIDE RADAR</div>
              <div style={{ fontSize:6, color:"#1a3a1a", letterSpacing:2 }}>GLOBAL CONFLICT INTELLIGENCE</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <GlobalTensionGauge zones={ZONES} fireCount={highFires} quakeCount={quakes.length} compact/>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:13, letterSpacing:1 }}>{clock}<span style={{ color:blink?"#00c864":"transparent", marginLeft:3 }}>●</span></div>
              <div style={{ fontSize:6, color:"#1a3a1a", letterSpacing:1 }}>UTC</div>
            </div>
          </div>
        </div>

        {/* Map — always rendered, fills space */}
        <div style={{ flex:1, position:"relative", minHeight:0 }}>
          <WorldMap zones={ZONES} acledEvents={acledEvents} selected={sel}
            onSelect={handleSelectZone} filter={filter} showACLED={showACLED}
            timeRange={timeRange} fires={fires} quakes={quakes} layers={layers} onLayerToggle={k => setLayers(l=>({...l,[k]:!l[k]}))} usAdvisories={usAdvisories}/>

          {/* Map floating controls */}
          <div style={{ position:"absolute", top:10, right:10, display:"flex", flexDirection:"column", gap:6, zIndex:100 }}>
            {/* Severity filter pill */}
            <div style={{ display:"flex", gap:3, background:"rgba(2,10,20,0.88)", border:"1px solid rgba(0,200,80,0.15)", borderRadius:6, padding:"5px 6px" }}>
              {["ALL","CRIT","HIGH","MED"].map((f,i) => {
                const full = ["ALL","CRITICAL","HIGH","MEDIUM"][i];
                const c = SEV_COLOR[full]||"#00c864"; const on = filter===full;
                return <button key={f} onClick={() => setFilter(full)} style={{ padding:"3px 7px", fontSize:8, letterSpacing:1, borderRadius:3, border:`1px solid ${on?c:"rgba(255,255,255,0.06)"}`, background:on?`${c}20`:"transparent", color:on?c:"#3a3a3c", fontFamily:MONO, cursor:"pointer" }}>{f}</button>;
              })}
            </div>
            {/* Event heatmap toggle */}
            <button onClick={() => setShowACLED(v=>!v)} style={{ padding:"6px 10px", fontSize:8, letterSpacing:1, borderRadius:5, border:`1px solid ${showACLED?"#ff9f0a":"rgba(255,255,255,0.1)"}`, background:showACLED?"rgba(255,159,10,0.15)":"rgba(2,10,20,0.88)", color:showACLED?"#ff9f0a":"#3a3a3c", fontFamily:MONO, cursor:"pointer" }}>
              HEAT {showACLED?"ON":"OFF"}
            </button>
          </div>

          {/* Bottom sheet panel */}
          <MobileSheet activeTab={mobileTab} sel={sel}
            acledEvents={acledEvents} articles={articles} signals={signals}
            markets={markets} marketsLoading={mLoad} marketsSource={mSource}
            rLoad={rLoad} watchlist={watchlist} onToggleWatch={toggleWatch}
            onSelect={handleSelectZone} filter={filter}
            usAdvisories={usAdvisories} usAlerts={usAlerts} usStats={usStats} usLoading={usLoad}/>
        </div>

        {/* Ticker — compact on mobile */}
        {mobileTab === "MAP" && (
          <Ticker articles={articles} signals={signals} acledEvents={acledEvents}/>
        )}

        {/* Bottom nav */}
        <MobileNav activeTab={mobileTab} setActiveTab={setMobileTab}
          signals={signals} watchlist={watchlist} hasSelected={!!sel}/>
      </div>

      {drawerOpen && sel && (
        <IntelligenceDrawer zone={sel} acledEvents={acledEvents} gdeltArticles={articles}
          signals={signals} onClose={() => { setDrawerOpen(false); }}
          isWatched={isWatched(sel.id)} onToggleWatch={toggleWatch}/>
      )}
    </>
  );

  // ─── DESKTOP LAYOUT ──────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; }
        html,body,#root { width:100%; height:100%; overflow:hidden; background:#000; }
        ::-webkit-scrollbar { width:3px; } ::-webkit-scrollbar-thumb { background:rgba(0,200,80,0.2); }
      `}</style>
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,80,0.01) 3px,rgba(0,255,80,0.01) 4px)" }}/>

      <div style={{ width:"100vw",height:"100vh",background:"#020c18",display:"flex",flexDirection:"column",color:"#ebebf0",overflow:"hidden",fontFamily:MONO }}>

        {/* Desktop header */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:54,padding:"0 16px",flexShrink:0,background:"rgba(0,0,0,0.75)",borderBottom:"1px solid rgba(0,200,80,0.2)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <svg width="32" height="32" viewBox="0 0 32 32" style={{ cursor:"pointer",flexShrink:0 }} onClick={() => navigate("/")}>
              <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
              <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
              <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
              <line x1={16} y1={2}  x2={16} y2={30} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
              <line x1={2}  y1={16} x2={30} y2={16} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
            </svg>
            <div>
              <div style={{ fontFamily:"Bebas Neue,sans-serif",fontSize:22,letterSpacing:5,color:"#00c864",lineHeight:1 }}>WORLDWIDE RADAR</div>
              <div style={{ fontSize:7,color:"#1a3a1a",letterSpacing:3,marginTop:1 }}>GLOBAL CONFLICT INTELLIGENCE · GDELT · RELIEFWEB · NASA FIRMS · USGS · POLYMARKET · CLAUDE AI</div>
            </div>
          </div>
          <GlobalTensionGauge zones={ZONES} fireCount={highFires} quakeCount={quakes.length}/>
          <div style={{ display:"flex",gap:16 }}>
            {[{l:"LIVE EVENTS",v:acledEvents.length||"...",c:"#ff9f0a",spin:aLoad},{l:"SAT FIRES",v:fires.length||"...",c:"#ff4500",spin:fLoad},{l:"GDELT 6H",v:articles.length||"...",c:"#0a84ff",spin:gLoad},{l:"MARKETS",v:markets.length||"...",c:"#ffd60a",spin:mLoad}].map(s => (
              <div key={s.l} style={{ textAlign:"center" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:3,marginBottom:1 }}>
                  {s.spin && <Spinner size={7} color={s.c}/>}
                  <span style={{ fontSize:7,color:"#1a3a1a",letterSpacing:2 }}>{s.l}</span>
                </div>
                <div style={{ fontSize:14,color:s.c,fontWeight:700,letterSpacing:1 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <button onClick={() => navigate("/methodology")} style={{ background:"none",border:"1px solid rgba(0,200,80,0.2)",color:"#2a4a2a",fontFamily:MONO,fontSize:7,letterSpacing:2,padding:"4px 10px",borderRadius:2,cursor:"pointer" }}>METHODOLOGY</button>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:17,letterSpacing:2 }}>{clock}<span style={{ color:blink?"#00c864":"transparent",marginLeft:4,fontSize:8 }}>&#9679;</span></div>
              <div style={{ fontSize:7,color:"#1a3a1a",letterSpacing:2 }}>UTC</div>
            </div>
          </div>
        </div>

        {/* Desktop filter bar */}
        <div style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 14px",background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0,flexWrap:"wrap" }}>
          <span style={{ fontSize:7,color:"#1a3a1a",letterSpacing:3,marginRight:4 }}>SEVERITY:</span>
          {["ALL","CRITICAL","HIGH","MEDIUM"].map(f => {
            const c = SEV_COLOR[f]||"#00c864"; const on = filter===f;
            return <button key={f} onClick={() => setFilter(f)} style={{ padding:"2px 9px",fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2,border:"1px solid "+(on?c:"rgba(255,255,255,0.06)"),background:on?c+"20":"transparent",color:on?c:"#3a3a3c",fontFamily:MONO,transition:"all 0.12s" }}>{f}{f!=="ALL"&&" ("+sevCnt[f]+")"}</button>;
          })}
          <div style={{ width:1,height:16,background:"rgba(255,255,255,0.06)",margin:"0 4px" }}/>
          <button onClick={() => setShowACLED(v=>!v)} style={{ display:"flex",alignItems:"center",gap:3,padding:"2px 9px",fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2,border:"1px solid "+(showACLED?"#ff9f0a":"rgba(255,255,255,0.06)"),background:showACLED?"rgba(255,159,10,0.1)":"transparent",color:showACLED?"#ff9f0a":"#3a3a3c",fontFamily:MONO }}>
            EVENTS {showACLED?"ON":"OFF"}
          </button>
          <div style={{ width:1,height:16,background:"rgba(255,255,255,0.06)",margin:"0 4px" }}/>
          <TimeSlider value={timeRange} onChange={setTimeRange}/>
          <button onClick={() => exportCSV(acledEvents,"worldwideradar-events.csv")} style={{ padding:"2px 9px",fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#3a3a3c",fontFamily:MONO }}>↓ CSV</button>
          <div style={{ flex:1 }}/>
          {[{l:"EVENTS",c:aSource==="demo"?"#ff9f0a":"#00c864",on:!aLoad,t:aSource==="demo"?"DEMO":"GDELT LIVE"},{l:"SAT",c:fSource==="demo"?"#ff9f0a":"#ff4500",on:!fLoad,t:fSource==="demo"?"SAT DEMO":"NASA FIRMS"},{l:"SEISMIC",c:"#00e5ff",on:!qLoad,t:"USGS"},{l:"RSS",c:"#ffd60a",on:!rLoad,t:"RSS"}].map(s => (
            <div key={s.l} style={{ display:"flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:2,background:"rgba(255,255,255,0.03)" }}>
              <Dot size={5} color={s.on?s.c:"#3a3a3c"}/>
              <span style={{ fontSize:7,color:s.on?s.c:"#3a3a3c",letterSpacing:1 }}>{s.t}</span>
            </div>
          ))}
        </div>

        {/* Desktop main */}
        <div style={{ flex:1,display:"flex",overflow:"hidden",minHeight:0 }}>
          <ZoneSidebar zones={ZONES} selected={sel} filter={filter} acledEvents={acledEvents} onSelect={handleSelectZone} watchlist={watchlist} onToggleWatch={toggleWatch} sideTab={sideTab} setSideTab={setSideTab} usAdvisories={usAdvisories} usAlerts={usAlerts} usStats={usStats} usLoading={usLoad}/>
          <div style={{ flex:1,overflow:"hidden",minWidth:0,position:"relative" }}>
            <WorldMap zones={ZONES} acledEvents={acledEvents} selected={sel} onSelect={handleSelectZone} filter={filter} showACLED={showACLED} timeRange={timeRange} fires={fires} quakes={quakes} layers={layers} onLayerToggle={k => setLayers(l=>({...l,[k]:!l[k]}))} usAdvisories={usAdvisories}/>
            {!sel && <div style={{ position:"absolute",bottom:16,left:"50%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:8,color:"#1a3a1a",letterSpacing:3,pointerEvents:"none" }}>CLICK HOTSPOT FOR INTEL · SCROLL TO ZOOM · DRAG TO PAN</div>}
          </div>
          <RightPanel tab={tab} setTab={setTab} selected={sel} acledEvents={acledEvents} articles={articles} signals={signals} markets={markets} marketsLoading={mLoad} marketsSource={mSource} aLoad={aLoad} rLoad={rLoad} usAdvisories={usAdvisories} usAlerts={usAlerts} usStats={usStats} usLoading={usLoad}/>
        </div>

        <Ticker articles={articles} signals={signals} acledEvents={acledEvents}/>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 14px",flexShrink:0,background:"rgba(0,0,0,0.8)",borderTop:"1px solid rgba(0,200,80,0.06)" }}>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}><Dot size={5} color="#00c864" glow/><span style={{ fontSize:8,color:"#00c864",letterSpacing:1 }}>SYSTEMS NOMINAL</span></div>
            <span style={{ fontSize:7,color:"#1a3a1a" }}>GDELT GEO · UN OCHA · NASA FIRMS · USGS · POLYMARKET · WIKIPEDIA · REUTERS · BBC · CLAUDE AI</span>
          </div>
          <div style={{ display:"flex",gap:12 }}>
            <span onClick={() => navigate("/methodology")} style={{ fontSize:7,color:"#1a3a1a",cursor:"pointer" }}>METHODOLOGY</span>
            <span style={{ fontSize:7,color:"#1a3a1a" }}>WORLDWIDERADAR.COM · BUILT BY DANIELIUS SEMETULSKIS · OSINT // UNCLASSIFIED</span>
          </div>
        </div>
      </div>

      {drawerOpen && sel && <IntelligenceDrawer zone={sel} acledEvents={acledEvents} gdeltArticles={articles} signals={signals} onClose={() => setDrawerOpen(false)} isWatched={isWatched(sel.id)} onToggleWatch={toggleWatch}/>}

      <div aria-hidden="true" style={{ position:"absolute",left:"-9999px",top:0,width:1,height:1,overflow:"hidden" }}>
        <h1>WorldwideRadar - Global Conflict Intelligence Map 2025</h1>
        <p>Real-time global conflict map with satellite fire data, seismic monitoring, prediction markets, and Claude AI threat assessment. Live war tracker covering Ukraine, Gaza, Sudan, Myanmar, and 25 active conflict zones.</p>
        {ZONES.map(z => <div key={z.id}><h2>{z.name} — Live Conflict Map {new Date().getFullYear()}</h2><p>Live {z.sev.toLowerCase()} alert: {z.name} in {z.region}. CAI: {z.cai}/100.</p></div>)}
        <p>global conflict map · live war tracker · ukraine war live map · middle east conflict monitor · military intelligence dashboard · geopolitical risk · interactive war map</p>
      </div>
    </>
  );
}
