import { useNavigate } from "react-router-dom";
import { MONO, DISPLAY } from "../components/UI.jsx";

const S = {
  page: {
    width: "100vw", minHeight: "100vh", background: "#020c18", color: "#ebebf0",
    fontFamily: MONO, overflowY: "auto",
  },
  topBar: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 32px", borderBottom: "1px solid rgba(0,200,80,0.2)",
    background: "rgba(0,0,0,0.75)", position: "sticky", top: 0, zIndex: 10,
  },
  container: { maxWidth: 860, margin: "0 auto", padding: "40px 32px" },
  h1: { fontFamily: DISPLAY, fontSize: 42, letterSpacing: 4, color: "#00c864", marginBottom: 8, lineHeight: 1 },
  h2: { fontFamily: DISPLAY, fontSize: 26, letterSpacing: 3, color: "#00c864", marginBottom: 12, marginTop: 32 },
  h3: { fontFamily: MONO, fontSize: 11, color: "#c7c7cc", letterSpacing: 2, marginBottom: 8, marginTop: 20 },
  p: { fontFamily: MONO, fontSize: 11, color: "#8e8e93", lineHeight: 1.9, marginBottom: 12 },
  label: { fontFamily: MONO, fontSize: 8, color: "#2a4a2a", letterSpacing: 3, marginBottom: 6 },
  divider: { height: 1, background: "rgba(0,200,80,0.12)", margin: "24px 0" },
  badge: (color="#636366") => ({ fontSize: 8, padding: "2px 8px", borderRadius: 2, background: `${color}20`, color, fontFamily: MONO, letterSpacing: 1, display: "inline-block" }),
  card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(0,200,80,0.08)", borderRadius: 4, padding: "16px 18px", marginBottom: 12 },
  table: { width: "100%", borderCollapse: "collapse", marginBottom: 16 },
  th: { fontFamily: MONO, fontSize: 8, color: "#2a4a2a", letterSpacing: 2, padding: "6px 10px", borderBottom: "1px solid rgba(0,200,80,0.1)", textAlign: "left" },
  td: { fontFamily: MONO, fontSize: 10, color: "#8e8e93", padding: "7px 10px", borderBottom: "1px solid rgba(255,255,255,0.03)" },
};

const SOURCES = [
  { name: "GDELT GEO API",       type: "Primary — Event GPS",   update: "Every 15 min",  coverage: "Global, 65,000+ sources",       auth: "Free / No key",      weight: "HIGH" },
  { name: "ReliefWeb / UN OCHA", type: "Primary — UN Reports",  update: "Real-time",     coverage: "Global, UN-verified",           auth: "Free / No key",      weight: "HIGH" },
  { name: "GDELT Artlist API",   type: "Secondary — News",      update: "Every 15 min",  coverage: "Global, news aggregation",      auth: "Free / No key",      weight: "MEDIUM" },
  { name: "Wikipedia REST API",  type: "Reference — Context",   update: "Editor-updated",coverage: "Global, encyclopedic",          auth: "Free / No key",      weight: "LOW" },
  { name: "Reuters RSS",         type: "Secondary — Breaking",  update: "Continuous",    coverage: "Global, wire service",          auth: "Free / No key",      weight: "MEDIUM" },
  { name: "Al Jazeera RSS",      type: "Secondary — Regional",  update: "Continuous",    coverage: "Global / MENA focus",           auth: "Free / No key",      weight: "MEDIUM" },
  { name: "BBC World RSS",       type: "Secondary — Breaking",  update: "Continuous",    coverage: "Global, BBC editorial",         auth: "Free / No key",      weight: "MEDIUM" },
  { name: "UN News RSS",         type: "Secondary — UN",        update: "Continuous",    coverage: "Global, UN Security Council",   auth: "Free / No key",      weight: "MEDIUM" },
  { name: "Claude AI (Anthropic)",type: "Analysis Engine",      update: "On demand",     coverage: "Synthesizes all above sources", auth: "API Key Required",   weight: "ENGINE" },
];

const SCORING = [
  { metric: "Conflict Activity Index (CAI)", range: "0–100", desc: "Composite score reflecting event frequency, fatality rate, territorial change, and actor escalation. Updated weekly." },
  { metric: "Weekly Delta (%)",              range: "±%",    desc: "Week-over-week change in CAI. Positive = escalating, negative = de-escalating. Calculated from 7-day rolling average." },
  { metric: "AI Threat Score",              range: "0–100", desc: "Claude AI synthesizes all live feeds to produce a real-time threat assessment score with reasoning transparency." },
  { metric: "Severity Classification",      range: "CRITICAL / HIGH / MEDIUM / LOW", desc: "Editorial classification based on CAI, civilian impact, territorial change, and international response." },
  { metric: "Trend Direction",             range: "ESCALATING / VOLATILE / STABLE / DE-ESCALATING", desc: "Claude AI trend assessment based on 72-hour event pattern analysis." },
];

export default function MethodologyPage() {
  const navigate = useNavigate();
  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="24" height="24" viewBox="0 0 32 32">
            <circle cx={16} cy={16} r={14} fill="none" stroke="#00c864" strokeWidth="1.5"/>
            <circle cx={16} cy={16} r={9}  fill="none" stroke="#00c864" strokeWidth="1" opacity="0.5"/>
            <circle cx={16} cy={16} r={3.5} fill="#00c864"/>
          </svg>
          <span style={{ fontFamily: DISPLAY, fontSize: 18, letterSpacing: 4, color: "#00c864" }}>WORLDWIDE RADAR</span>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <button onClick={() => navigate("/")} style={{ background: "none", border: "1px solid rgba(0,200,80,0.3)", color: "#00c864", fontFamily: MONO, fontSize: 8, letterSpacing: 2, padding: "5px 12px", borderRadius: 3, cursor: "pointer" }}>← LIVE MAP</button>
        </div>
      </div>

      <div style={S.container}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={S.label}>INTELLIGENCE METHODOLOGY</div>
          <h1 style={S.h1}>HOW WE ASSESS<br/>GLOBAL CONFLICT</h1>
          <p style={{ ...S.p, fontSize: 13 }}>
            WorldwideRadar aggregates open-source intelligence (OSINT) from multiple verified data feeds
            to produce real-time conflict assessments. All data is publicly available. All analysis methodology
            is documented here. We do not manufacture or fabricate intelligence.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {["OSINT ONLY", "NO PROPRIETARY DATA", "FULLY TRANSPARENT", "AI-ASSISTED ANALYSIS"].map(b => (
              <span key={b} style={S.badge("#00c864")}>{b}</span>
            ))}
          </div>
        </div>

        <div style={S.divider}/>

        {/* Data Sources */}
        <h2 style={S.h2}>DATA SOURCES</h2>
        <p style={S.p}>
          We aggregate from {SOURCES.length} data sources, prioritizing primary sources (direct event data with GPS coordinates)
          over secondary sources (news aggregation). All sources are publicly accessible without proprietary access requirements
          except the Claude AI analysis engine.
        </p>
        <div style={S.card}>
          <table style={S.table}>
            <thead>
              <tr>
                {["SOURCE", "TYPE", "UPDATE FREQ", "COVERAGE", "AUTH REQUIRED", "WEIGHT"].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(s => (
                <tr key={s.name}>
                  <td style={{ ...S.td, color: "#c7c7cc" }}>{s.name}</td>
                  <td style={S.td}>{s.type}</td>
                  <td style={{ ...S.td, color: "#00c864" }}>{s.update}</td>
                  <td style={S.td}>{s.coverage}</td>
                  <td style={{ ...S.td, color: s.auth.includes("Required") ? "#ff9f0a" : "#30d158" }}>{s.auth}</td>
                  <td style={{ ...S.td, color: s.weight === "HIGH" ? "#ff9f0a" : s.weight === "ENGINE" ? "#00c864" : "#636366" }}>{s.weight}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={S.divider}/>

        {/* Scoring */}
        <h2 style={S.h2}>SCORING METHODOLOGY</h2>
        <p style={S.p}>
          Our scoring system is designed to be numerically grounded and directionally consistent.
          No single metric drives assessments — all scores are composite and multi-sourced.
        </p>
        {SCORING.map(s => (
          <div key={s.metric} style={{ ...S.card, marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
              <h3 style={{ ...S.h3, margin: 0 }}>{s.metric}</h3>
              <span style={S.badge()}>{s.range}</span>
            </div>
            <p style={{ ...S.p, margin: 0 }}>{s.desc}</p>
          </div>
        ))}

        <div style={S.divider}/>

        {/* Update cadence */}
        <h2 style={S.h2}>UPDATE CADENCE</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
          {[
            { freq: "EVERY 15 MIN", label: "Event GPS data\nGDELT event processing" },
            { freq: "EVERY 5 MIN",  label: "RSS signal feeds\nFrontend data refresh" },
            { freq: "ON DEMAND",    label: "AI threat scores\nCached 20 min per zone" },
          ].map(({ freq, label }) => (
            <div key={freq} style={S.card}>
              <div style={{ fontFamily: DISPLAY, fontSize: 20, color: "#00c864", marginBottom: 4 }}>{freq}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: "#636366", lineHeight: 1.7, whiteSpace: "pre-line" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={S.divider}/>

        {/* Limitations */}
        <h2 style={S.h2}>KNOWN LIMITATIONS</h2>
        <p style={S.p}>
          Open-source intelligence has inherent limitations. We document these transparently:
        </p>
        {[
          "Event GPS coordinates from GDELT are derived from named entity recognition in news articles — accuracy depends on article specificity.",
          "Fatality counts are often underreported in active conflict zones due to access restrictions.",
          "AI threat scores are probabilistic assessments, not predictions. They reflect available data at the time of generation.",
          "Coverage is biased toward conflicts receiving significant English-language media attention.",
          "State-level actors may conduct information operations that affect news coverage quality.",
        ].map((l, i) => (
          <div key={i} style={{ display: "flex", gap: 10, marginBottom: 8, alignItems: "flex-start" }}>
            <span style={{ color: "#ff9f0a", fontSize: 10, flexShrink: 0, marginTop: 2 }}>⚠</span>
            <span style={{ fontFamily: MONO, fontSize: 10, color: "#8e8e93", lineHeight: 1.7 }}>{l}</span>
          </div>
        ))}

        <div style={S.divider}/>

        {/* Premium */}
        <h2 style={S.h2}>PREMIUM DATA ACCESS</h2>
        <div style={{ ...S.card, borderColor: "rgba(0,200,80,0.2)" }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: "#3a3a3c", letterSpacing: 2, marginBottom: 8 }}>COMING SOON · INSTITUTIONAL ACCESS</div>
          <p style={{ ...S.p, marginBottom: 12 }}>
            WorldwideRadar Premium provides institutional and research users with enhanced capabilities:
          </p>
          {["Historical event data exports (CSV / JSON)", "Real-time webhook alerts on zone escalation", "API access for data integration", "Higher-frequency AI threat score updates", "Custom zone monitoring", "White-label embed widgets"].map(f => (
            <div key={f} style={{ display: "flex", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#00c864", fontSize: 9, flexShrink: 0 }}>◆</span>
              <span style={{ fontFamily: MONO, fontSize: 10, color: "#636366" }}>{f}</span>
            </div>
          ))}
          <div style={{ marginTop: 12 }}>
            <span style={S.badge("#ffd60a")}>EARLY ACCESS · CONTACT AVAILABLE</span>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.04)" }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: "#1a3a1a", letterSpacing: 2, lineHeight: 2 }}>
            WORLDWIDERADAR.COM · METHODOLOGY V2.0 · OSINT // UNCLASSIFIED<br/>
            DATA SOURCES: GDELT PROJECT · UN OCHA RELIEFWEB · WIKIPEDIA · ANTHROPIC CLAUDE AI<br/>
            ALL ANALYSIS IS FOR INFORMATIONAL PURPOSES ONLY. NOT INTENDED FOR OPERATIONAL MILITARY OR GOVERNMENT USE.
          </div>
        </div>
      </div>
    </div>
  );
}
