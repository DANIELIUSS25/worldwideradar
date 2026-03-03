import { useState, useEffect, useCallback, useRef } from "react";

const API_BASE   = "/.netlify/functions";
const REFRESH_MS = 5 * 60 * 1000;

export function useACLED() {
  const [events, setEvents]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource]   = useState("loading");
  const go = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/acled`);
      const d = await r.json();
      setEvents(d.events || []);
      setSource(d.source || "unknown");
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return () => clearInterval(t); }, [go]);
  return { events, loading, source };
}

export function useGDELT() {
  const [articles, setArticles] = useState([]);
  const [loading, setLoading]   = useState(true);
  const go = useCallback(async () => {
    try {
      let r;
      try { r = await fetch(`${API_BASE}/gdelt`); }
      catch { r = await fetch("https://api.gdeltproject.org/api/v2/doc/doc?query=war+attack+airstrike+military+conflict&mode=artlist&format=json&maxrecords=30&timespan=6h"); }
      const d = await r.json();
      setArticles(d.articles || []);
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return () => clearInterval(t); }, [go]);
  return { articles, loading };
}

export function useRSS() {
  const [signals, setSignals]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const go = useCallback(async () => {
    try {
      const r = await fetch(`${API_BASE}/rss`);
      const d = await r.json();
      const items = (d.signals || []).map(s => ({ ...s, date: new Date(s.date) }));
      setSignals(items);
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, REFRESH_MS); return () => clearInterval(t); }, [go]);
  return { signals, loading };
}

export function useWiki(key) {
  const [data, setData] = useState(null);
  const cache = useRef({});
  useEffect(() => {
    if (!key) return;
    if (cache.current[key]) { setData(cache.current[key]); return; }
    setData(null);
    fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${key}`)
      .then(r => r.json())
      .then(d => { cache.current[key] = d; setData(d); })
      .catch(() => {});
  }, [key]);
  return data;
}

export function useThreatScore(zone, acledEvents, gdeltArticles, signals, wikiText) {
  const [score, setScore]     = useState(null);
  const [loading, setLoading] = useState(false);
  const cache = useRef({});
  const SCORE_TTL = 20 * 60 * 1000;

  const analyze = useCallback(async () => {
    if (!zone) return;
    const cached = cache.current[zone.id];
    if (cached && Date.now() - cached.ts < SCORE_TTL) { setScore(cached.score); return; }
    setLoading(true);
    const q  = zone.name.split(/[\s–-]/)[0].toLowerCase();
    const zE = acledEvents.filter(e => (e.country || "").toLowerCase().includes(q)).slice(0, 25);
    const zA = gdeltArticles.filter(a => (a.title || "").toLowerCase().includes(q)).slice(0, 12);
    const zS = signals.filter(s => (s.title || "").toLowerCase().includes(q)).slice(0, 8);
    try {
      const r = await fetch(`${API_BASE}/threat-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone, acledEvents: zE, gdeltArticles: zA, signals: zS, wikiSummary: wikiText || "" }),
      });
      const data = await r.json();
      cache.current[zone.id] = { score: data, ts: Date.now() };
      setScore(data);
    } catch(_) {}
    setLoading(false);
  }, [zone?.id, acledEvents.length, gdeltArticles.length, signals.length, wikiText]);

  useEffect(() => { if (zone) analyze(); }, [zone?.id]);
  return { score, loading, refresh: analyze };
}

export function useWatchlist() {
  const LS_KEY = "wwr_watchlist_v1";
  const [watchlist, setWatchlist] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); }
    catch { return []; }
  });
  const toggle = useCallback((zoneId) => {
    setWatchlist(prev => {
      const next = prev.includes(zoneId)
        ? prev.filter(id => id !== zoneId)
        : [...prev, zoneId];
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch(_) {}
      return next;
    });
  }, []);
  const isWatched = useCallback((zoneId) => watchlist.includes(zoneId), [watchlist]);
  return { watchlist, toggle, isWatched };
}

export function useFireData() {
  const [fires, setFires]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource]   = useState("loading");
  const go = useCallback(async () => {
    try {
      const r = await fetch("/.netlify/functions/fires");
      const d = await r.json();
      setFires(d.fires || []);
      setSource(d.source || "unknown");
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, 15 * 60 * 1000); return () => clearInterval(t); }, [go]);
  return { fires, loading, source };
}

export function useSeismic() {
  const [quakes, setQuakes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const go = useCallback(async () => {
    try {
      const r = await fetch("/.netlify/functions/seismic");
      const d = await r.json();
      setQuakes(d.quakes || []);
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, 10 * 60 * 1000); return () => clearInterval(t); }, [go]);
  return { quakes, loading };
}

export function usePolymarket() {
  const [markets, setMarkets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource]   = useState("loading");
  const go = useCallback(async () => {
    try {
      const r = await fetch("/.netlify/functions/polymarket");
      const d = await r.json();
      setMarkets(d.markets || []);
      setSource(d.source || "unknown");
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, 10 * 60 * 1000); return () => clearInterval(t); }, [go]);
  return { markets, loading, source };
}

export function useUSStatus() {
  const [advisories, setAdvisories] = useState([]);
  const [liveAlerts, setLiveAlerts] = useState([]);
  const [stats, setStats]           = useState(null);
  const [loading, setLoading]       = useState(true);
  const go = useCallback(async () => {
    try {
      const r = await fetch("/.netlify/functions/usstatus");
      const d = await r.json();
      setAdvisories(d.advisories || []);
      setLiveAlerts(d.liveAlerts  || []);
      setStats(d.stats || null);
    } catch(_) {}
    setLoading(false);
  }, []);
  useEffect(() => { go(); const t = setInterval(go, 30 * 60 * 1000); return () => clearInterval(t); }, [go]);
  return { advisories, liveAlerts, stats, loading };
}
