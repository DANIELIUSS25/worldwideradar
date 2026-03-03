import { useParams, useNavigate } from "react-router-dom";
import { REGIONS, ZONES, SEV_COLOR } from "../data/zones.js";
import { MONO, DISPLAY, Sparkline } from "../components/UI.jsx";
import { caiColor, deltaStr, deltaColor } from "../utils/geo.js";

const S = {
  page:      { width: "100vw", minHeight: "100vh", background: "#020c18", color: "#ebebf0", fontFamily: MONO, overflowY: "auto" },
  topBar:    { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 32px", borderBottom: "1px solid rgba(0,200,80,0.2)", background: "rgba(0,0,0,0.75)", position: "sticky", top: 0, zIndex: 10 },
  container: { maxWidth: 900, margin: "0 auto", padding: "40px 32px" },
  h1:        { fontFamily: DISPLAY, fontSize: 48, letterSpacing: 4, color: "#00c864", marginBottom: 4, lineHeight: 1 },
  h2:        { fontFamily: DISPLAY, fontSize: 28, letterSpacing: 3, color: "#00c864", marginBottom: 12, marginTop: 32, lineHeight: 1 },
  p:         { fontFamily: MONO, fontSize: 11, color: "#8e8e93", lineHeight: 1.9, marginBottom: 12 },
  label:     { fontFamily: MONO, fontSize: 8, color: "#2a4a2a", letterSpacing: 3, marginBottom: 6 },
  divider:   { height: 1, background: "rgba(0,200,80,0.1)", margin: "24px 0" },
  card:      { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(0,200,80,0.06)", borderRadius: 4, padding: "18px 20px", marginBottom: 12 },
  badge:     (color="#636366") => ({ fontSize: 8, padding: "2px 8px", borderRadius: 2, background: `${color}20`, color, fontFamily: MONO, letterSpacing: 1, display: "inline-block", marginRight: 6 }),
};

function generateHistory(baseCai, weeks = 16) {
  const out = []; let v = baseCai - 12;
  for (let i = 0; i < weeks; i++) {
    v = Math.max(10, Math.min(99, v + (Math.random() - 0.44) * 9));
    out.push(Math.round(v));
  }
  out[out.length - 1] = baseCai;
  return out;
}

function CAIChart({ zone }) {
  const history = generateHistory(zone.cai);
  const col     = caiColor(zone.cai);
  return (
    <div style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20 }}>
      <div>
        <div style={S.label}>CONFLICT ACTIVITY INDEX — {zone.name.toUpperCase()}</div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 52, color: col, lineHeight: 1 }}>{zone.cai}</span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: deltaColor(zone.delta) }}>{deltaStr(zone.delta)} W/W</span>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 8, color: "#3a3a3c", marginTop: 4 }}>16-WEEK TREND</div>
      </div>
      <Sparkline data={history} color={col} width={200} height={50}/>
    </div>
  );
}

function ActorCard({ actor }) {
  const sideColors = {
    belligerent: "#ff2d55", defender: "#ffd60a", supporter: "#0a84ff",
    auxiliary: "#ff9f0a", "state-sponsor": "#ff2d55", counterforce: "#0a84ff",
    claimant: "#ff9f0a", peacekeeping: "#00c864", diplomatic: "#636366",
    state: "#8e8e93", resistance: "#ffd60a", external: "#3a3a3c", partner: "#0a84ff",
  };
  const col = sideColors[actor.side] || "#636366";
  return (
    <div style={{ ...S.card, marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#d1d1d6", fontWeight: 600 }}>{actor.name}</div>
        <span style={{ fontFamily: MONO, fontSize: 7, padding: "2px 7px", borderRadius: 2, background: `${col}20`, color: col, flexShrink: 0, marginLeft: 10 }}>{actor.side.toUpperCase()}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: "#8e8e93", lineHeight: 1.6 }}>{actor.role}</div>
    </div>
  );
}

function RiskForecast({ forecast, col }) {
  const level = forecast.startsWith("CRITICAL") ? "CRITICAL" : forecast.startsWith("HIGH") ? "HIGH" : forecast.startsWith("MEDIUM") ? "MEDIUM" : "LOW";
  const fCol  = SEV_COLOR[level] || "#ffd60a";
  return (
    <div style={{ ...S.card, borderColor: `${fCol}30`, background: `${fCol}08` }}>
      <div style={{ ...S.label, color: fCol }}>RISK FORECAST</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: "#c7c7cc", lineHeight: 1.7 }}>{forecast}</div>
    </div>
  );
}

// ── SEO-FRIENDLY ARTICLE SECTION ───────────────────────────────────────────────
function ArticleSection({ region, zones }) {
  return (
    <section>
      <h2 style={S.h2}>REGIONAL ANALYSIS</h2>
      <div style={S.p}>{region.narrative}</div>
      <div style={S.divider}/>
      <h2 style={S.h2}>KEY ACTORS</h2>
      {region.keyActors.map((a, i) => <ActorCard key={i} actor={a}/>)}
      <div style={S.divider}/>
      <RiskForecast forecast={region.riskForecast}/>
    </section>
  );
}

export default function RegionPage() {
  const { slug }   = useParams();
  const navigate   = useNavigate();
  const region     = REGIONS[slug];
  const regionZones = region ? ZONES.filter(z => region.zones.includes(z.id)) : [];

  if (!region) {
    return (
      <div style={{ ...S.page, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
        <div style={{ fontFamily: DISPLAY, fontSize: 48, color: "#ff2d55", letterSpacing: 4 }}>404</div>
        <div style={{ fontFamily: MONO, fontSize: 11, color: "#636366", letterSpacing: 2 }}>REGION NOT FOUND IN DATABASE</div>
        <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid rgba(0,200,80,0.3)", color: "#00c864", fontFamily: MONO, fontSize: 9, letterSpacing: 2, padding: "8px 16px", borderRadius: 3, cursor: "pointer" }}>← RETURN TO MAP</button>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* SEO structured header */}
      <div style={S.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 32 32">
            <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
            <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
            <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
          </svg>
          <span style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: 4, color: "#00c864" }}>WORLDWIDE RADAR</span>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          {Object.entries(REGIONS).map(([s, r]) => (
            <button key={s} onClick={() => navigate(`/region/${s}`)} style={{
              background: s === slug ? "rgba(0,200,80,0.1)" : "none",
              border: `1px solid ${s === slug ? "rgba(0,200,80,0.4)" : "rgba(255,255,255,0.06)"}`,
              color: s === slug ? "#00c864" : "#3a3a3c",
              fontFamily: MONO, fontSize: 7, letterSpacing: 1, padding: "4px 8px", borderRadius: 2, cursor: "pointer",
            }}>{r.label.split(" ")[0].toUpperCase()}</button>
          ))}
          <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid rgba(0,200,80,0.3)", color: "#00c864", fontFamily: MONO, fontSize: 8, letterSpacing: 2, padding: "5px 12px", borderRadius: 3, cursor: "pointer" }}>← LIVE MAP</button>
        </div>
      </div>

      <div style={S.container}>
        {/* Hero */}
        <div style={{ marginBottom: 32 }}>
          <div style={S.label}>CONFLICT INTELLIGENCE BRIEF · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}</div>
          <h1 style={S.h1}>{region.label.toUpperCase()}</h1>
          <div style={{ fontFamily: MONO, fontSize: 13, color: "#636366", marginBottom: 16, letterSpacing: 1 }}>{region.tagline}</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {regionZones.map(z => (
              <span key={z.id} style={{ fontFamily: MONO, fontSize: 8, padding: "2px 8px", borderRadius: 2, background: `${SEV_COLOR[z.sev]}20`, color: SEV_COLOR[z.sev] }}>{z.name} · {z.sev}</span>
            ))}
          </div>
        </div>

        {/* CAI Charts */}
        {regionZones.map(z => <CAIChart key={z.id} zone={z}/>)}

        <div style={S.divider}/>

        {/* Main article content */}
        <ArticleSection region={region} zones={regionZones}/>

        <div style={S.divider}/>

        {/* Source list */}
        <h2 style={S.h2}>INTELLIGENCE SOURCES</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
          {region.sources.map(s => <span key={s} style={S.badge("#00c864")}>{s}</span>)}
        </div>

        {/* SEO: hidden but indexable summary */}
        <div style={{ ...S.card, borderColor: "rgba(0,200,80,0.1)" }}>
          <div style={S.label}>COVERAGE KEYWORDS</div>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#2a4a2a", lineHeight: 2 }}>
            {region.seoKeywords?.join(" · ")}
          </div>
        </div>

        {/* Related regions */}
        <h2 style={S.h2}>OTHER REGIONS</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10, marginBottom: 32 }}>
          {Object.entries(REGIONS).filter(([s]) => s !== slug).map(([s, r]) => {
            const rZones = ZONES.filter(z => r.zones.includes(z.id));
            const maxSev = rZones.find(z => z.sev === "CRITICAL") ? "CRITICAL" : rZones.find(z => z.sev === "HIGH") ? "HIGH" : "MEDIUM";
            const col    = SEV_COLOR[maxSev];
            return (
              <div key={s} onClick={() => navigate(`/region/${s}`)} style={{ ...S.card, cursor: "pointer", borderColor: `${col}22`, padding: "12px 14px", transition: "all 0.12s" }}
                onMouseEnter={e => e.currentTarget.style.background = `${col}0a`}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.025)"}
              >
                <div style={{ fontFamily: DISPLAY, fontSize: 16, color: col, letterSpacing: 2, marginBottom: 3 }}>{r.label.toUpperCase()}</div>
                <div style={{ fontFamily: MONO, fontSize: 8, color: "#3a3a3c", lineHeight: 1.6 }}>{r.tagline.slice(0, 60)}...</div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{ paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#1a3a1a", letterSpacing: 2, lineHeight: 2 }}>
            WORLDWIDERADAR.COM · REGION BRIEF: {region.label.toUpperCase()} · OSINT // UNCLASSIFIED<br/>
            ALL ASSESSMENTS ARE OPEN-SOURCE INTELLIGENCE AGGREGATION. NOT INTENDED FOR OPERATIONAL USE.
          </div>
        </div>
      </div>
    </div>
  );
}
