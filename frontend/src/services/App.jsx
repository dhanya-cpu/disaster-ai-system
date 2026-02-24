import { useState, useEffect, useRef } from 'react';
import { predictSeverity, optimizeResources } from './services/api';

const DISASTER_TYPES = ['Flood', 'Earthquake', 'Cyclone', 'Drought', 'Landslide'];

const SEV_COLOR = {
  Low:    '#00C48C',
  Medium: '#FFB800',
  High:   '#FF4757',
};

// ── Animated counter ──────────────────────────────────────────────────────────
function Counter({ val }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let s = 0; const end = parseInt(val) || 0;
    if (!end) return;
    const step = Math.max(1, Math.ceil(end / 60));
    const t = setInterval(() => { s = Math.min(s + step, end); setN(s); if (s >= end) clearInterval(t); }, 16);
    return () => clearInterval(t);
  }, [val]);
  return <>{n.toLocaleString()}</>;
}

// ── Leaflet Map ───────────────────────────────────────────────────────────────
function DisasterMap({ coords }) {
  const ref = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return;
    const L = window.L;
    if (!L) return;
    mapRef.current = L.map(ref.current, { zoomControl: true, attributionControl: true }).setView([20, 20], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '© Leaflet | © CARTO', subdomains: 'abcd', maxZoom: 19
    }).addTo(mapRef.current);
  }, []);

  useEffect(() => {
    const L = window.L;
    if (!L || !mapRef.current || !coords) return;
    if (markerRef.current) markerRef.current.remove();
    markerRef.current = L.marker([coords.lat, coords.lng]).addTo(mapRef.current);
    mapRef.current.flyTo([coords.lat, coords.lng], 5, { duration: 1.5 });
  }, [coords]);

  return <div ref={ref} style={{ width: '100%', height: '100%', borderRadius: 0, background: '#0a0f1a' }} />;
}

// ── Line Chart ────────────────────────────────────────────────────────────────
function LineChart({ history }) {
  if (!history || history.length < 2) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#1a3050', fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
      Run predictions to populate chart
    </div>
  );
  const vals = history.map(h => h.cost / 1000);
  const min = Math.min(...vals); const max = Math.max(...vals);
  const range = max - min || 1;
  const W = 400; const H = 150; const PAD = 34;
  const pts = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
    const y = PAD + ((max - v) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(' ');
  const yLabels = [max, (max + min) / 2, min].map(v => Math.round(v));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00C9FF" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#00C9FF" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yLabels.map((v, i) => {
        const y = PAD + (i / 2) * (H - PAD * 2);
        return (
          <g key={i}>
            <line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
            <text x={PAD - 5} y={y + 4} textAnchor="end" fill="#2a4a6a" fontSize="8" fontFamily="DM Mono, monospace">{v}</text>
          </g>
        );
      })}
      {vals.map((_, i) => {
        const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
        return <text key={i} x={x} y={H - 4} textAnchor="middle" fill="#2a4a6a" fontSize="8" fontFamily="DM Mono, monospace">#{i + 1}</text>;
      })}
      <polyline points={pts} fill="none" stroke="#00C9FF" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <polygon points={`${PAD},${H - PAD} ${pts} ${W - PAD},${H - PAD}`} fill="url(#lg)" />
      {vals.map((v, i) => {
        const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
        const y = PAD + ((max - v) / range) * (H - PAD * 2);
        return <circle key={i} cx={x} cy={y} r="3" fill="#00C9FF" stroke="#070e22" strokeWidth="1.5" />;
      })}
    </svg>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [form, setForm] = useState({ disaster_type: 'Flood', deaths: '', affected: '', damage_usd: '', budget: '', lat: '', lng: '' });
  const [prediction, setPrediction] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [mapCoords, setMapCoords] = useState(null);
  const [time, setTime] = useState(new Date());
  const [leafletReady, setLeafletReady] = useState(false);
  const [activeTab, setActiveTab] = useState('input');

  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => setLeafletReady(true);
    document.head.appendChild(script);
  }, []);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const lat = parseFloat(form.lat) || (Math.random() * 40 + 5);
      const lng = parseFloat(form.lng) || (Math.random() * 80 + 10);
      setMapCoords({ lat, lng });

      const pred = await predictSeverity({
        disaster_type: form.disaster_type,
        deaths: parseInt(form.deaths),
        affected: parseInt(form.affected),
        damage_usd: parseFloat(form.damage_usd),
      });
      setPrediction(pred);

      const opt = await optimizeResources({
        severity_level: pred.severity_level,
        budget: parseFloat(form.budget),
      });
      setOptimization(opt);

      setHistory(prev => [...prev.slice(-9), {
        cost: opt.total_cost, severity: pred.severity_level,
        type: form.disaster_type, lat, lng,
        timestamp: new Date().toLocaleTimeString(),
      }]);
      setActiveTab('dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Backend offline. Run: uvicorn main:app --reload');
    } finally { setLoading(false); }
  };

  const exportCSV = () => {
    if (!history.length) return;
    const rows = ['Timestamp,Disaster,Severity,Cost($),Lat,Lng',
      ...history.map(h => `${h.timestamp},${h.type},${h.severity},${h.cost},${h.lat?.toFixed(4)},${h.lng?.toFixed(4)}`)
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows], { type: 'text/csv' }));
    a.download = 'disaster_data.csv'; a.click();
  };

  const sevColor = prediction ? SEV_COLOR[prediction.severity_level] : '#4A9EFF';
  const maxStock = optimization ? Math.max(optimization.resource_plan.food_kits, optimization.resource_plan.medical_units, optimization.resource_plan.shelters) : 1;

  const featureImportance = prediction ? [
    { label: 'damage_usd',        pct: 72, color: '#7B5EA7' },
    { label: 'affected',          pct: 55, color: '#C8A000' },
    { label: form.disaster_type,  pct: 32, color: '#00A878' },
    { label: 'deaths',            pct: 18, color: '#CC2200' },
  ] : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Exo+2:wght@300;400;600;700;900&family=DM+Mono:wght@300;400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; }
        body { font-family: 'Exo 2', sans-serif; background: #060d1f; color: #c8d8f0; overflow: hidden; }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        .fadein { animation: fadeIn 0.45s ease both; }

        /* NAV */
        .nav {
          display:flex; align-items:center; justify-content:space-between;
          padding:0 20px; height:46px;
          background:rgba(4,9,24,0.97);
          border-bottom:1px solid rgba(0,150,255,0.1);
          position:sticky; top:0; z-index:1000;
        }
        .nav-brand { font-size:12px; font-weight:700; letter-spacing:3px; color:#00C9FF; text-transform:uppercase; display:flex; align-items:center; gap:8px; }
        .nav-brand span { color:#1a3a5a; }
        .nav-center { display:flex; gap:2px; }
        .nav-tab {
          padding:5px 16px; border-radius:5px; border:none; cursor:pointer;
          font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px;
          text-transform:uppercase; transition:all 0.2s;
          background:transparent; color:#2a4a6a;
        }
        .nav-tab.active { background:rgba(0,201,255,0.1); color:#00C9FF; }
        .nav-right { display:flex; align-items:center; gap:14px; font-family:'DM Mono',monospace; font-size:10px; color:#2a4a6a; }
        .live-dot { width:6px; height:6px; border-radius:50%; background:#00C48C; animation:blink 1.4s infinite; }

        /* SHELL */
        .shell { display:flex; flex-direction:column; height:calc(100vh - 46px); }

        /* INPUT */
        .input-page { display:flex; align-items:center; justify-content:center; flex:1; padding:24px; overflow:auto; }
        .input-card {
          width:100%; max-width:580px;
          background:rgba(8,16,38,0.9); border:1px solid rgba(0,150,255,0.12);
          border-radius:14px; padding:32px; backdrop-filter:blur(20px);
          box-shadow:0 0 80px rgba(0,100,255,0.06);
        }
        .input-card h2 {
          font-size:10px; letter-spacing:4px; color:#00C9FF;
          text-transform:uppercase; font-family:'DM Mono',monospace;
          margin-bottom:24px; padding-bottom:12px;
          border-bottom:1px solid rgba(0,150,255,0.08);
        }
        .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-bottom:14px; }
        .form-row.single { grid-template-columns:1fr; }
        .fld { display:flex; flex-direction:column; gap:5px; }
        .fld label { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2.5px; color:#1a3a5a; text-transform:uppercase; }
        .fld input, .fld select {
          background:rgba(0,15,50,0.7); border:1px solid rgba(0,150,255,0.1);
          border-radius:7px; padding:10px 12px; color:#c8d8f0;
          font-family:'DM Mono',monospace; font-size:12px;
          outline:none; transition:all 0.2s; width:100%; appearance:none;
        }
        .fld input:focus, .fld select:focus {
          border-color:#00C9FF; background:rgba(0,150,255,0.06);
          box-shadow:0 0 0 2px rgba(0,201,255,0.07);
        }
        .fld select option { background:#080e28; }
        .latrow { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
        .submit-btn {
          width:100%; margin-top:6px; padding:14px; border:1px solid rgba(0,201,255,0.25);
          border-radius:9px; background:linear-gradient(135deg,rgba(0,100,220,0.2),rgba(0,201,255,0.08));
          color:#00C9FF; font-family:'Exo 2',sans-serif; font-size:12px;
          font-weight:700; letter-spacing:3px; text-transform:uppercase; cursor:pointer;
          transition:all 0.3s; box-shadow:0 0 20px rgba(0,201,255,0.08);
        }
        .submit-btn:hover:not(:disabled) { background:linear-gradient(135deg,rgba(0,100,220,0.35),rgba(0,201,255,0.15)); box-shadow:0 0 30px rgba(0,201,255,0.18); }
        .submit-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .err { margin-top:12px; padding:11px 14px; background:rgba(255,71,87,0.09); border:1px solid rgba(255,71,87,0.25); border-radius:7px; color:#FF4757; font-family:'DM Mono',monospace; font-size:11px; }

        /* SEV STRIP */
        .sev-strip {
          display:flex; align-items:center; gap:18px; padding:5px 18px;
          background:rgba(3,7,18,0.8); border-bottom:1px solid rgba(0,150,255,0.07); flex-shrink:0;
        }
        .sev-strip-badge { display:flex; align-items:center; gap:6px; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; font-weight:500; }
        .sev-dot { width:7px; height:7px; border-radius:50%; }
        .sev-meta { font-family:'DM Mono',monospace; font-size:9px; color:#1a3050; margin-left:auto; }

        /* DASHBOARD GRID */
        .dash { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; flex:1; gap:1px; background:rgba(0,80,160,0.05); overflow:hidden; }
        .panel { background:#060d1e; position:relative; overflow:hidden; display:flex; flex-direction:column; }
        .panel-hd {
          display:flex; align-items:center; gap:8px; padding:10px 16px;
          border-bottom:1px solid rgba(0,150,255,0.07); flex-shrink:0;
        }
        .panel-hd-icon { font-size:13px; }
        .panel-hd-title { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:3px; text-transform:uppercase; color:#1a3a5a; flex:1; }
        .panel-hd-badge { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:2px; color:#00C48C; }

        /* MAP */
        .map-body { flex:1; position:relative; overflow:hidden; }
        .map-overlay {
          position:absolute; bottom:10px; left:50%; transform:translateX(-50%);
          background:rgba(4,9,24,0.88); border:1px solid rgba(0,201,255,0.2);
          border-radius:20px; padding:4px 14px; z-index:500;
          font-family:'DM Mono',monospace; font-size:9px; color:#00C9FF; letter-spacing:1.5px; white-space:nowrap;
          backdrop-filter:blur(10px);
        }
        .map-no { display:flex; align-items:center; justify-content:center; height:100%; flex-direction:column; gap:10px; color:#0e2040; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }

        /* FEATURE IMPORTANCE */
        .fi-body { padding:18px 22px; display:flex; flex-direction:column; gap:14px; flex:1; justify-content:center; }
        .fi-row { display:flex; align-items:center; gap:10px; }
        .fi-lbl { font-family:'DM Mono',monospace; font-size:10px; color:#2a4a70; width:82px; text-align:right; flex-shrink:0; }
        .fi-track { flex:1; height:13px; background:rgba(255,255,255,0.03); border-radius:999px; overflow:hidden; }
        .fi-bar { height:100%; border-radius:999px; transition:width 1s ease; }
        .fi-pct { font-family:'DM Mono',monospace; font-size:9px; color:#2a4060; width:28px; }
        .fi-cap { padding:8px 22px 12px; font-family:'DM Mono',monospace; font-size:9px; color:#1a3050; font-style:italic; border-top:1px solid rgba(0,100,200,0.06); }
        .fi-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#0e2040; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }

        /* WAREHOUSE */
        .wh-hd { display:flex; align-items:center; gap:8px; padding:10px 18px 8px; border-bottom:1px solid rgba(0,150,255,0.05); flex-shrink:0; }
        .wh-hd-title { font-family:'DM Mono',monospace; font-size:9px; letter-spacing:3px; color:#1a3a5a; text-transform:uppercase; }
        .wh-body { padding:14px 18px; display:flex; flex-direction:column; gap:16px; flex:1; justify-content:center; overflow:auto; }
        .wh-row { display:flex; flex-direction:column; gap:5px; }
        .wh-top { display:flex; align-items:center; gap:10px; }
        .wh-icon { font-size:18px; width:26px; flex-shrink:0; }
        .wh-info { flex:1; }
        .wh-name { font-family:'DM Mono',monospace; font-size:8px; letter-spacing:2.5px; color:#1a3a5a; text-transform:uppercase; margin-bottom:1px; }
        .wh-val { font-size:26px; font-weight:900; letter-spacing:-0.5px; color:#b8d8f8; line-height:1; }
        .wh-pct { font-family:'DM Mono',monospace; font-size:9px; color:#1a3a5a; align-self:flex-end; padding-bottom:4px; }
        .wh-track { height:3px; background:rgba(255,255,255,0.04); border-radius:999px; overflow:hidden; margin-top:1px; }
        .wh-fill { height:100%; border-radius:999px; transition:width 1.3s cubic-bezier(0.16,1,0.3,1); }
        .wh-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#0e2040; font-family:'DM Mono',monospace; font-size:10px; letter-spacing:2px; text-transform:uppercase; }

        /* LINE CHART PANEL */
        .lc-body { flex:1; padding:6px 14px 0; overflow:hidden; }
        .lc-footer { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; border-top:1px solid rgba(0,150,255,0.06); flex-shrink:0; }
        .export-btn { display:flex; align-items:center; gap:6px; background:none; border:none; cursor:pointer; font-family:'DM Mono',monospace; font-size:10px; color:#00C48C; letter-spacing:2px; transition:opacity 0.2s; }
        .export-btn:hover { opacity:0.65; }
        .last-n { font-family:'DM Mono',monospace; font-size:9px; color:#1a3050; }

        /* FOOTER */
        .bottom-bar { display:flex; align-items:center; justify-content:center; padding:6px; background:rgba(3,6,16,0.95); border-top:1px solid rgba(0,100,180,0.08); font-family:'DM Mono',monospace; font-size:8px; letter-spacing:5px; color:#0e2040; text-transform:uppercase; flex-shrink:0; }

        @media (max-width:680px) {
          .dash { grid-template-columns:1fr; grid-template-rows:repeat(4,280px); overflow:auto; }
          .form-row { grid-template-columns:1fr; }
          body { overflow:auto; }
        }
      `}</style>

      {/* NAV */}
      <nav className="nav">
        <div className="nav-brand">🌐 DisasterOS <span>· V3 PROFESSIONAL SUITE</span></div>
        <div className="nav-center">
          <button className={`nav-tab ${activeTab === 'input' ? 'active' : ''}`} onClick={() => setActiveTab('input')}>Mission Input</button>
          <button className={`nav-tab ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        </div>
        <div className="nav-right">
          <div className="live-dot" />
          <span>LIVE</span>
          <span>{time.toLocaleTimeString()}</span>
          {history.length > 0 && <span style={{ color: '#00C9FF' }}>{history.length} responses</span>}
        </div>
      </nav>

      <div className="shell">

        {/* INPUT PAGE */}
        {activeTab === 'input' && (
          <div className="input-page fadein">
            <div className="input-card">
              <h2>🎯 Mission Parameters — Disaster Classification</h2>
              <form onSubmit={handleSubmit}>
                <div className="form-row">
                  <div className="fld">
                    <label>Disaster Type</label>
                    <select name="disaster_type" value={form.disaster_type} onChange={handleChange}>
                      {DISASTER_TYPES.map(t => <option key={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="fld">
                    <label>Deaths</label>
                    <input type="number" name="deaths" value={form.deaths} onChange={handleChange} placeholder="e.g. 150" required min="0" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="fld">
                    <label>Affected Population</label>
                    <input type="number" name="affected" value={form.affected} onChange={handleChange} placeholder="e.g. 50000" required min="0" />
                  </div>
                  <div className="fld">
                    <label>Damage USD</label>
                    <input type="number" name="damage_usd" value={form.damage_usd} onChange={handleChange} placeholder="e.g. 5000000" required min="0" />
                  </div>
                </div>
                <div className="form-row">
                  <div className="fld">
                    <label>Budget (USD)</label>
                    <input type="number" name="budget" value={form.budget} onChange={handleChange} placeholder="e.g. 10000000" required min="0" />
                  </div>
                  <div className="fld">
                    <label>Coordinates (optional)</label>
                    <div className="latrow">
                      <input type="number" name="lat" value={form.lat} onChange={handleChange} placeholder="Lat e.g. 21.8" step="any" />
                      <input type="number" name="lng" value={form.lng} onChange={handleChange} placeholder="Lng e.g. 6.5" step="any" />
                    </div>
                  </div>
                </div>
                <button type="submit" className="submit-btn" disabled={loading}>
                  {loading ? '⏳  Analyzing Disaster Data...' : '🚀  Predict & Optimize → View Dashboard'}
                </button>
                {error && <div className="err">⚠ {error}</div>}
              </form>
            </div>
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <>
            {prediction && (
              <div className="sev-strip fadein">
                <div className="sev-strip-badge" style={{ color: sevColor }}>
                  <div className="sev-dot" style={{ background: sevColor }} />
                  {prediction.severity_level} Severity · {prediction.confidence_pct}% confidence · Score: {prediction.severity_score}
                </div>
                <div className="sev-meta">
                  {optimization?.status} · Cost: ${optimization?.total_cost?.toLocaleString()}
                  {optimization?.budget_remaining !== undefined && ` · Remaining: $${optimization.budget_remaining?.toLocaleString()}`}
                  {optimization?.budget_shortfall !== undefined && ` · Shortfall: $${optimization.budget_shortfall?.toLocaleString()}`}
                </div>
              </div>
            )}

            <div className="dash">

              {/* P1: MAP */}
              <div className="panel">
                <div className="panel-hd">
                  <span className="panel-hd-icon">🗺</span>
                  <span className="panel-hd-title">Location Intelligence</span>
                  {mapCoords && <span className="panel-hd-badge">TARGET LOCKED</span>}
                </div>
                <div className="map-body">
                  {leafletReady
                    ? <DisasterMap coords={mapCoords} />
                    : <div className="map-no"><span style={{ fontSize: 36, opacity: 0.2 }}>🌍</span>Loading map…</div>
                  }
                  {!mapCoords && leafletReady && (
                    <div className="map-no" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
                      <span style={{ fontSize: 36, opacity: 0.15 }}>🌍</span>
                      Submit prediction to lock target
                    </div>
                  )}
                  {mapCoords && (
                    <div className="map-overlay">
                      🎯 Target locked: {mapCoords.lat.toFixed(4)}°N, {mapCoords.lng.toFixed(4)}°E
                    </div>
                  )}
                </div>
              </div>

              {/* P2: FEATURE IMPORTANCE */}
              <div className="panel">
                <div className="panel-hd">
                  <span className="panel-hd-icon">📊</span>
                  <span className="panel-hd-title">Feature Importance</span>
                  {prediction && <span className="panel-hd-badge" style={{ color: sevColor }}>RF MODEL</span>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  {featureImportance.length > 0 ? (
                    <>
                      <div className="fi-body">
                        {featureImportance.map((f, i) => (
                          <div className="fi-row fadein" key={f.label} style={{ animationDelay: `${i * 0.1}s` }}>
                            <span className="fi-lbl">{f.label}</span>
                            <div className="fi-track">
                              <div className="fi-bar" style={{ width: `${f.pct}%`, background: f.color }} />
                            </div>
                            <span className="fi-pct">{f.pct}%</span>
                          </div>
                        ))}
                      </div>
                      <div className="fi-cap">Higher percentage → Stronger impact on classification decision.</div>
                    </>
                  ) : (
                    <div className="fi-empty">Run a prediction to see feature importance</div>
                  )}
                </div>
              </div>

              {/* P3: WAREHOUSE */}
              <div className="panel">
                <div className="panel-hd">
                  <span className="panel-hd-icon">🌍</span>
                  <span className="panel-hd-title">Global Response Monitoring</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                  <div className="wh-hd">
                    <span style={{ fontSize: 13 }}>📦</span>
                    <span className="wh-hd-title">Global Warehouse Stock</span>
                  </div>
                  {optimization ? (
                    <div className="wh-body">
                      {[
                        { icon: '🍱', label: 'Food Kits',     key: 'food_kits',     color: '#00C9FF' },
                        { icon: '🏥', label: 'Medical Units', key: 'medical_units', color: '#FF4757' },
                        { icon: '🏠', label: 'Shelters',      key: 'shelters',      color: '#00C48C' },
                      ].map(({ icon, label, key, color }, i) => {
                        const val = optimization.resource_plan[key];
                        const pct = Math.round((val / maxStock) * 100);
                        return (
                          <div className="wh-row fadein" key={key} style={{ animationDelay: `${i * 0.12}s` }}>
                            <div className="wh-top">
                              <span className="wh-icon">{icon}</span>
                              <div className="wh-info">
                                <div className="wh-name">{label}</div>
                                <div className="wh-val"><Counter val={val} /></div>
                              </div>
                              <span className="wh-pct">{pct}%</span>
                            </div>
                            <div className="wh-track">
                              <div className="wh-fill" style={{ width: `${pct}%`, background: color }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="wh-empty">Run prediction to see allocation</div>
                  )}
                </div>
              </div>

              {/* P4: LINE CHART */}
              <div className="panel">
                <div className="panel-hd">
                  <span className="panel-hd-icon">📈</span>
                  <span className="panel-hd-title">Response Cost Trends ($K)</span>
                  {history.length > 0 && <span className="panel-hd-badge">LIVE</span>}
                </div>
                <div className="lc-body">
                  <LineChart history={history} />
                </div>
                <div className="lc-footer">
                  <button className="export-btn" onClick={exportCSV}>📋 Export CSV</button>
                  <span className="last-n">Last {history.length} responses</span>
                </div>
              </div>

            </div>

            <div className="bottom-bar">DisasterOS · V3 Professional Suite</div>
          </>
        )}
      </div>
    </>
  );
}
