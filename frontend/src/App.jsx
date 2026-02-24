import { useState } from 'react';
import './App.css';
import { predictSeverity, optimizeResources } from './services/api';
import SeverityBadge from './components/SeverityBadge';
import ResourceChart from './components/ResourceChart';

const DISASTER_TYPES = [
  { name: 'Flood', icon: '🌊', cls: 'pill-flood' },
  { name: 'Earthquake', icon: '🏚️', cls: 'pill-earthquake' },
  { name: 'Cyclone', icon: '🌀', cls: 'pill-cyclone' },
  { name: 'Drought', icon: '☀️', cls: 'pill-drought' },
  { name: 'Landslide', icon: '⛰️', cls: 'pill-landslide' },
];

const NAV_ITEMS = [
  { icon: '🛰️', label: 'Dashboard', active: true },
  { icon: '📊', label: 'Analytics' },
  { icon: '🗺️', label: 'Map View' },
  { icon: '📋', label: 'Reports' },
  { icon: '⚙️', label: 'Settings' },
];

const SEVERITY_SCORE_MAX = 100;

export default function App() {
  const [form, setForm] = useState({
    disaster_type: 'Flood',
    deaths: '',
    affected: '',
    damage_usd: '',
    budget: '',
  });

  const [prediction, setPrediction] = useState(null);
  const [optimization, setOptimization] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeNav, setActiveNav] = useState(0);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const selectDisaster = (name) => {
    setForm({ ...form, disaster_type: name });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setPrediction(null);
    setOptimization(null);

    try {
      const predResult = await predictSeverity({
        disaster_type: form.disaster_type,
        deaths: parseInt(form.deaths),
        affected: parseInt(form.affected),
        damage_usd: parseFloat(form.damage_usd),
      });
      setPrediction(predResult);

      const optResult = await optimizeResources({
        severity_level: predResult.severity_level,
        budget: parseFloat(form.budget),
      });
      setOptimization(optResult);
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const scorePercent = prediction
    ? Math.min((prediction.severity_score / SEVERITY_SCORE_MAX) * 100, 100)
    : 0;

  return (
    <div className="app-wrapper">

      {/* ── SIDEBAR ── */}
      <aside className="sidebar">
        <div className="sidebar-logo">🌍</div>
        {NAV_ITEMS.map((item, i) => (
          <div
            key={i}
            title={item.label}
            className={`sidebar-item ${activeNav === i ? 'active' : ''}`}
            onClick={() => setActiveNav(i)}
          >
            {item.icon}
          </div>
        ))}
      </aside>

      {/* ── MAIN ── */}
      <div className="main-content">

        {/* ── TOPBAR ── */}
        <header className="topbar">
          <div>
            <div className="topbar-title">Disaster AI Command Center</div>
            <div className="topbar-subtitle">ML Severity Prediction + LP Optimization</div>
          </div>
          <div className="topbar-spacer" />
          <div className="topbar-badge">
            <div className="topbar-badge-dot" />
            System Online
          </div>
          <div className="topbar-avatar" title="Admin">A</div>
        </header>

        {/* ── PAGE BODY ── */}
        <main className="page-body">

          {/* ── STAT CARDS ── */}
          <div className="stats-row">
            {[
              { label: 'Active Incidents', value: '24', icon: '🚨', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', change: '+3 today', up: false },
              { label: 'Resources Deployed', value: '1,842', icon: '📦', color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', change: '+182 this week', up: true },
              { label: 'Regions Covered', value: '38', icon: '🗺️', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', change: '+2 new regions', up: true },
              { label: 'Budget Utilized', value: '73%', icon: '💰', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', change: '↓ 5% vs last week', up: false },
            ].map((s, i) => (
              <div className="stat-card animate-fade-in" key={i} style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="stat-card-header">
                  <span className="stat-card-label">{s.label}</span>
                  <div className="stat-card-icon" style={{ background: s.bg }}>
                    {s.icon}
                  </div>
                </div>
                <div className="stat-card-value" style={{ color: s.color }}>{s.value}</div>
                <div className={`stat-card-change ${s.up ? 'change-up' : 'change-down'}`}>
                  {s.up ? '▲' : '▼'} {s.change}
                </div>
              </div>
            ))}
          </div>

          {/* ── MAIN DASHBOARD GRID ── */}
          <div className="dashboard-grid">

            {/* LEFT: Input Form */}
            <div className="glass-card animate-fade-in">
              <div className="card-header">
                <div className="card-header-icon" style={{ background: 'rgba(59,130,246,0.15)' }}>🎯</div>
                <div>
                  <div className="card-header-title">Incident Analysis</div>
                  <div className="card-header-subtitle">Configure parameters to run AI prediction</div>
                </div>
                <span className="card-header-badge" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)' }}>
                  AI Ready
                </span>
              </div>
              <div className="card-body">
                <form onSubmit={handleSubmit} className="form-section">

                  <div className="form-group">
                    <div className="form-label">Disaster Type</div>
                    <div className="disaster-pills">
                      {DISASTER_TYPES.map(({ name, icon, cls }) => (
                        <button
                          type="button"
                          key={name}
                          className={`disaster-pill ${cls} ${form.disaster_type === name ? 'active' : ''}`}
                          onClick={() => selectDisaster(name)}
                        >
                          {icon} {name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">💀 Deaths</label>
                      <input
                        className="form-input"
                        type="number"
                        name="deaths"
                        value={form.deaths}
                        onChange={handleChange}
                        placeholder="e.g. 150"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">👥 Affected Population</label>
                      <input
                        className="form-input"
                        type="number"
                        name="affected"
                        value={form.affected}
                        onChange={handleChange}
                        placeholder="e.g. 50,000"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">💸 Estimated Damage (USD)</label>
                      <input
                        className="form-input"
                        type="number"
                        name="damage_usd"
                        value={form.damage_usd}
                        onChange={handleChange}
                        placeholder="e.g. 5,000,000"
                        required
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">🏦 Available Budget (USD)</label>
                      <input
                        className="form-input"
                        type="number"
                        name="budget"
                        value={form.budget}
                        onChange={handleChange}
                        placeholder="e.g. 5,000,000"
                        required
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="error-box">
                      ⚠️ {error}
                    </div>
                  )}

                  <button type="submit" className="btn-submit" disabled={loading}>
                    {loading ? (
                      <><div className="btn-spinner" /> Analyzing Disaster Data...</>
                    ) : (
                      <> 🚀 Run AI Prediction & Optimize</>
                    )}
                  </button>
                </form>
              </div>
            </div>

            {/* RIGHT: Results Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {prediction && optimization ? (
                <div className="results-panel">

                  {/* Severity Card */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-header-icon" style={{ background: 'rgba(239,68,68,0.15)' }}>🔍</div>
                      <div>
                        <div className="card-header-title">Prediction Result</div>
                        <div className="card-header-subtitle">ML severity classification</div>
                      </div>
                    </div>
                    <div className="card-body severity-block">
                      <div className="severity-row">
                        <SeverityBadge level={prediction.severity_level} />
                        <div className="severity-meta">
                          <div className="severity-meta-item">
                            <span className="severity-meta-label">Confidence</span>
                            <span className="severity-meta-value">{prediction.confidence_pct}%</span>
                          </div>
                          <div className="severity-meta-item">
                            <span className="severity-meta-label">Score</span>
                            <span className="severity-meta-value">{prediction.severity_score}</span>
                          </div>
                        </div>
                      </div>
                      <div className="score-bar-track">
                        <div
                          className={`score-bar-fill bar-${prediction.severity_level}`}
                          style={{ width: `${scorePercent}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Resource Allocation */}
                  <div className="glass-card">
                    <div className="card-header">
                      <div className="card-header-icon" style={{ background: 'rgba(139,92,246,0.15)' }}>📦</div>
                      <div>
                        <div className="card-header-title">Resource Allocation</div>
                        <div className="card-header-subtitle">LP-optimized deployment plan</div>
                      </div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      <div className="resource-cards">
                        <div className="resource-card rc-food">
                          <div className="rc-icon">🍱</div>
                          <div className="rc-label">Food Kits</div>
                          <div className="rc-value">{optimization.resource_plan.food_kits?.toLocaleString()}</div>
                        </div>
                        <div className="resource-card rc-medical">
                          <div className="rc-icon">🏥</div>
                          <div className="rc-label">Medical</div>
                          <div className="rc-value">{optimization.resource_plan.medical_units?.toLocaleString()}</div>
                        </div>
                        <div className="resource-card rc-shelter">
                          <div className="rc-icon">🏠</div>
                          <div className="rc-label">Shelters</div>
                          <div className="rc-value">{optimization.resource_plan.shelters?.toLocaleString()}</div>
                        </div>
                      </div>

                      <div className="budget-summary">
                        <div className="budget-item">
                          <span className="budget-item-label">Total Cost</span>
                          <span className="budget-item-value bv-total">${optimization.total_cost?.toLocaleString()}</span>
                        </div>
                        {optimization.budget_remaining !== undefined && (
                          <div className="budget-item">
                            <span className="budget-item-label">Remaining</span>
                            <span className="budget-item-value bv-remaining">${optimization.budget_remaining?.toLocaleString()}</span>
                          </div>
                        )}
                        {optimization.budget_shortfall !== undefined && (
                          <div className="budget-item">
                            <span className="budget-item-label">Shortfall</span>
                            <span className="budget-item-value bv-shortfall">${optimization.budget_shortfall?.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="placeholder-panel">
                  <div className="placeholder-icon">📡</div>
                  <div className="placeholder-title">Awaiting Analysis</div>
                  <div className="placeholder-sub">
                    Fill in the incident parameters and click <strong>Run AI Prediction</strong> to see results here.
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── BOTTOM ROW ── */}
          <div className="bottom-row">

            {/* Chart Panel */}
            <div className="glass-card">
              <div className="card-header">
                <div className="card-header-icon" style={{ background: 'rgba(6,182,212,0.15)' }}>📊</div>
                <div>
                  <div className="card-header-title">Resource Distribution Chart</div>
                  <div className="card-header-subtitle">Units allocated per category</div>
                </div>
              </div>
              <div className="card-body">
                {optimization ? (
                  <ResourceChart plan={optimization.resource_plan} />
                ) : (
                  <div className="placeholder-panel" style={{ border: 'none', padding: '30px 0', minHeight: '180px' }}>
                    <div style={{ fontSize: 36, opacity: 0.4 }}>📈</div>
                    <div className="placeholder-sub">Chart will appear after prediction</div>
                  </div>
                )}
              </div>
            </div>

            {/* Info Tiles Panel */}
            <div className="glass-card">
              <div className="card-header">
                <div className="card-header-icon" style={{ background: 'rgba(16,185,129,0.15)' }}>ℹ️</div>
                <div>
                  <div className="card-header-title">System Capabilities</div>
                  <div className="card-header-subtitle">What this platform does</div>
                </div>
              </div>
              <div className="card-body">
                <div className="info-tiles">
                  {[
                    { icon: '🤖', color: 'rgba(59,130,246,0.15)', title: 'ML Classification', body: 'Random Forest model trained on historical disaster data to classify severity.' },
                    { icon: '⚙️', color: 'rgba(139,92,246,0.15)', title: 'LP Optimization', body: 'Linear programming maximizes impact-per-dollar given your available budget.' },
                    { icon: '⚡', color: 'rgba(245,158,11,0.15)', title: 'Real-Time Analysis', body: 'Instant predictions and resource plans in under 2 seconds.' },
                    { icon: '📌', color: 'rgba(16,185,129,0.15)', title: 'Multi-Disaster', body: 'Supports Flood, Earthquake, Cyclone, Drought & Landslide scenarios.' },
                  ].map((tile, i) => (
                    <div className="info-tile" key={i}>
                      <div className="info-tile-icon" style={{ background: tile.color }}>{tile.icon}</div>
                      <div>
                        <div className="info-tile-title">{tile.title}</div>
                        <div className="info-tile-body">{tile.body}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}