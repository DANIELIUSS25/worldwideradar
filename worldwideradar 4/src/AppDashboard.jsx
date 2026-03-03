import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ZONES, SEV_COLOR, ACLED_COLORS, getGlobalThreatIndex } from "./data/zones.js";
import { MONO, DISPLAY, Dot, Spinner, Sparkline } from "./components/UI.jsx";
import { useACLED, useGDELT, useRSS, useWatchlist } from "./hooks/index.js";
import MapLibreMap from "./components/MapLibreMap.jsx";
import Globe3D from "./components/Globe3D.jsx";
import IntelligenceDrawer from "./components/IntelligenceDrawer.jsx";
import { ConflictActivityIndex, TimeSlider, WatchlistPanel } from "./components/DataProduct.jsx";
import ThreatMeter from "./components/ThreatMeter.jsx";
import { ThreatScorePanel, IntelPanel, SignalTracker, ACLEDFeed, Ticker } from "./components/Panels.jsx";
import { exportCSV, caiColor, deltaStr, deltaColor } from "./utils/geo.js";

// ── GLOBAL THREAT INDEX STRIP ──────────────────────────────────────────────────
function GlobalThreatStrip({ zones, loading }) {
  const gti = getGlobalThreatIndex(zones);
  const col = caiColor(gti);
  const critical = zones.filter(z=>z.sev==="CRITICAL").length;
  const high     = zones.filter(z=>z.sev==="HIGH").length;
  const [pulse, setPulse] = useState(false);
  useEffect(()=>{const t=setInterval(()=>setPulse(p=>!p),1200);return()=>clearInterval(t);},[]);

  return (
    <div style={{ display:"flex", alignItems:"center", gap:0, borderBottom:"1px solid rgba(255,255,255,0.04)", background:"rgba(0,0,0,0.6)", flexShrink:0 }}>
      {/* GTI score */}
      <div style={{ padding:"6px 18px", borderRight:"1px solid rgba(255,255,255,0.06)", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
        <div style={{ width:8, height:8, borderRadius:"50%", background:col, boxShadow:`0 0 8px ${col}`, opacity:pulse?1:0.5, transition:"opacity 0.5s" }}/>
        <div>
          <div style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", letterSpacing:3, marginBottom:1 }}>GLOBAL THREAT INDEX</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:6 }}>
            <span style={{ fontFamily:DISPLAY, fontSize:22, color:col, lineHeight:1 }}>{gti}</span>
            <span style={{ fontFamily:MONO, fontSize:7, color:"#3a3a3c" }}>/100</span>
          </div>
        </div>
      </div>
      {/* Zone severity counts */}
      <div style={{ display:"flex", gap:0 }}>
        {[
          {l:"CRITICAL", v:critical, c:"#ff2d55"},
          {l:"HIGH",     v:high,     c:"#ff9f0a"},
          {l:"ZONES",    v:zones.length, c:"#636366"},
        ].map(s=>(
          <div key={s.l} style={{ padding:"6px 14px", borderRight:"1px solid rgba(255,255,255,0.04)", textAlign:"center" }}>
            <div style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", letterSpacing:2, marginBottom:2 }}>{s.l}</div>
            <div style={{ fontFamily:DISPLAY, fontSize:20, color:s.c, lineHeight:1 }}>{s.v}</div>
          </div>
        ))}
      </div>
      {/* Escalating zones */}
      <div style={{ flex:1, padding:"0 14px", overflowX:"auto", display:"flex", gap:6, alignItems:"center" }}>
        <span style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", letterSpacing:2, flexShrink:0 }}>ESCALATING:</span>
        {zones.filter(z=>z.delta>=5).sort((a,b)=>b.delta-a.delta).map(z=>(
          <div key={z.id} style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 7px", borderRadius:2, background:"rgba(255,45,85,0.08)", border:"1px solid rgba(255,45,85,0.2)", flexShrink:0 }}>
            <span style={{ fontFamily:MONO, fontSize:7, color:"#ff2d55" }}>↑{z.delta}%</span>
            <span style={{ fontFamily:MONO, fontSize:7, color:"#8e8e93" }}>{z.name}</span>
          </div>
        ))}
      </div>
      {/* GTI bar */}
      <div style={{ width:120, padding:"6px 14px", borderLeft:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
        <div style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", letterSpacing:2, marginBottom:4 }}>INTENSITY</div>
        <div style={{ height:4, background:"rgba(255,255,255,0.05)", borderRadius:2, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${gti}%`, background:`linear-gradient(90deg, #ffd60a, ${col})`, borderRadius:2, transition:"width 1s" }}/>
        </div>
      </div>
    </div>
  );
}

// ── LEFT SIDEBAR ───────────────────────────────────────────────────────────────
function ZoneSidebar({ zones, selected, filter, acledEvents, onSelect, watchlist, onToggleWatch, sideTab, setSideTab }) {
  const navigate = useNavigate();
  const filtered = zones.filter(z=>filter==="ALL"||z.sev===filter);

  return (
    <div style={{ width:218, flexShrink:0, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.5)", borderRight:"1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
        {[{id:"ZONES",label:"ZONES"},{id:"INDEX",label:"CAI"},{id:"WATCH",label:`WATCH${watchlist.length?` (${watchlist.length})`:""}`}].map(t=>(
          <button key={t.id} onClick={()=>setSideTab(t.id)} style={{ flex:1, padding:"7px 2px", fontSize:7, letterSpacing:1, cursor:"pointer", border:"none", borderBottom:`2px solid ${sideTab===t.id?"#00c864":"transparent"}`, background:"transparent", color:sideTab===t.id?"#00c864":"#3a3a3c", fontFamily:MONO, transition:"all 0.12s" }}>{t.label}</button>
        ))}
      </div>

      {sideTab==="ZONES" && (
        <>
          <div style={{ padding:"6px 12px 4px", borderBottom:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
            <div style={{ fontSize:7, color:"#1a3a1a", letterSpacing:3 }}>CONFLICT ZONES</div>
            <div style={{ fontSize:8, color:"#2a4a2a", marginTop:1 }}>{filtered.length} / {zones.length} monitored</div>
          </div>
          <div style={{ flex:1, overflowY:"auto" }}>
            {filtered.map(z=>{
              const c=SEV_COLOR[z.sev]||"#ffd60a"; const on=selected?.id===z.id;
              const q=z.name.split(/[\s\u2013-]/)[0].toLowerCase();
              const cnt=acledEvents.filter(e=>(e.country||"").toLowerCase().includes(q)).length;
              return (
                <div key={z.id} onClick={()=>onSelect(z)}
                  style={{ padding:"8px 12px", cursor:"pointer", borderLeft:`3px solid ${on?c:"transparent"}`, background:on?`${c}0c`:"transparent", transition:"all 0.1s" }}
                  onMouseEnter={e=>!on&&(e.currentTarget.style.background="rgba(255,255,255,0.025)")}
                  onMouseLeave={e=>!on&&(e.currentTarget.style.background="transparent")}
                >
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:2 }}>
                    <span style={{ fontSize:9.5, color:"#d1d1d6", fontWeight:600 }}>{z.name}</span>
                    <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                      {watchlist.includes(z.id)&&<span style={{ color:c, fontSize:8 }}>★</span>}
                      <span style={{ fontSize:6.5, padding:"1px 4px", borderRadius:2, background:`${c}20`, color:c }}>{z.sev}</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                    <span style={{ fontSize:7.5, color:"#3a3a3c" }}>{z.type}</span>
                    <span style={{ fontSize:7.5, color:deltaColor(z.delta), fontFamily:MONO }}>{deltaStr(z.delta)}</span>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <div style={{ flex:1, height:2, background:"rgba(255,255,255,0.05)", borderRadius:1, overflow:"hidden" }}>
                      <div style={{ height:"100%", width:`${z.cai}%`, background:c, borderRadius:1 }}/>
                    </div>
                    <span style={{ fontSize:7, color:caiColor(z.cai), fontFamily:MONO, flexShrink:0 }}>{z.cai}</span>
                    {cnt>0&&<span style={{ fontSize:7, color:"#ff9f0a", flexShrink:0 }}>{cnt}ev</span>}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ padding:"7px 10px", borderTop:"1px solid rgba(255,255,255,0.04)", display:"flex", gap:5, flexShrink:0 }}>
            <button onClick={()=>navigate("/methodology")} style={{ flex:1, padding:"4px 0", background:"none", border:"1px solid rgba(0,200,80,0.15)", color:"#2a4a2a", fontFamily:MONO, fontSize:7, letterSpacing:2, cursor:"pointer", borderRadius:2 }}>METHODOLOGY</button>
          </div>
        </>
      )}
      {sideTab==="INDEX" && <div style={{ flex:1, overflowY:"auto" }}><ConflictActivityIndex zones={filtered} onSelect={onSelect}/></div>}
      {sideTab==="WATCH" && <div style={{ flex:1, overflowY:"auto" }}><WatchlistPanel watchlist={watchlist} onSelect={onSelect} onRemove={onToggleWatch}/></div>}
    </div>
  );
}

// ── RIGHT PANEL ────────────────────────────────────────────────────────────────
function RightPanel({ tab, setTab, selected, acledEvents, articles, signals, aLoad, rLoad }) {
  const tabs = [
    {id:"THREAT",label:"AI THREAT"},
    {id:"INTEL",label:"INTEL"},
    {id:"SIGNALS",label:`SIG${signals.length?` (${signals.length})`:""}`},
    {id:"ACLED",label:`EVT${acledEvents.length?` (${acledEvents.length})`:""}`},
  ];
  return (
    <div style={{ width:292, flexShrink:0, display:"flex", flexDirection:"column", background:"rgba(0,0,0,0.5)", borderLeft:"1px solid rgba(0,200,80,0.1)" }}>
      <div style={{ display:"flex", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
        {tabs.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1, padding:"8px 2px", fontSize:7, letterSpacing:1, cursor:"pointer", border:"none", borderBottom:`2px solid ${tab===t.id?"#00c864":"transparent"}`, background:"transparent", color:tab===t.id?"#00c864":"#3a3a3c", fontFamily:MONO, transition:"all 0.12s" }}>{t.label}</button>
        ))}
      </div>
      <div style={{ flex:1, overflow:"hidden" }}>
        {tab==="THREAT"  && <ThreatScorePanel zone={selected} acledEvents={acledEvents} gdeltArticles={articles} signals={signals}/>}
        {tab==="INTEL"   && <IntelPanel zone={selected} acledEvents={acledEvents}/>}
        {tab==="SIGNALS" && <SignalTracker signals={signals} loading={rLoad}/>}
        {tab==="ACLED"   && <ACLEDFeed events={acledEvents} loading={aLoad}/>}
      </div>
    </div>
  );
}

// ── MAIN DASHBOARD ─────────────────────────────────────────────────────────────
export default function AppDashboard() {
  const navigate = useNavigate();
  const [sel, setSel]               = useState(null);
  const [filter, setFilter]         = useState("ALL");
  const [tab, setTab]               = useState("THREAT");
  const [sideTab, setSideTab]       = useState("ZONES");
  const [showACLED, setShowACLED]   = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timeRange, setTimeRange]   = useState(7);
  const [mapMode, setMapMode]       = useState("2D");  // "2D" | "3D"
  const [clock, setClock]           = useState("");
  const [blink, setBlink]           = useState(true);

  const {events:acledEvents, loading:aLoad, source:aSource} = useACLED();
  const {articles, loading:gLoad}                           = useGDELT();
  const {signals, loading:rLoad}                            = useRSS();
  const {watchlist, toggle:toggleWatch, isWatched}          = useWatchlist();

  useEffect(()=>{
    setClock(new Date().toUTCString().slice(17,25));
    const t1=setInterval(()=>setClock(new Date().toUTCString().slice(17,25)),1000);
    const t2=setInterval(()=>setBlink(b=>!b),800);
    return()=>{clearInterval(t1);clearInterval(t2);};
  },[]);

  const sevCnt = useMemo(()=>({
    CRITICAL:ZONES.filter(z=>z.sev==="CRITICAL").length,
    HIGH:ZONES.filter(z=>z.sev==="HIGH").length,
    MEDIUM:ZONES.filter(z=>z.sev==="MEDIUM").length,
  }),[]);

  function handleSelectZone(z) { setSel(z); setTab("THREAT"); setDrawerOpen(true); }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:3px} ::-webkit-scrollbar-thumb{background:rgba(0,200,80,0.2)}
        html,body,#root{width:100%;height:100%;overflow:hidden;background:#000}
        input::placeholder{color:#2a4a2a;letter-spacing:2px}
      `}</style>
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,80,0.008) 3px,rgba(0,255,80,0.008) 4px)" }}/>

      <div style={{ width:"100vw",height:"100vh",background:"#020c18",display:"flex",flexDirection:"column",color:"#ebebf0",overflow:"hidden",fontFamily:MONO }}>

        {/* TOP BAR */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:50,padding:"0 16px",flexShrink:0,background:"rgba(0,0,0,0.8)",borderBottom:"1px solid rgba(0,200,80,0.2)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <svg width="30" height="30" viewBox="0 0 32 32" style={{ cursor:"pointer" }} onClick={()=>navigate("/")}>
              <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
              <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
              <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
              <line x1={16} y1={2}  x2={16} y2={30} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
              <line x1={2}  y1={16} x2={30} y2={16} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
            </svg>
            <div>
              <div style={{ fontFamily:DISPLAY,fontSize:20,letterSpacing:5,color:"#00c864",lineHeight:1 }}>WORLDWIDE RADAR</div>
              <div style={{ fontSize:6.5,color:"#1a3a1a",letterSpacing:3,marginTop:1 }}>GLOBAL CONFLICT INTELLIGENCE · 25 ZONES · GDELT · RELIEFWEB · CLAUDE AI</div>
            </div>
          </div>

          {/* Global Threat Index — compact in header */}
          <ThreatMeter compact/>

          <div style={{ display:"flex",gap:18,alignItems:"center" }}>
            {[
              {l:"LIVE EVENTS",v:acledEvents.length||"...",c:"#ff9f0a",spin:aLoad},
              {l:"SIGNALS",v:signals.length||"...",c:"#ffd60a",spin:rLoad},
              {l:"GDELT 6H",v:articles.length||"...",c:"#0a84ff",spin:gLoad},
            ].map(s=>(
              <div key={s.l} style={{ textAlign:"center" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:3,marginBottom:2 }}>
                  {s.spin&&<Spinner size={6} color={s.c}/>}
                  <span style={{ fontSize:6.5,color:"#1a3a1a",letterSpacing:2 }}>{s.l}</span>
                </div>
                <div style={{ fontSize:14,color:s.c,fontWeight:700,letterSpacing:1 }}>{s.v}</div>
              </div>
            ))}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            {/* 2D/3D toggle */}
            <div style={{ display:"flex",gap:2 }}>
              {["2D","3D"].map(m=>(
                <button key={m} onClick={()=>setMapMode(m)} style={{ padding:"3px 10px",fontSize:8,letterSpacing:2,cursor:"pointer",borderRadius:2,border:`1px solid ${mapMode===m?"#00c864":"rgba(255,255,255,0.1)"}`,background:mapMode===m?"rgba(0,200,80,0.12)":"transparent",color:mapMode===m?"#00c864":"#3a3a3c",fontFamily:MONO,transition:"all 0.12s" }}>{m}</button>
              ))}
            </div>
            <button onClick={()=>navigate("/methodology")} style={{ background:"none",border:"1px solid rgba(0,200,80,0.2)",color:"#2a4a2a",fontFamily:MONO,fontSize:7,letterSpacing:2,padding:"4px 10px",borderRadius:2,cursor:"pointer" }}>METHODOLOGY</button>
            <div style={{ textAlign:"right" }}>
              <div style={{ fontSize:17,letterSpacing:2 }}>{clock}<span style={{ color:blink?"#00c864":"transparent",marginLeft:4,fontSize:8 }}>●</span></div>
              <div style={{ fontSize:6.5,color:"#1a3a1a",letterSpacing:2 }}>UTC</div>
            </div>
          </div>
        </div>

        {/* GLOBAL THREAT INDEX */}
        <GlobalThreatStrip zones={ZONES} loading={aLoad}/>

        {/* FILTER BAR */}
        <div style={{ display:"flex",alignItems:"center",gap:4,padding:"4px 14px",background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0,flexWrap:"wrap" }}>
          <span style={{ fontSize:7,color:"#1a3a1a",letterSpacing:3,marginRight:4 }}>SEVERITY:</span>
          {["ALL","CRITICAL","HIGH","MEDIUM"].map(f=>{
            const c=SEV_COLOR[f]||"#00c864"; const on=filter===f;
            return <button key={f} onClick={()=>setFilter(f)} style={{ padding:"2px 8px",fontSize:7,letterSpacing:1,cursor:"pointer",borderRadius:2,border:`1px solid ${on?c:"rgba(255,255,255,0.06)"}`,background:on?`${c}20`:"transparent",color:on?c:"#3a3a3c",fontFamily:MONO }}>{f}{f!=="ALL"&&<span style={{ opacity:0.6,marginLeft:4 }}>({sevCnt[f]})</span>}</button>;
          })}
          <div style={{ width:1,height:14,background:"rgba(255,255,255,0.06)",margin:"0 3px" }}/>
          <button onClick={()=>setShowACLED(v=>!v)} style={{ display:"flex",alignItems:"center",gap:3,padding:"2px 8px",fontSize:7,letterSpacing:1,cursor:"pointer",borderRadius:2,border:`1px solid ${showACLED?"#ff9f0a":"rgba(255,255,255,0.06)"}`,background:showACLED?"rgba(255,159,10,0.1)":"transparent",color:showACLED?"#ff9f0a":"#3a3a3c",fontFamily:MONO }}>
            <Dot size={4} color="#ff9f0a"/>EVENTS {showACLED?"ON":"OFF"}
          </button>
          {showACLED&&Object.entries(ACLED_COLORS).slice(0,4).map(([t,c])=>(
            <div key={t} style={{ display:"flex",alignItems:"center",gap:3 }}>
              <div style={{ width:5,height:5,borderRadius:"50%",background:c }}/>
              <span style={{ fontSize:6.5,color:"#3a3a3c" }}>{t.split("/")[0].split(" ").slice(0,2).join(" ")}</span>
            </div>
          ))}
          <div style={{ width:1,height:14,background:"rgba(255,255,255,0.06)",margin:"0 3px" }}/>
          <TimeSlider value={timeRange} onChange={setTimeRange}/>
          <button onClick={()=>exportCSV(acledEvents,"worldwideradar-events.csv")} style={{ padding:"2px 8px",fontSize:7,letterSpacing:1,cursor:"pointer",borderRadius:2,border:"1px solid rgba(255,255,255,0.06)",background:"transparent",color:"#3a3a3c",fontFamily:MONO }}>↓ CSV</button>
          <div style={{ flex:1 }}/>
          {[
            {label:"EVENTS",color:aSource==="demo"?"#ff9f0a":"#00c864",on:!aLoad,title:aSource==="demo"?"DEMO":aSource==="gdelt_geo"?"GDELT LIVE":"UN LIVE"},
            {label:"GDELT",color:"#00c864",on:!gLoad},
            {label:"RSS",color:"#ffd60a",on:!rLoad},
            {label:"WIKI",color:"#0a84ff",on:true},
          ].map(s=>(
            <div key={s.label} style={{ display:"flex",alignItems:"center",gap:3,padding:"2px 6px",borderRadius:2,background:"rgba(255,255,255,0.03)" }}>
              <Dot size={4} color={s.on?s.color:"#3a3a3c"} glow={s.on&&s.color==="#00c864"}/>
              <span style={{ fontSize:6.5,color:s.on?s.color:"#3a3a3c",letterSpacing:1 }}>{s.title||s.label}</span>
            </div>
          ))}
        </div>

        {/* MAIN */}
        <div style={{ flex:1,display:"flex",overflow:"hidden",minHeight:0 }}>
          <ZoneSidebar zones={ZONES} selected={sel} filter={filter} acledEvents={acledEvents} onSelect={handleSelectZone} watchlist={watchlist} onToggleWatch={toggleWatch} sideTab={sideTab} setSideTab={setSideTab}/>
          <div style={{ flex:1,overflow:"hidden",minWidth:0,position:"relative" }}>
            <MapLibreMap zones={ZONES} acledEvents={acledEvents} selected={sel} onSelect={handleSelectZone} filter={filter} showACLED={showACLED} timeRange={timeRange}/>
            {!sel&&<div style={{ position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",fontFamily:MONO,fontSize:7.5,color:"#1a3a1a",letterSpacing:3,pointerEvents:"none" }}>SELECT HOTSPOT FOR INTELLIGENCE BRIEF</div>}
          </div>
          <RightPanel tab={tab} setTab={setTab} selected={sel} acledEvents={acledEvents} articles={articles} signals={signals} aLoad={aLoad} rLoad={rLoad}/>
        </div>

        <Ticker articles={articles} signals={signals} acledEvents={acledEvents}/>

        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 14px",flexShrink:0,background:"rgba(0,0,0,0.8)",borderTop:"1px solid rgba(0,200,80,0.06)" }}>
          <div style={{ display:"flex",gap:12,alignItems:"center" }}>
            <div style={{ display:"flex",alignItems:"center",gap:4 }}><Dot size={4} color="#00c864" glow/><span style={{ fontSize:7.5,color:"#00c864",letterSpacing:1 }}>SYSTEMS NOMINAL</span></div>
            <span style={{ fontSize:7,color:"#1a3a1a" }}>GDELT GEO · RELIEFWEB · NATURAL EARTH · WIKIPEDIA · REUTERS · AL JAZEERA · BBC · UN NEWS · CLAUDE AI</span>
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <span onClick={()=>navigate("/methodology")} style={{ fontSize:7,color:"#1a3a1a",cursor:"pointer" }}>METHODOLOGY</span>
            <span style={{ fontSize:7,color:"#1a3a1a" }}>WORLDWIDERADAR.COM · OSINT // UNCLASSIFIED</span>
          </div>
        </div>
      </div>

      {drawerOpen&&sel&&(
        <IntelligenceDrawer zone={sel} acledEvents={acledEvents} gdeltArticles={articles} signals={signals} onClose={()=>setDrawerOpen(false)} isWatched={isWatched(sel.id)} onToggleWatch={toggleWatch}/>
      )}

      <div aria-hidden="true" style={{ position:"absolute",left:"-9999px",top:0,width:1,height:1,overflow:"hidden" }}>
        <h1>WorldwideRadar — Live Global Conflict Intelligence Map 2025</h1>
        <p>Real-time global conflict map tracking 25 active war zones. Live military intelligence, AI threat assessment, and event data from GDELT and UN OCHA. Ukraine war live map, Gaza conflict tracker, Middle East conflict monitor, and global war tracker.</p>
        {ZONES.map(z=>(
          <div key={z.id}>
            <h2>{z.name} — Live Conflict Map {new Date().getFullYear()}</h2>
            <p>Live {z.sev.toLowerCase()} conflict alert for {z.name} in {z.region}. Conflict type: {z.type}. Real-time events from GDELT, UN OCHA ReliefWeb. AI-powered threat assessment via Claude. Conflict Activity Index: {z.cai}/100.</p>
          </div>
        ))}
        <p>global conflict map 2025 · live war tracker · ukraine war live map · middle east conflict monitor · conflict intelligence platform · geopolitical risk dashboard · real-time military tracker · world war map · active conflicts worldwide</p>
      </div>
    </>
  );
}
