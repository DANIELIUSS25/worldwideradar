import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";

const API_BASE   = "/.netlify/functions";
const REFRESH_MS = 5 * 60 * 1000;
const W = 920, H = 470;

const RSS_FEEDS = [
  { url:"https://feeds.reuters.com/reuters/worldNews",name:"Reuters",handle:"@Reuters",icon:"R",color:"#ff8c00" },
  { url:"https://www.aljazeera.com/xml/rss/all.xml",name:"Al Jazeera",handle:"@AJEnglish",icon:"AJ",color:"#00a651" },
  { url:"http://feeds.bbci.co.uk/news/world/rss.xml",name:"BBC World",handle:"@BBCWorld",icon:"B",color:"#bb1919" },
  { url:"https://news.un.org/feed/subscribe/en/news/topic/peace-and-security/feed/rss.xml",name:"UN News",handle:"@UN_News",icon:"UN",color:"#009edb"},
  { url:"https://rss.dw.com/rdf/rss-en-world",name:"DW News",handle:"@dwnews",icon:"DW",color:"#00bcff" },
];

const ZONES = [
  { id:1,  name:"Ukraine–Russia",  region:"Eastern Europe",  lat:49.0, lon:31.0,  sev:"CRITICAL", type:"CONVENTIONAL",  wiki:"Russian_invasion_of_Ukraine",       kw:"ukraine russia war" },
  { id:2,  name:"Gaza Conflict",   region:"Middle East",     lat:31.5, lon:34.5,  sev:"CRITICAL", type:"URBAN WARFARE",  wiki:"Gaza–Israel_conflict",              kw:"gaza israel war" },
  { id:3,  name:"Sudan Civil War", region:"North Africa",    lat:15.5, lon:32.5,  sev:"HIGH",     type:"CIVIL WAR",      wiki:"Sudanese_civil_war_(2023–present)", kw:"sudan rsf civil war" },
  { id:4,  name:"Myanmar War",     region:"Southeast Asia",  lat:19.0, lon:96.0,  sev:"HIGH",     type:"INSURGENCY",     wiki:"Myanmar_civil_war_(2021–present)",  kw:"myanmar junta civil war" },
  { id:5,  name:"Sahel Crisis",    region:"West Africa",     lat:14.0, lon:-1.0,  sev:"HIGH",     type:"JIHADIST",       wiki:"Insurgency_in_the_Sahel",           kw:"sahel mali jihadist" },
  { id:6,  name:"DRC / M23",       region:"Central Africa",  lat:-1.5, lon:28.5,  sev:"HIGH",     type:"MULTI-FACTION",  wiki:"M23_rebellion_(2021–present)",      kw:"drc congo m23" },
  { id:7,  name:"Yemen War",       region:"Middle East",     lat:15.5, lon:48.5,  sev:"HIGH",     type:"PROXY WAR",      wiki:"Yemeni_civil_war_(2014–present)",   kw:"yemen houthi war" },
  { id:8,  name:"South China Sea", region:"East Asia",       lat:15.0, lon:114.0, sev:"MEDIUM",   type:"TERRITORIAL",    wiki:"South_China_Sea_disputes",          kw:"south china sea" },
  { id:9,  name:"Taiwan Strait",   region:"East Asia",       lat:24.0, lon:121.0, sev:"MEDIUM",   type:"TERRITORIAL",    wiki:"Cross-strait_relations",            kw:"taiwan china strait" },
  { id:10, name:"Somalia",         region:"East Africa",     lat:5.0,  lon:46.0,  sev:"MEDIUM",   type:"INSURGENCY",     wiki:"Al-Shabaab_(militant_group)",       kw:"somalia al-shabaab" },
  { id:11, name:"Haiti Crisis",    region:"Caribbean",       lat:18.9, lon:-72.3, sev:"MEDIUM",   type:"GANG WARFARE",   wiki:"2024_Haitian_political_crisis",     kw:"haiti gang crisis" },
  { id:12, name:"Ethiopia Amhara", region:"East Africa",     lat:11.0, lon:37.5,  sev:"MEDIUM",   type:"INSURGENCY",     wiki:"2023_Amhara_unrest",                kw:"ethiopia amhara fano" },
];

const SEV_COLOR = { CRITICAL:"#ff2d55", HIGH:"#ff9f0a", MEDIUM:"#ffd60a", LOW:"#30d158" };
const ACLED_COLORS = {
  "Battles":"#ff2d55",
  "Explosions/Remote violence":"#ff6b35",
  "Violence against civilians":"#ff9f0a",
  "Protests":"#ffd60a",
  "Riots":"#bf5af2",
  "Strategic developments":"#0a84ff",
};
const TREND_COLOR = { ESCALATING:"#ff2d55", VOLATILE:"#ff9f0a", STABLE:"#ffd60a", "DE-ESCALATING":"#30d158" };

const PROJ = d3.geoNaturalEarth1().scale(152).translate([W/2, H/2]);
function pt(lat, lon) {
  try { const [x,y] = PROJ([lon,lat]); return isNaN(x)||isNaN(y) ? null : [x,y]; } catch { return null; }
}

// ── HOOKS ──────────────────────────────────────────────────────────────────────

function useWorldMap(svgRef) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!svgRef.current) return;
    let alive = true;
    const loadTopo = () => new Promise(res => {
      if (window.topojson) return res();
      const s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/topojson/3.0.2/topojson.min.js";
      s.onload = res; s.onerror = res;
      document.head.appendChild(s);
    });
    (async () => {
      await loadTopo();
      try {
        const world = await fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json").then(r=>r.json());
        if (!alive) return;
        const path = d3.geoPath().projection(PROJ);
        const svg  = d3.select(svgRef.current);
        const ctry = window.topojson.feature(world, world.objects.countries);
        const bord = window.topojson.mesh(world, world.objects.countries, (a,b)=>a!==b);
        svg.select("#sphere").attr("d", path({type:"Sphere"}));
        svg.select("#graticule").attr("d", path(d3.geoGraticule()()));
        svg.select("#land").selectAll("path").data(ctry.features).join("path").attr("d",path).attr("fill","#0d2236").attr("stroke","none");
        svg.select("#borders").attr("d", path(bord));
        setReady(true);
      } catch(e) {  }
    })();
    return () => { alive = false; };
  }, []);
  return ready;
}

function useACLED() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState("loading");
  const go = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/acled`);
      const d = await r.json();
      setEvents(d.events || []); setSource(d.source || "unknown");
    } catch(e) {  }
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return ()=>clearInterval(t); }, [go]);
  return { events, loading, source };
}

function useGDELT() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading] = useState(true);
  const go = useCallback(async () => {
    try {
      let r;
      try { r = await fetch(`${API_BASE}/gdelt`); } 
      catch { r = await fetch("https://api.gdeltproject.org/api/v2/doc/doc?query=war+attack+airstrike+military+conflict&mode=artlist&format=json&maxrecords=30&timespan=6h"); }
      const d = await r.json();
      setArticles(d.articles || []);
    } catch(e) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return ()=>clearInterval(t); }, [go]);
  return { articles, loading };
}

function useRSS() {
  const [signals, setSignals] = useState([]);
  const [loading, setLoading] = useState(true);
  const go = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/rss`);
      const d = await r.json();
      // Normalize dates
      const items = (d.signals || []).map(s => ({ ...s, date: new Date(s.date) }));
      setSignals(items);
    } catch(e) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return ()=>clearInterval(t); }, [go]);
  return { signals, loading };
}

function useWiki(key) {
  const [data, setData] = useState(null);
  const cache = useRef({});
  useEffect(() => {
    if (!key) return;
    if (cache.current[key]) { setData(cache.current[key]); return; }
    setData(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${key}`)
      .then(r=>r.json()).then(d=>{cache.current[key]=d;setData(d);}).catch(()=>{});
  }, [key]);
  return data;
}

function useThreatScore(zone, acledEvents, gdeltArticles, signals, wikiText) {
  const [score, setScore] = useState(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef({});
  const SCORE_TTL = 20 * 60 * 1000;

  const analyze = useCallback(async () => {
    if (!zone) return;
    const cached = cache.current[zone.id];
    if (cached && Date.now()-cached.ts < SCORE_TTL) { setScore(cached.score); return; }
    setLoading(true);
    const q   = zone.name.split(/[\s–-]/)[0].toLowerCase();
    const zE  = acledEvents.filter(e=>(e.country||"").toLowerCase().includes(q)).slice(0,25);
    const zA  = gdeltArticles.filter(a=>(a.title||"").toLowerCase().includes(q)).slice(0,12);
    const zS  = signals.filter(s=>(s.title||"").toLowerCase().includes(q)).slice(0,8);
    try {
      const r = await fetch(`${API_BASE}/threat-score`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ zone, acledEvents:zE, gdeltArticles:zA, signals:zS, wikiSummary:wikiText||"" }),
      });
      const data = await r.json();
      cache.current[zone.id] = { score:data, ts:Date.now() };
      setScore(data);
    } catch(e) {  }
    setLoading(false);
  }, [zone?.id, acledEvents.length, gdeltArticles.length, signals.length, wikiText]);

  useEffect(() => { if (zone) analyze(); }, [zone?.id]);
  return { score, loading, refresh: analyze };
}

// ── UTILS ──────────────────────────────────────────────────────────────────────

function timeAgo(d) {
  if (!d) return "";
  const m = Math.floor((Date.now()-d)/60000);
  if (m<1) return "just now";
  if (m<60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h<24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}
function Spinner({ size=10, color="#00c864" }) {
  const [r,setR]=useState(0);
  useEffect(()=>{const t=setInterval(()=>setR(p=>(p+24)%360),50);return()=>clearInterval(t);},[]);
  return <span style={{ display:"inline-block",width:size,height:size,border:`1.5px solid ${color}33`,borderTop:`1.5px solid ${color}`,borderRadius:"50%",transform:`rotate(${r}deg)`,flexShrink:0 }}/>;
}
function Dot({ size=5, color="#00c864", glow=false }) {
  return <div style={{ width:size,height:size,borderRadius:"50%",background:color,boxShadow:glow?`0 0 6px ${color}`:"none",flexShrink:0 }}/>;
}
function SectionHead({ children }) {
  return <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2a4a2a",letterSpacing:3,marginBottom:8 }}>{children}</div>;
}
function Loader({ msg }) {
  const [d,setD]=useState("");
  useEffect(()=>{const t=setInterval(()=>setD(p=>p.length>=3?"":p+"."),400);return()=>clearInterval(t);},[]);
  return <div style={{ height:"100%",display:"flex",alignItems:"center",justifyContent:"center" }}><span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#2a4a2a",letterSpacing:3 }}>{msg}{d}</span></div>;
}
function EmptyState({ msg }) {
  return (
    <div style={{ height:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:10 }}>
      <svg width="36" height="36" viewBox="0 0 36 36" style={{ opacity:0.12 }}>
        <circle cx={18} cy={18} r={16} fill="none" stroke="#00c864" strokeWidth="1.5"/>
        <circle cx={18} cy={18} r={9} fill="none" stroke="#00c864" strokeWidth="1"/>
        <circle cx={18} cy={18} r={3.5} fill="#00c864"/>
        <line x1={18} y1={2} x2={18} y2={34} stroke="#00c864" strokeWidth="0.8"/>
        <line x1={2} y1={18} x2={34} y2={18} stroke="#00c864" strokeWidth="0.8"/>
      </svg>
      <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2a2a2e",letterSpacing:3 }}>{msg}</div>
    </div>
  );
}

// ── WORLD MAP ──────────────────────────────────────────────────────────────────

function WorldMap({ zones, acledEvents, selected, onSelect, filter, showACLED }) {
  const svgRef = useRef(null);
  const ready  = useWorldMap(svgRef);
  const [pulse, setPulse] = useState(0);
  useEffect(()=>{const t=setInterval(()=>setPulse(p=>p+1),900);return()=>clearInterval(t);},[]);
  const visZones  = filter==="ALL"?zones:zones.filter(z=>z.sev===filter);
  const visEvents = useMemo(()=>showACLED?acledEvents.slice(0,800):[], [acledEvents,showACLED]);
  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} style={{ width:"100%",height:"100%",display:"block" }}>
      <defs>
        <radialGradient id="bg" cx="50%" cy="50%" r="70%">
          <stop offset="0%" stopColor="#051a2e"/><stop offset="100%" stopColor="#020c18"/>
        </radialGradient>
        <pattern id="gp" width="36" height="24" patternUnits="userSpaceOnUse">
          <path d="M36 0L0 0 0 24" fill="none" stroke="rgba(0,200,80,0.035)" strokeWidth="0.5"/>
        </pattern>
        {["CRITICAL","HIGH","MEDIUM","LOW"].map(k=>(
          <filter key={k} id={`g${k}`}><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        ))}
        <filter id="ae"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <rect width={W} height={H} fill="url(#bg)"/>
      <rect width={W} height={H} fill="url(#gp)"/>
      <path id="sphere" fill="#061d35" stroke="rgba(0,200,80,0.12)" strokeWidth="0.8"/>
      <path id="graticule" fill="none" stroke="rgba(0,200,80,0.05)" strokeWidth="0.4"/>
      <g id="land"/>
      <path id="borders" fill="none" stroke="rgba(0,200,80,0.18)" strokeWidth="0.5"/>
      {!ready && <text x={W/2} y={H/2} textAnchor="middle" fill="#1a3a1a" fontSize="11" fontFamily="'Share Tech Mono',monospace" letterSpacing="4">LOADING NATURAL EARTH...</text>}
      {visEvents.map((e,i)=>{
        const c=pt(e.lat,e.lon); if(!c) return null;
        const col=ACLED_COLORS[e.type]||"#636366";
        const r=e.fatalities>20?3.2:e.fatalities>5?2.4:1.8;
        return <circle key={e.id||i} cx={c[0]} cy={c[1]} r={r} fill={col} opacity="0.5" filter="url(#ae)"/>;
      })}
      {visZones.map(z=>{
        const c=pt(z.lat,z.lon); if(!c) return null;
        const col=SEV_COLOR[z.sev]||"#ffd60a"; const sel=selected?.id===z.id; const odd=pulse%2===0;
        return (
          <g key={z.id} style={{ cursor:"pointer" }} onClick={()=>onSelect(z)}>
            <circle cx={c[0]} cy={c[1]} r={sel?25:19} fill="none" stroke={col} strokeWidth="0.8" opacity={odd?0.3:0.07} style={{transition:"opacity 0.7s"}}/>
            <circle cx={c[0]} cy={c[1]} r={sel?15:11} fill="none" stroke={col} strokeWidth="1.3" opacity={odd?0.65:0.22}/>
            <circle cx={c[0]} cy={c[1]} r={sel?5.5:4} fill={col} opacity="0.95" filter={`url(#g${z.sev})`}/>
            <line x1={c[0]-12} y1={c[1]} x2={c[0]-6} y2={c[1]} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]+6} y1={c[1]} x2={c[0]+12} y2={c[1]} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]} y1={c[1]-12} x2={c[0]} y2={c[1]-6} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            <line x1={c[0]} y1={c[1]+6} x2={c[0]} y2={c[1]+12} stroke={col} strokeWidth="0.8" opacity="0.4"/>
            {sel&&<text x={c[0]+16} y={c[1]-8} fill={col} fontSize="9" fontFamily="'Share Tech Mono',monospace" fontWeight="600">{z.name.toUpperCase()}</text>}
          </g>
        );
      })}
      {[[0,0,0],[W,0,90],[0,H,270],[W,H,180]].map(([x,y,r],i)=>(
        <g key={i} transform={`translate(${x},${y}) rotate(${r})`}>
          <line x1={8} y1={0} x2={30} y2={0} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
          <line x1={0} y1={8} x2={0} y2={30} stroke="#00c864" strokeWidth="1.2" opacity="0.16"/>
        </g>
      ))}
      <text x={10} y={H-6} fill="#1a3a1a" fontSize="7.5" fontFamily="'Share Tech Mono',monospace">PROJ: NATURAL EARTH · GDELT GEO + RELIEFWEB · WORLDWIDERADAR.COM</text>
    </svg>
  );
}

// ── THREAT SCORE PANEL ─────────────────────────────────────────────────────────

function ThreatScorePanel({ zone, acledEvents, gdeltArticles, signals }) {
  const wiki   = useWiki(zone?.wiki);
  const { score, loading, refresh } = useThreatScore(zone, acledEvents, gdeltArticles, signals, wiki?.extract||"");
  if (!zone) return <EmptyState msg="SELECT ZONE FOR AI ASSESSMENT"/>;
  const sevCol = SEV_COLOR[zone.sev]||"#ffd60a";
  return (
    <div style={{ height:"100%",overflowY:"auto",padding:"14px 16px" }}>
      <SectionHead>AI THREAT ASSESSMENT · CLAUDE ENGINE</SectionHead>
      <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:14,color:sevCol,fontWeight:700,letterSpacing:1,marginBottom:6 }}>{zone.name.toUpperCase()}</div>
      <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
        {[zone.sev,zone.type,zone.region].map(t=>(
          <span key={t} style={{ fontSize:7,padding:"2px 6px",borderRadius:2,background:"rgba(255,255,255,0.04)",color:"#636366",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1 }}>{t}</span>
        ))}
      </div>
      <div style={{ height:1,background:sevCol+"33",marginBottom:12 }}/>
      {loading ? (
        <div style={{ display:"flex",alignItems:"center",gap:10,padding:"24px 0" }}>
          <Spinner size={14} color="#00c864"/>
          <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#2a4a2a",letterSpacing:2 }}>CLAUDE ANALYZING ALL FEEDS...</span>
        </div>
      ) : score ? (
        <>
          {/* Score */}
          <div style={{ marginBottom:14 }}>
            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6 }}>
              <SectionHead>THREAT SCORE</SectionHead>
              <button onClick={refresh} style={{ background:"none",border:"none",cursor:"pointer",fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3a3a3c",letterSpacing:1 }}>↺ REFRESH</button>
            </div>
            <div style={{ display:"flex",alignItems:"flex-end",gap:10,marginBottom:8 }}>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:68,lineHeight:1,color:score.score>=75?"#ff2d55":score.score>=50?"#ff9f0a":score.score>=25?"#ffd60a":"#30d158" }}>{score.score}</div>
              <div style={{ paddingBottom:10 }}>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:TREND_COLOR[score.trend]||"#ffd60a",fontWeight:700,marginBottom:2 }}>{score.trend}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3a3a3c" }}>/100 · {score.source==="claude"?"CLAUDE AI":"DEMO"}</div>
              </div>
            </div>
            <div style={{ height:4,background:"rgba(255,255,255,0.06)",borderRadius:2,overflow:"hidden",marginBottom:8 }}>
              <div style={{ height:"100%",width:`${score.score}%`,background:score.score>=75?"linear-gradient(90deg,#ff9f0a,#ff2d55)":score.score>=50?"linear-gradient(90deg,#ffd60a,#ff9f0a)":"linear-gradient(90deg,#30d158,#ffd60a)",borderRadius:2,transition:"width 1s" }}/>
            </div>
            <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:11,color:"#c7c7cc",fontStyle:"italic",lineHeight:1.5 }}>"{score.oneLiner}"</div>
          </div>
          <div style={{ height:1,background:"rgba(255,255,255,0.05)",marginBottom:12 }}/>
          {/* Risk grid */}
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:12 }}>
            {[
              { l:"CIVILIAN RISK",     v:score.civilianRisk,      c:score.civilianRisk==="EXTREME"?"#ff2d55":score.civilianRisk==="HIGH"?"#ff9f0a":"#ffd60a" },
              { l:"SPILLOVER RISK",    v:score.regionalSpillover, c:score.regionalSpillover==="HIGH"?"#ff9f0a":"#ffd60a" },
              { l:"RISK LEVEL",        v:score.riskLevel,         c:SEV_COLOR[score.riskLevel]||"#ffd60a" },
              { l:"TREND",             v:score.trend,             c:TREND_COLOR[score.trend]||"#ffd60a" },
            ].map(({l,v,c})=>(
              <div key={l} style={{ background:"rgba(255,255,255,0.025)",padding:"7px 9px",borderRadius:3 }}>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#3a3a3c",letterSpacing:2,marginBottom:3 }}>{l}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:c,fontWeight:600 }}>{v}</div>
              </div>
            ))}
          </div>
          {score.keyIndicators?.length>0&&(
            <div style={{ marginBottom:12 }}>
              <SectionHead>KEY INDICATORS</SectionHead>
              {score.keyIndicators.map((ind,i)=>(
                <div key={i} style={{ display:"flex",gap:8,alignItems:"flex-start",marginBottom:5 }}>
                  <span style={{ color:sevCol,fontSize:9,marginTop:1,flexShrink:0 }}>◆</span>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#8e8e93",lineHeight:1.5 }}>{ind}</span>
                </div>
              ))}
            </div>
          )}
          {score.escalationDrivers?.length>0&&(
            <div style={{ marginBottom:10 }}>
              <SectionHead>ESCALATION DRIVERS</SectionHead>
              {score.escalationDrivers.map((d,i)=>(
                <div key={i} style={{ padding:"5px 9px",marginBottom:4,borderLeft:"2px solid #ff2d5540",background:"rgba(255,45,85,0.04)",borderRadius:"0 3px 3px 0" }}>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#8e8e93" }}>↑ {d}</span>
                </div>
              ))}
            </div>
          )}
          {score.deescalationFactors?.length>0&&(
            <div style={{ marginBottom:10 }}>
              <SectionHead>DE-ESCALATION FACTORS</SectionHead>
              {score.deescalationFactors.map((d,i)=>(
                <div key={i} style={{ padding:"5px 9px",marginBottom:4,borderLeft:"2px solid #30d15840",background:"rgba(48,209,88,0.04)",borderRadius:"0 3px 3px 0" }}>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#8e8e93" }}>↓ {d}</span>
                </div>
              ))}
            </div>
          )}
          {score.analystNote&&(
            <div style={{ padding:"10px 12px",background:"rgba(0,200,80,0.04)",border:"1px solid rgba(0,200,80,0.12)",borderRadius:4,marginBottom:10 }}>
              <SectionHead>ANALYST NOTE · CLAUDE AI</SectionHead>
              <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#8e8e93",lineHeight:1.7 }}>{score.analystNote}</div>
            </div>
          )}
          {wiki?.thumbnail?.source&&<img src={wiki.thumbnail.source} alt="" style={{ width:"100%",height:75,objectFit:"cover",borderRadius:3,opacity:0.65,marginBottom:8 }}/>}
          <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2a4a2a",paddingTop:8,borderTop:"1px solid rgba(255,255,255,0.04)" }}>
            {score.generatedAt?new Date(score.generatedAt).toUTCString().slice(0,25):""} · {score.source?.toUpperCase()}
          </div>
        </>
      ) : <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#2a4a2a" }}>Analysis unavailable</div>}
    </div>
  );
}

// ── INTEL PANEL ────────────────────────────────────────────────────────────────

function IntelPanel({ zone, acledEvents }) {
  const wiki = useWiki(zone?.wiki);
  if (!zone) return <EmptyState msg="SELECT CONFLICT ZONE"/>;
  const col = SEV_COLOR[zone.sev]||"#ffd60a";
  const q   = zone.name.split(/[\s–-]/)[0].toLowerCase();
  const zE  = acledEvents.filter(e=>(e.country||"").toLowerCase().includes(q)).slice(0,8);
  const zF  = zE.reduce((s,e)=>s+e.fatalities,0);
  return (
    <div style={{ height:"100%",overflowY:"auto",padding:"14px 16px" }}>
      <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#2a4a2a",letterSpacing:3,marginBottom:5 }}>INTEL // {new Date().toUTCString().slice(0,25).toUpperCase()}</div>
      <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:14,color:col,fontWeight:700,letterSpacing:1,marginBottom:8 }}>{zone.name.toUpperCase()}</div>
      <div style={{ display:"flex",gap:5,flexWrap:"wrap",marginBottom:10 }}>
        {[zone.sev,zone.type,zone.region].map(t=>(
          <span key={t} style={{ fontSize:7,padding:"2px 6px",borderRadius:2,background:"rgba(255,255,255,0.04)",color:"#636366",fontFamily:"'Share Tech Mono',monospace",letterSpacing:1 }}>{t}</span>
        ))}
      </div>
      <div style={{ height:1,background:col+"33",marginBottom:12 }}/>
      {zE.length>0&&(
        <div style={{ marginBottom:14 }}>
          <SectionHead>LIVE EVENTS (30 DAYS)</SectionHead>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:8 }}>
            {[{k:"EVENTS",v:zE.length},{k:"FATALITIES",v:zF}].map(({k,v})=>(
              <div key={k} style={{ background:"rgba(255,255,255,0.03)",padding:"7px 9px",borderRadius:3 }}>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#3a3a3c",letterSpacing:2,marginBottom:3 }}>{k}</div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:14,color:col }}>{v}</div>
              </div>
            ))}
          </div>
          {zE.slice(0,5).map((e,i)=>(
            <div key={i} style={{ padding:"6px 9px",marginBottom:4,background:"rgba(255,255,255,0.02)",borderLeft:`2px solid ${ACLED_COLORS[e.type]||"#636366"}44`,borderRadius:"0 3px 3px 0" }}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:2 }}>
                <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:ACLED_COLORS[e.type]||"#636366" }}>{e.type?.split("/")[0]||e.type}</span>
                <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3a3a3c" }}>{e.date}</span>
              </div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#8e8e93" }}>{e.location} · ☠ {e.fatalities}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ marginBottom:12 }}>
        <SectionHead>SITUATION BRIEF · WIKIPEDIA</SectionHead>
        {!wiki?<div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#2a4a2a" }}>Loading...</div>:(
          <>
            {wiki.thumbnail?.source&&<img src={wiki.thumbnail.source} alt="" style={{ width:"100%",height:80,objectFit:"cover",borderRadius:3,marginBottom:8,opacity:0.75 }}/>}
            <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#8e8e93",lineHeight:1.7 }}>{wiki.extract?.slice(0,360)}...</div>
          </>
        )}
      </div>
      <SectionHead>INTELLIGENCE SOURCES</SectionHead>
      {[
        {label:"ACLED Conflict Data",url:"https://acleddata.com/dashboard/"},
        {label:"GDELT Global Events",url:`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(zone.kw)}&mode=artlist&format=html`},
        {label:"Crisis Group Monitor",url:"https://www.crisisgroup.org/crisiswatch"},
        {label:"UN OCHA Reports",url:`https://reliefweb.int/updates?search=${encodeURIComponent(zone.name)}`},
        {label:"ISW Daily Assessment",url:"https://www.understandingwar.org"},
      ].map(l=>(
        <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",marginBottom:4,borderRadius:3,background:"rgba(255,255,255,0.02)",textDecoration:"none",transition:"background 0.12s" }}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(0,200,80,0.06)"}
          onMouseLeave={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
        >
          <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#636366" }}>{l.label}</span>
          <span style={{ color:"#3a3a3c" }}>↗</span>
        </a>
      ))}
    </div>
  );
}

// ── SIGNAL TRACKER ─────────────────────────────────────────────────────────────

function SignalTracker({ signals, loading }) {
  const [q,setQ]=useState("");
  const filtered=useMemo(()=>!q?signals:signals.filter(s=>s.title.toLowerCase().includes(q.toLowerCase())||s.src.name.toLowerCase().includes(q.toLowerCase())),[signals,q]);
  if (loading) return <Loader msg="AGGREGATING SIGNAL FEEDS"/>;
  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"7px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0 }}>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="FILTER SIGNALS..." style={{ width:"100%",padding:"5px 8px",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(0,200,80,0.14)",borderRadius:3,color:"#c7c7cc",fontFamily:"'Share Tech Mono',monospace",fontSize:10,letterSpacing:1,outline:"none" }}/>
      </div>
      <div style={{ display:"flex",gap:4,padding:"5px 12px",flexWrap:"wrap",flexShrink:0,borderBottom:"1px solid rgba(255,255,255,0.03)" }}>
        {RSS_FEEDS.map(f=>{
          const n=signals.filter(s=>s.src.name===f.name).length;
          return <span key={f.name} style={{ fontSize:7,padding:"2px 7px",borderRadius:10,background:f.color+"18",color:f.color,fontFamily:"'Share Tech Mono',monospace" }}>{f.icon} {n}</span>;
        })}
        <span style={{ fontSize:7,color:"#3a3a3c",fontFamily:"'Share Tech Mono',monospace",marginLeft:"auto",padding:"2px 0" }}>{filtered.length} signals</span>
      </div>
      <div style={{ flex:1,overflowY:"auto" }}>
        {filtered.map((item,i)=>(
          <div key={item.id||i} style={{ padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",transition:"background 0.12s" }}
            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.02)"}
            onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
            <div style={{ display:"flex",gap:9 }}>
              <div style={{ width:32,height:32,borderRadius:"50%",flexShrink:0,background:item.src.color+"1a",border:`1.5px solid ${item.src.color}44`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:item.src.color,fontWeight:700 }}>{item.src.icon}</div>
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ display:"flex",gap:6,alignItems:"center",marginBottom:3 }}>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#d1d1d6",fontWeight:600 }}>{item.src.name}</span>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#3a3a3c" }}>{item.src.handle}</span>
                  <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#3a3a3c",marginLeft:"auto" }}>{timeAgo(item.date)}</span>
                </div>
                <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#c7c7cc",lineHeight:1.6,marginBottom:4 }}>{item.title}</div>
                <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#3a3a3c",textDecoration:"none",letterSpacing:1 }} onMouseEnter={e=>e.target.style.color="#00c864"} onMouseLeave={e=>e.target.style.color="#3a3a3c"}>↗ FULL REPORT</a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ACLED FEED ─────────────────────────────────────────────────────────────────

function ACLEDFeed({ events, loading, source }) {
  const [filter,setFilter]=useState("ALL");
  const types=useMemo(()=>[...new Set(events.map(e=>e.type))],[events]);
  const filtered=useMemo(()=>filter==="ALL"?events:events.filter(e=>e.type===filter),[events,filter]);
  if (loading) return <Loader msg="LOADING EVENT DATA"/>;
  return (
    <div style={{ height:"100%",display:"flex",flexDirection:"column" }}>
      <div style={{ padding:"6px 12px",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0 }}>
        <div style={{ display:"flex",gap:4,flexWrap:"wrap",alignItems:"center" }}>
          {["ALL",...types.slice(0,4)].map(t=>{
            const c=ACLED_COLORS[t]||"#00c864"; const on=filter===t;
            return <button key={t} onClick={()=>setFilter(t)} style={{ padding:"2px 7px",fontSize:7,letterSpacing:1,cursor:"pointer",borderRadius:2,border:`1px solid ${on?c:"rgba(255,255,255,0.07)"}`,background:on?c+"18":"transparent",color:on?c:"#3a3a3c",fontFamily:"'Share Tech Mono',monospace" }}>{t==="ALL"?"ALL":t.split("/")[0].split(" ")[0].toUpperCase()}</button>;
          })}
          <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:7,color:"#2a4a2a",marginLeft:"auto" }}>{source==="demo"?"DEMO DATA":source==="gdelt_geo"?"GDELT LIVE":source.includes("reliefweb")?"UN/OCHA LIVE":"LIVE"} · {filtered.length}</span>
        </div>
      </div>
      <div style={{ flex:1,overflowY:"auto" }}>
        {filtered.slice(0,150).map((e,i)=>{
          const col=ACLED_COLORS[e.type]||"#636366";
          return (
            <div key={e.id||i} style={{ padding:"8px 12px",borderBottom:"1px solid rgba(255,255,255,0.03)",transition:"background 0.12s" }}
              onMouseEnter={ev=>ev.currentTarget.style.background="rgba(255,255,255,0.015)"}
              onMouseLeave={ev=>ev.currentTarget.style.background="transparent"}>
              <div style={{ display:"flex",justifyContent:"space-between",marginBottom:3 }}>
                <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,padding:"1px 5px",borderRadius:2,background:col+"20",color:col }}>{(e.type||"").split("/")[0]}</span>
                <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:8,color:"#3a3a3c" }}>{e.date}</span>
              </div>
              <div style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#c7c7cc",marginBottom:3 }}>{e.location}, {e.country}</div>
              <div style={{ display:"flex",justifyContent:"space-between" }}>
                <span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#636366" }}>{e.actor1}{e.actor2?` vs ${e.actor2}`:""}</span>
                {e.fatalities>0&&<span style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#ff2d55" }}>☠ {e.fatalities}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── TICKER ─────────────────────────────────────────────────────────────────────

function Ticker({ articles, signals, acledEvents }) {
  const items=useMemo(()=>{
    const a=articles.slice(0,8).map(a=>`[GDELT·${a.domain}] ${a.title}`);
    const s=signals.slice(0,8).map(s=>`[${s.src.name.toUpperCase()}] ${s.title}`);
    const e=acledEvents.slice(0,5).map(e=>`[ACLED] ${e.type}: ${e.location}, ${e.country} — ☠ ${e.fatalities}`);
    const all=[...a,...s,...e];
    return all.length?all:["CONNECTING TO LIVE FEEDS — STANDBY..."];
  },[articles,signals,acledEvents]);
  const ref=useRef(null); const pos=useRef(0); const raf=useRef(null);
  useEffect(()=>{
    const el=ref.current; if(!el) return; pos.current=0;
    const step=()=>{ pos.current-=0.45; if(el.scrollWidth&&Math.abs(pos.current)>=el.scrollWidth/2) pos.current=0; el.style.transform=`translateX(${pos.current}px)`; raf.current=requestAnimationFrame(step); };
    raf.current=requestAnimationFrame(step); return()=>cancelAnimationFrame(raf.current);
  },[items]);
  return (
    <div style={{ overflow:"hidden",padding:"5px 0",background:"rgba(0,0,0,0.55)",borderTop:"1px solid rgba(0,200,100,0.1)",flexShrink:0 }}>
      <div ref={ref} style={{ display:"inline-block",whiteSpace:"nowrap" }}>
        {[...items,...items].map((t,i)=>(
          <span key={i} style={{ fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#636366",marginRight:60 }}>
            <span style={{ color:"#00c864",marginRight:8 }}>◆</span><span style={{ color:"#c7c7cc" }}>{t}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── MAIN APP ───────────────────────────────────────────────────────────────────

export default function WorldwideRadar() {
  const [sel,setSel]=useState(null);
  const [filter,setFilter]=useState("ALL");
  const [tab,setTab]=useState("THREAT");
  const [showACLED,setShowACLED]=useState(true);
  const [clock,setClock]=useState("");
  const [blink,setBlink]=useState(true);

  const {events:acledEvents,loading:aLoad,source:aSource}=useACLED();
  const {articles,loading:gLoad}=useGDELT();
  const {signals,loading:rLoad}=useRSS();

  useEffect(()=>{
    setClock(new Date().toUTCString().slice(17,25));
    const t1=setInterval(()=>setClock(new Date().toUTCString().slice(17,25)),1000);
    const t2=setInterval(()=>setBlink(b=>!b),800);
    return()=>{ clearInterval(t1); clearInterval(t2); };
  },[]);

  const sevCnt=useMemo(()=>({CRITICAL:ZONES.filter(z=>z.sev==="CRITICAL").length,HIGH:ZONES.filter(z=>z.sev==="HIGH").length,MEDIUM:ZONES.filter(z=>z.sev==="MEDIUM").length}),[]);

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Bebas+Neue&display=swap');*{box-sizing:border-box;margin:0;padding:0}::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(0,200,80,0.2)}html,body,#root{width:100%;height:100%;overflow:hidden;background:#000}input::placeholder{color:#2a4a2a;letter-spacing:2px}`}</style>
      <div style={{ position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,background:"repeating-linear-gradient(0deg,transparent,transparent 3px,rgba(0,255,80,0.01) 3px,rgba(0,255,80,0.01) 4px)" }}/>
      <div style={{ width:"100vw",height:"100vh",background:"#020c18",display:"flex",flexDirection:"column",color:"#ebebf0",overflow:"hidden",fontFamily:"'Share Tech Mono',monospace" }}>

        {/* TOP BAR */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",height:52,padding:"0 18px",flexShrink:0,background:"rgba(0,0,0,0.75)",borderBottom:"1px solid rgba(0,200,80,0.2)" }}>
          <div style={{ display:"flex",alignItems:"center",gap:12 }}>
            <svg width="32" height="32" viewBox="0 0 32 32">
              <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
              <circle cx={16} cy={16} r={9} fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
              <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
              <line x1={16} y1={2} x2={16} y2={30} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
              <line x1={2} y1={16} x2={30} y2={16} stroke="#00c864" strokeWidth="0.8" opacity="0.3"/>
            </svg>
            <div>
              <div style={{ fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:5,color:"#00c864",lineHeight:1 }}>WORLDWIDE RADAR</div>
              <div style={{ fontSize:7,color:"#1a3a1a",letterSpacing:4,marginTop:1 }}>GLOBAL CONFLICT INTELLIGENCE · GDELT GEO · RELIEFWEB · CLAUDE AI THREAT ENGINE</div>
            </div>
          </div>
          <div style={{ display:"flex",gap:24 }}>
            {[
              {l:"LIVE EVENTS",v:acledEvents.length||"...",c:"#ff9f0a",spin:aLoad},
              {l:"LIVE SIGNALS",v:signals.length||"...",c:"#ffd60a",spin:rLoad},
              {l:"GDELT (6H)",v:articles.length||"...",c:"#0a84ff",spin:gLoad},
              {l:"THREAT LEVEL",v:"ELEVATED",c:"#ff9f0a",spin:false},
            ].map(s=>(
              <div key={s.l} style={{ textAlign:"center" }}>
                <div style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:4,marginBottom:2 }}>
                  {s.spin&&<Spinner size={7} color={s.c}/>}
                  <span style={{ fontSize:7,color:"#1a3a1a",letterSpacing:2 }}>{s.l}</span>
                </div>
                <div style={{ fontSize:15,color:s.c,fontWeight:700,letterSpacing:1 }}>{s.v}</div>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"right" }}>
            <div style={{ fontSize:19,letterSpacing:2 }}>{clock}<span style={{ color:blink?"#00c864":"transparent",marginLeft:5,fontSize:9 }}>●</span></div>
            <div style={{ fontSize:7,color:"#1a3a1a",letterSpacing:2 }}>COORDINATED UNIVERSAL TIME</div>
          </div>
        </div>

        {/* FILTER BAR */}
        <div style={{ display:"flex",alignItems:"center",gap:5,padding:"5px 16px",background:"rgba(0,0,0,0.4)",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0,flexWrap:"wrap" }}>
          <span style={{ fontSize:7,color:"#1a3a1a",letterSpacing:3,marginRight:4 }}>SEVERITY:</span>
          {["ALL","CRITICAL","HIGH","MEDIUM"].map(f=>{
            const c=SEV_COLOR[f]||"#00c864"; const on=filter===f;
            return <button key={f} onClick={()=>setFilter(f)} style={{ padding:"2px 9px",fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2,border:`1px solid ${on?c:"rgba(255,255,255,0.06)"}`,background:on?c+"20":"transparent",color:on?c:"#3a3a3c",fontFamily:"'Share Tech Mono',monospace",transition:"all 0.12s" }}>{f}{f!=="ALL"&&<span style={{ opacity:0.6,marginLeft:4 }}>({sevCnt[f]})</span>}</button>;
          })}
          <div style={{ width:1,height:16,background:"rgba(255,255,255,0.06)",margin:"0 4px" }}/>
          <button onClick={()=>setShowACLED(v=>!v)} style={{ display:"flex",alignItems:"center",gap:4,padding:"2px 9px",fontSize:7,letterSpacing:2,cursor:"pointer",borderRadius:2,border:`1px solid ${showACLED?"#ff9f0a":"rgba(255,255,255,0.06)"}`,background:showACLED?"rgba(255,159,10,0.1)":"transparent",color:showACLED?"#ff9f0a":"#3a3a3c",fontFamily:"'Share Tech Mono',monospace" }}>
            <Dot size={5} color="#ff9f0a"/>EVENTS {showACLED?"ON":"OFF"}
          </button>
          {showACLED&&Object.entries(ACLED_COLORS).slice(0,4).map(([type,color])=>(
            <div key={type} style={{ display:"flex",alignItems:"center",gap:3 }}>
              <div style={{ width:6,height:6,borderRadius:"50%",background:color }}/>
              <span style={{ fontSize:7,color:"#3a3a3c" }}>{type.split("/")[0].split(" ").slice(0,2).join(" ")}</span>
            </div>
          ))}
          <div style={{ flex:1 }}/>
          {[{label:"EVENTS",color:aSource==="demo"?"#ff9f0a":"#00c864",on:!aLoad,title:aSource==="demo"?"EVENTS DEMO":aSource==="gdelt_geo"?"GDELT LIVE":aSource.includes("reliefweb")?"UN/OCHA LIVE":"EVENTS LIVE"},{label:"GDELT",color:"#00c864",on:!gLoad},{label:"RSS",color:"#ffd60a",on:!rLoad},{label:"WIKI",color:"#0a84ff",on:true}].map(s=>(
            <div key={s.label} style={{ display:"flex",alignItems:"center",gap:4,padding:"2px 7px",borderRadius:2,background:"rgba(255,255,255,0.03)" }}>
              <Dot size={5} color={s.on?s.color:"#3a3a3c"} glow={s.on&&s.color==="#00c864"}/>
              <span style={{ fontSize:7,color:s.on?s.color:"#3a3a3c",letterSpacing:1 }}>{s.title||s.label}</span>
            </div>
          ))}
        </div>

        {/* MAIN */}
        <div style={{ flex:1,display:"flex",overflow:"hidden",minHeight:0 }}>
          {/* LEFT */}
          <div style={{ width:210,flexShrink:0,display:"flex",flexDirection:"column",background:"rgba(0,0,0,0.45)",borderRight:"1px solid rgba(0,200,80,0.1)" }}>
            <div style={{ padding:"8px 12px 5px",borderBottom:"1px solid rgba(255,255,255,0.04)",flexShrink:0 }}>
              <div style={{ fontSize:8,color:"#1a3a1a",letterSpacing:3 }}>CONFLICT ZONES</div>
              <div style={{ fontSize:9,color:"#3a3a3c",marginTop:1 }}>{ZONES.filter(z=>filter==="ALL"||z.sev===filter).length} monitored</div>
            </div>
            <div style={{ flex:1,overflowY:"auto" }}>
              {ZONES.filter(z=>filter==="ALL"||z.sev===filter).map(z=>{
                const c=SEV_COLOR[z.sev]||"#ffd60a"; const on=sel?.id===z.id;
                const q2=z.name.split(/[\s–-]/)[0].toLowerCase();
                const cnt=acledEvents.filter(e=>(e.country||"").toLowerCase().includes(q2)).length;
                return (
                  <div key={z.id} onClick={()=>{setSel(z);setTab("THREAT");}} style={{ padding:"9px 12px",cursor:"pointer",borderLeft:`3px solid ${on?c:"transparent"}`,background:on?c+"0c":"transparent",transition:"all 0.12s" }}
                    onMouseEnter={e=>!on&&(e.currentTarget.style.background="rgba(255,255,255,0.02)")}
                    onMouseLeave={e=>!on&&(e.currentTarget.style.background="transparent")}>
                    <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2 }}>
                      <span style={{ fontSize:10,color:"#d1d1d6",fontWeight:600 }}>{z.name}</span>
                      <span style={{ fontSize:7,padding:"1px 5px",borderRadius:2,background:c+"20",color:c }}>{z.sev}</span>
                    </div>
                    <div style={{ display:"flex",justifyContent:"space-between" }}>
                      <span style={{ fontSize:8,color:"#3a3a3c" }}>{z.type}</span>
                      {cnt>0&&<span style={{ fontSize:7,color:"#ff9f0a" }}>{cnt} events</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* MAP */}
          <div style={{ flex:1,overflow:"hidden",minWidth:0 }}>
            <WorldMap zones={ZONES} acledEvents={acledEvents} selected={sel} onSelect={z=>{setSel(z);setTab("THREAT");}} filter={filter} showACLED={showACLED}/>
          </div>

          {/* RIGHT */}
          <div style={{ width:298,flexShrink:0,display:"flex",flexDirection:"column",background:"rgba(0,0,0,0.5)",borderLeft:"1px solid rgba(0,200,80,0.1)" }}>
            <div style={{ display:"flex",borderBottom:"1px solid rgba(255,255,255,0.05)",flexShrink:0 }}>
              {[
                {id:"THREAT",label:"AI THREAT"},
                {id:"INTEL",label:"INTEL"},
                {id:"SIGNALS",label:`SIGNALS${signals.length?` (${signals.length})`:""}` },
                {id:"ACLED",label:`EVENTS${acledEvents.length?` (${acledEvents.length})`:""}` },
              ].map(t=>(
                <button key={t.id} onClick={()=>setTab(t.id)} style={{ flex:1,padding:"8px 2px",fontSize:7,letterSpacing:1,cursor:"pointer",border:"none",borderBottom:`2px solid ${tab===t.id?"#00c864":"transparent"}`,background:"transparent",color:tab===t.id?"#00c864":"#3a3a3c",fontFamily:"'Share Tech Mono',monospace",transition:"all 0.12s" }}>{t.label}</button>
              ))}
            </div>
            <div style={{ flex:1,overflow:"hidden" }}>
              {tab==="THREAT"  && <ThreatScorePanel zone={sel} acledEvents={acledEvents} gdeltArticles={articles} signals={signals}/>}
              {tab==="INTEL"   && <IntelPanel zone={sel} acledEvents={acledEvents}/>}
              {tab==="SIGNALS" && <SignalTracker signals={signals} loading={rLoad}/>}
              {tab==="ACLED"   && <ACLEDFeed events={acledEvents} loading={aLoad} source={aSource}/>}
            </div>
          </div>
        </div>

        <Ticker articles={articles} signals={signals} acledEvents={acledEvents}/>

        {/* STATUS */}
        <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",padding:"3px 16px",flexShrink:0,background:"rgba(0,0,0,0.8)",borderTop:"1px solid rgba(0,200,80,0.06)" }}>
          <div style={{ display:"flex",gap:14,alignItems:"center" }}>
            <div style={{ display:"flex",alignItems:"center",gap:5 }}><Dot size={5} color="#00c864" glow/><span style={{ fontSize:8,color:"#00c864",letterSpacing:1 }}>SYSTEMS NOMINAL</span></div>
            <span style={{ fontSize:7,color:"#1a3a1a" }}>GDELT GEO · RELIEFWEB · NATURAL EARTH · WIKIPEDIA · REUTERS · AL JAZEERA · BBC · UN NEWS · CLAUDE AI</span>
          </div>
          <div style={{ fontSize:7,color:"#1a3a1a" }}>WORLDWIDERADAR.COM · OSINT // UNCLASSIFIED</div>
        </div>
      </div>
    </>
  );
}
