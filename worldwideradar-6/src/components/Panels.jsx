import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { SEV_COLOR, ACLED_COLORS, TREND_COLOR } from "../data/zones.js";
import { MONO, DISPLAY, SectionHead, Spinner, Loader, EmptyState, Divider } from "./UI.jsx";
import { useWiki, useThreatScore } from "../hooks/index.js";
import { timeAgo } from "../utils/geo.js";

const RSS_FEEDS = [
  { name:"Reuters",  handle:"@Reuters", icon:"R",  color:"#ff8c00" },
  { name:"Al Jazeera", handle:"@AJEnglish", icon:"AJ", color:"#00a651" },
  { name:"BBC World",  handle:"@BBCWorld",  icon:"B",  color:"#bb1919" },
  { name:"UN News",    handle:"@UN_News",   icon:"UN", color:"#009edb" },
  { name:"DW News",    handle:"@dwnews",    icon:"DW", color:"#00bcff" },
];

// ── TICKER ─────────────────────────────────────────────────────────────────────
export function Ticker({ articles, signals, acledEvents }) {
  const items = useMemo(() => {
    const a = articles.slice(0,8).map(a => `[GDELT·${a.domain}] ${a.title}`);
    const s = signals.slice(0,8).map(s => `[${s.src.name.toUpperCase()}] ${s.title}`);
    const e = acledEvents.slice(0,5).map(e => `[ACLED] ${e.type}: ${e.location}, ${e.country} — ☠ ${e.fatalities}`);
    const all = [...a, ...s, ...e];
    return all.length ? all : ["CONNECTING TO LIVE FEEDS — STANDBY..."];
  }, [articles, signals, acledEvents]);

  const ref = useRef(null);
  const pos = useRef(0);
  const raf = useRef(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    pos.current = 0;
    const step = () => {
      pos.current -= 0.45;
      if (el.scrollWidth && Math.abs(pos.current) >= el.scrollWidth / 2) pos.current = 0;
      el.style.transform = `translateX(${pos.current}px)`;
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [items]);

  return (
    <div style={{ overflow:"hidden", padding:"5px 0", background:"rgba(0,0,0,0.55)", borderTop:"1px solid rgba(0,200,100,0.1)", flexShrink:0 }}>
      <div ref={ref} style={{ display:"inline-block", whiteSpace:"nowrap" }}>
        {[...items, ...items].map((t,i) => (
          <span key={i} style={{ fontFamily:MONO, fontSize:10, color:"#636366", marginRight:60 }}>
            <span style={{ color:"#00c864", marginRight:8 }}>◆</span>
            <span style={{ color:"#c7c7cc" }}>{t}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── THREAT SCORE PANEL ─────────────────────────────────────────────────────────
export function ThreatScorePanel({ zone, acledEvents, gdeltArticles, signals }) {
  const wiki = useWiki(zone?.wiki);
  const { score, loading, refresh } = useThreatScore(zone, acledEvents, gdeltArticles, signals, wiki?.extract || "");
  const navigate = useNavigate();

  if (!zone) return <EmptyState msg="SELECT ZONE FOR AI ASSESSMENT"/>;
  const sevCol = SEV_COLOR[zone.sev] || "#ffd60a";

  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px 16px" }}>
      <SectionHead>AI THREAT ASSESSMENT · CLAUDE ENGINE</SectionHead>
      <div style={{ fontFamily:MONO, fontSize:14, color:sevCol, fontWeight:700, letterSpacing:1, marginBottom:6 }}>
        {zone.name.toUpperCase()}
      </div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
        {[zone.sev, zone.type, zone.region].map(t => (
          <span key={t} style={{ fontSize:7, padding:"2px 6px", borderRadius:2, background:"rgba(255,255,255,0.04)", color:"#636366", fontFamily:MONO, letterSpacing:1 }}>{t}</span>
        ))}
      </div>
      <Divider color={sevCol+"33"}/>
      {loading ? (
        <div style={{ display:"flex", alignItems:"center", gap:10, padding:"24px 0" }}>
          <Spinner size={14} color="#00c864"/>
          <span style={{ fontFamily:MONO, fontSize:10, color:"#2a4a2a", letterSpacing:2 }}>CLAUDE ANALYZING ALL FEEDS...</span>
        </div>
      ) : score ? (
        <>
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <SectionHead>THREAT SCORE</SectionHead>
              <button onClick={refresh} style={{ background:"none", border:"none", cursor:"pointer", fontFamily:MONO, fontSize:8, color:"#3a3a3c", letterSpacing:1 }}>↺ REFRESH</button>
            </div>
            <div style={{ display:"flex", alignItems:"flex-end", gap:10, marginBottom:8 }}>
              <div style={{ fontFamily:DISPLAY, fontSize:68, lineHeight:1, color:score.score>=75?"#ff2d55":score.score>=50?"#ff9f0a":score.score>=25?"#ffd60a":"#30d158" }}>
                {score.score}
              </div>
              <div style={{ paddingBottom:10 }}>
                <div style={{ fontFamily:MONO, fontSize:10, color:TREND_COLOR[score.trend]||"#ffd60a", fontWeight:700, marginBottom:2 }}>{score.trend}</div>
                <div style={{ fontFamily:MONO, fontSize:8, color:"#3a3a3c" }}>/100 · {score.source==="claude"?"CLAUDE AI":"DEMO"}</div>
              </div>
            </div>
            <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:2, overflow:"hidden", marginBottom:8 }}>
              <div style={{ height:"100%", width:`${score.score}%`, background:score.score>=75?"linear-gradient(90deg,#ff9f0a,#ff2d55)":"linear-gradient(90deg,#30d158,#ffd60a)", borderRadius:2, transition:"width 1s" }}/>
            </div>
            <div style={{ fontFamily:MONO, fontSize:11, color:"#c7c7cc", fontStyle:"italic", lineHeight:1.5 }}>"{score.oneLiner}"</div>
          </div>
          <Divider/>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:12 }}>
            {[
              {l:"CIVILIAN RISK",  v:score.civilianRisk,      c:score.civilianRisk==="EXTREME"?"#ff2d55":score.civilianRisk==="HIGH"?"#ff9f0a":"#ffd60a"},
              {l:"SPILLOVER RISK", v:score.regionalSpillover, c:score.regionalSpillover==="HIGH"?"#ff9f0a":"#ffd60a"},
              {l:"RISK LEVEL",     v:score.riskLevel,         c:SEV_COLOR[score.riskLevel]||"#ffd60a"},
              {l:"TREND",          v:score.trend,             c:TREND_COLOR[score.trend]||"#ffd60a"},
            ].map(({l,v,c}) => (
              <div key={l} style={{ background:"rgba(255,255,255,0.025)", padding:"7px 9px", borderRadius:3 }}>
                <div style={{ fontFamily:MONO, fontSize:7, color:"#3a3a3c", letterSpacing:2, marginBottom:3 }}>{l}</div>
                <div style={{ fontFamily:MONO, fontSize:10, color:c, fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
          {score.keyIndicators?.length > 0 && (
            <div style={{ marginBottom:12 }}>
              <SectionHead>KEY INDICATORS</SectionHead>
              {score.keyIndicators.map((ind,i) => (
                <div key={i} style={{ display:"flex", gap:8, alignItems:"flex-start", marginBottom:5 }}>
                  <span style={{ color:sevCol, fontSize:9, marginTop:1, flexShrink:0 }}>◆</span>
                  <span style={{ fontFamily:MONO, fontSize:10, color:"#8e8e93", lineHeight:1.5 }}>{ind}</span>
                </div>
              ))}
            </div>
          )}
          {score.escalationDrivers?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <SectionHead>ESCALATION DRIVERS</SectionHead>
              {score.escalationDrivers.map((d,i) => (
                <div key={i} style={{ padding:"5px 9px", marginBottom:4, borderLeft:"2px solid #ff2d5540", background:"rgba(255,45,85,0.04)", borderRadius:"0 3px 3px 0" }}>
                  <span style={{ fontFamily:MONO, fontSize:10, color:"#8e8e93" }}>↑ {d}</span>
                </div>
              ))}
            </div>
          )}
          {score.deescalationFactors?.length > 0 && (
            <div style={{ marginBottom:10 }}>
              <SectionHead>DE-ESCALATION FACTORS</SectionHead>
              {score.deescalationFactors.map((d,i) => (
                <div key={i} style={{ padding:"5px 9px", marginBottom:4, borderLeft:"2px solid #30d15840", background:"rgba(48,209,88,0.04)", borderRadius:"0 3px 3px 0" }}>
                  <span style={{ fontFamily:MONO, fontSize:10, color:"#8e8e93" }}>↓ {d}</span>
                </div>
              ))}
            </div>
          )}
          {score.analystNote && (
            <div style={{ padding:"10px 12px", background:"rgba(0,200,80,0.04)", border:"1px solid rgba(0,200,80,0.12)", borderRadius:4, marginBottom:10 }}>
              <SectionHead>ANALYST NOTE · CLAUDE AI</SectionHead>
              <div style={{ fontFamily:MONO, fontSize:10, color:"#8e8e93", lineHeight:1.7 }}>{score.analystNote}</div>
            </div>
          )}
          {wiki?.thumbnail?.source && (
            <img src={wiki.thumbnail.source} alt="" style={{ width:"100%", height:75, objectFit:"cover", borderRadius:3, opacity:0.65, marginBottom:8 }}/>
          )}
          <Divider/>
          <button onClick={() => navigate(`/region/${zone.slug}`)} style={{ width:"100%", padding:"7px", background:`${sevCol}12`, border:`1px solid ${sevCol}33`, color:sevCol, fontFamily:MONO, fontSize:8, letterSpacing:2, cursor:"pointer", borderRadius:3, marginBottom:6 }}>
            → FULL REGION INTELLIGENCE BRIEF
          </button>
          <div style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", paddingTop:6 }}>
            {score.generatedAt ? new Date(score.generatedAt).toUTCString().slice(0,25) : ""} · {score.source?.toUpperCase()}
          </div>
        </>
      ) : (
        <div style={{ fontFamily:MONO, fontSize:10, color:"#2a4a2a" }}>Analysis unavailable</div>
      )}
    </div>
  );
}

// ── INTEL PANEL ────────────────────────────────────────────────────────────────
export function IntelPanel({ zone, acledEvents }) {
  const wiki    = useWiki(zone?.wiki);
  const navigate = useNavigate();
  if (!zone) return <EmptyState msg="SELECT CONFLICT ZONE"/>;
  const col  = SEV_COLOR[zone.sev] || "#ffd60a";
  const q    = zone.name.split(/[\s–-]/)[0].toLowerCase();
  const zE   = acledEvents.filter(e => (e.country || "").toLowerCase().includes(q)).slice(0, 8);
  const zF   = zE.reduce((s, e) => s + e.fatalities, 0);
  return (
    <div style={{ height:"100%", overflowY:"auto", padding:"14px 16px" }}>
      <div style={{ fontFamily:MONO, fontSize:8, color:"#2a4a2a", letterSpacing:3, marginBottom:5 }}>
        INTEL // {new Date().toUTCString().slice(0,25).toUpperCase()}
      </div>
      <div style={{ fontFamily:MONO, fontSize:14, color:col, fontWeight:700, letterSpacing:1, marginBottom:8 }}>{zone.name.toUpperCase()}</div>
      <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
        {[zone.sev, zone.type, zone.region].map(t => (
          <span key={t} style={{ fontSize:7, padding:"2px 6px", borderRadius:2, background:"rgba(255,255,255,0.04)", color:"#636366", fontFamily:MONO, letterSpacing:1 }}>{t}</span>
        ))}
      </div>
      <Divider color={col+"33"}/>
      {zE.length > 0 && (
        <div style={{ marginBottom:14 }}>
          <SectionHead>LIVE EVENTS (30 DAYS)</SectionHead>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginBottom:8 }}>
            {[{k:"EVENTS",v:zE.length},{k:"FATALITIES",v:zF}].map(({k,v}) => (
              <div key={k} style={{ background:"rgba(255,255,255,0.03)", padding:"7px 9px", borderRadius:3 }}>
                <div style={{ fontFamily:MONO, fontSize:7, color:"#3a3a3c", letterSpacing:2, marginBottom:3 }}>{k}</div>
                <div style={{ fontFamily:MONO, fontSize:14, color:col }}>{v}</div>
              </div>
            ))}
          </div>
          {zE.slice(0,5).map((e,i) => (
            <div key={i} style={{ padding:"6px 9px", marginBottom:4, background:"rgba(255,255,255,0.02)", borderLeft:`2px solid ${ACLED_COLORS[e.type]||"#636366"}44`, borderRadius:"0 3px 3px 0" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:2 }}>
                <span style={{ fontFamily:MONO, fontSize:8, color:ACLED_COLORS[e.type]||"#636366" }}>{e.type?.split("/")[0]||e.type}</span>
                <span style={{ fontFamily:MONO, fontSize:8, color:"#3a3a3c" }}>{e.date}</span>
              </div>
              <div style={{ fontFamily:MONO, fontSize:9, color:"#8e8e93" }}>{e.location} · ☠ {e.fatalities}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom:12 }}>
        <SectionHead>SITUATION BRIEF · WIKIPEDIA</SectionHead>
        {!wiki ? (
          <div style={{ fontFamily:MONO, fontSize:10, color:"#2a4a2a" }}>Loading...</div>
        ) : (
          <>
            {wiki.thumbnail?.source && <img src={wiki.thumbnail.source} alt="" style={{ width:"100%", height:80, objectFit:"cover", borderRadius:3, marginBottom:8, opacity:0.75 }}/>}
            <div style={{ fontFamily:MONO, fontSize:10, color:"#8e8e93", lineHeight:1.7 }}>{wiki.extract?.slice(0,360)}...</div>
          </>
        )}
      </div>
      <Divider/>
      <button onClick={() => navigate(`/region/${zone.slug}`)} style={{ width:"100%", padding:"7px", background:`${col}12`, border:`1px solid ${col}33`, color:col, fontFamily:MONO, fontSize:8, letterSpacing:2, cursor:"pointer", borderRadius:3, marginBottom:10 }}>
        → FULL REGION ANALYSIS
      </button>
      <SectionHead>INTELLIGENCE SOURCES</SectionHead>
      {[
        {label:"GDELT GEO Events",    url:`https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(zone.kw)}&mode=pointdata&format=geojson`},
        {label:"GDELT Global Events", url:`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(zone.kw)}&mode=artlist&format=html`},
        {label:"Crisis Group Monitor",url:"https://www.crisisgroup.org/crisiswatch"},
        {label:"UN OCHA Reports",     url:`https://reliefweb.int/updates?search=${encodeURIComponent(zone.name)}`},
        {label:"ISW Daily Assessment",url:"https://www.understandingwar.org"},
      ].map(l => (
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"6px 10px", marginBottom:4, borderRadius:3, background:"rgba(255,255,255,0.02)", textDecoration:"none", transition:"background 0.12s" }}
          onMouseEnter={e => e.currentTarget.style.background = "rgba(0,200,80,0.06)"}
          onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
        >
          <span style={{ fontFamily:MONO, fontSize:10, color:"#636366" }}>{l.label}</span>
          <span style={{ color:"#3a3a3c" }}>↗</span>
        </a>
      ))}
    </div>
  );
}

// ── SIGNAL TRACKER ─────────────────────────────────────────────────────────────
export function SignalTracker({ signals, loading }) {
  const [q, setQ] = useState("");
  const filtered  = useMemo(() => !q ? signals : signals.filter(s =>
    s.title.toLowerCase().includes(q.toLowerCase()) ||
    s.src.name.toLowerCase().includes(q.toLowerCase())
  ), [signals, q]);

  if (loading) return <Loader msg="AGGREGATING SIGNAL FEEDS"/>;
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"7px 12px", borderBottom:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="FILTER SIGNALS..."
          style={{ width:"100%", padding:"5px 8px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(0,200,80,0.14)", borderRadius:3, color:"#c7c7cc", fontFamily:MONO, fontSize:10, letterSpacing:1, outline:"none" }}/>
      </div>
      <div style={{ display:"flex", gap:4, padding:"5px 12px", flexWrap:"wrap", flexShrink:0, borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
        {RSS_FEEDS.map(f => {
          const n = signals.filter(s => s.src.name === f.name).length;
          return <span key={f.name} style={{ fontSize:7, padding:"2px 7px", borderRadius:10, background:f.color+"18", color:f.color, fontFamily:MONO }}>{f.icon} {n}</span>;
        })}
        <span style={{ fontSize:7, color:"#3a3a3c", fontFamily:MONO, marginLeft:"auto", padding:"2px 0" }}>{filtered.length} signals</span>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.map((item, i) => (
          <div key={item.id||i} style={{ padding:"10px 12px", borderBottom:"1px solid rgba(255,255,255,0.04)", transition:"background 0.12s" }}
            onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
            onMouseLeave={e => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ display:"flex", gap:9 }}>
              <div style={{ width:32, height:32, borderRadius:"50%", flexShrink:0, background:item.src.color+"1a", border:`1.5px solid ${item.src.color}44`, display:"flex", alignItems:"center", justifyContent:"center", fontFamily:MONO, fontSize:9, color:item.src.color, fontWeight:700 }}>
                {item.src.icon}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", gap:6, alignItems:"center", marginBottom:3 }}>
                  <span style={{ fontFamily:MONO, fontSize:10, color:"#d1d1d6", fontWeight:600 }}>{item.src.name}</span>
                  <span style={{ fontFamily:MONO, fontSize:9, color:"#3a3a3c" }}>{item.src.handle}</span>
                  <span style={{ fontFamily:MONO, fontSize:9, color:"#3a3a3c", marginLeft:"auto" }}>{timeAgo(item.date)}</span>
                </div>
                <div style={{ fontFamily:MONO, fontSize:10, color:"#c7c7cc", lineHeight:1.6, marginBottom:4 }}>{item.title}</div>
                <a href={item.link} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily:MONO, fontSize:9, color:"#3a3a3c", textDecoration:"none", letterSpacing:1 }}
                  onMouseEnter={e => e.target.style.color = "#00c864"}
                  onMouseLeave={e => e.target.style.color = "#3a3a3c"}
                >↗ FULL REPORT</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ACLED FEED ─────────────────────────────────────────────────────────────────
export function ACLEDFeed({ events, loading, source }) {
  const [filter, setFilter] = useState("ALL");
  const types    = useMemo(() => [...new Set(events.map(e => e.type))], [events]);
  const filtered = useMemo(() => filter === "ALL" ? events : events.filter(e => e.type === filter), [events, filter]);

  if (loading) return <Loader msg="LOADING EVENT DATA"/>;
  return (
    <div style={{ height:"100%", display:"flex", flexDirection:"column" }}>
      <div style={{ padding:"6px 12px", borderBottom:"1px solid rgba(255,255,255,0.04)", flexShrink:0 }}>
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", alignItems:"center" }}>
          {["ALL", ...types.slice(0,4)].map(t => {
            const c  = ACLED_COLORS[t] || "#00c864";
            const on = filter === t;
            return (
              <button key={t} onClick={() => setFilter(t)} style={{ padding:"2px 7px", fontSize:7, letterSpacing:1, cursor:"pointer", borderRadius:2, border:`1px solid ${on?c:"rgba(255,255,255,0.07)"}`, background:on?c+"18":"transparent", color:on?c:"#3a3a3c", fontFamily:MONO }}>
                {t === "ALL" ? "ALL" : t.split("/")[0].split(" ")[0].toUpperCase()}
              </button>
            );
          })}
          <span style={{ fontFamily:MONO, fontSize:7, color:"#2a4a2a", marginLeft:"auto" }}>
            {source==="demo"?"DEMO DATA":source==="gdelt_geo"?"GDELT LIVE":source?.includes("reliefweb")?"UN/OCHA LIVE":"LIVE"} · {filtered.length}
          </span>
        </div>
      </div>
      <div style={{ flex:1, overflowY:"auto" }}>
        {filtered.slice(0,150).map((e, i) => {
          const col = ACLED_COLORS[e.type] || "#636366";
          return (
            <div key={e.id||i} style={{ padding:"8px 12px", borderBottom:"1px solid rgba(255,255,255,0.03)", transition:"background 0.12s" }}
              onMouseEnter={ev => ev.currentTarget.style.background = "rgba(255,255,255,0.015)"}
              onMouseLeave={ev => ev.currentTarget.style.background = "transparent"}
            >
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <span style={{ fontFamily:MONO, fontSize:8, padding:"1px 5px", borderRadius:2, background:col+"20", color:col }}>
                  {(e.type||"").split("/")[0]}
                </span>
                <span style={{ fontFamily:MONO, fontSize:8, color:"#3a3a3c" }}>{e.date}</span>
              </div>
              <div style={{ fontFamily:MONO, fontSize:10, color:"#c7c7cc", marginBottom:3 }}>{e.location}, {e.country}</div>
              <div style={{ display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontFamily:MONO, fontSize:9, color:"#636366" }}>{e.actor1}{e.actor2?` vs ${e.actor2}`:""}</span>
                {e.fatalities > 0 && <span style={{ fontFamily:MONO, fontSize:9, color:"#ff2d55" }}>☠ {e.fatalities}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
