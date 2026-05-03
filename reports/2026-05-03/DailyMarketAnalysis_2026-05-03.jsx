import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const events = [
  { id: 1, headline: 'Apple Q2 Earnings Beat Expectations', ticker: 'AAPL', industry: 'Tech', date: '2026-05-01', impact: 'High', recommendation: 'BUY', reason: 'Strong revenue beat with positive Q3 outlook signals continued AI-driven growth.' },
  { id: 2, headline: 'Roblox Slashes 2026 Bookings Guidance', ticker: 'RBLX', industry: 'Tech', date: '2026-05-01', impact: 'High', recommendation: 'SELL', reason: '24% premarket drop after cutting full-year bookings forecast significantly.' },
  { id: 3, headline: 'Palantir Technologies Q1 Earnings', ticker: 'PLTR', industry: 'Tech', date: '2026-05-04', impact: 'Medium', recommendation: 'WATCH', reason: 'AI and defense demand trends are key to the next directional move.' },
  { id: 4, headline: 'AMD Q1 Earnings Report', ticker: 'AMD', industry: 'Tech', date: '2026-05-05', impact: 'High', recommendation: 'WATCH', reason: 'AI chip competition with Nvidia makes this a pivotal quarterly report.' },
  { id: 5, headline: 'Arista Networks Q1 Earnings', ticker: 'ANET', industry: 'Tech', date: '2026-05-05', impact: 'Medium', recommendation: 'WATCH', reason: 'Data center networking demand reflects broader AI infrastructure spending.' },
  { id: 6, headline: 'Walt Disney Q2 Earnings Report', ticker: 'DIS', industry: 'Tech', date: '2026-05-07', impact: 'Medium', recommendation: 'HOLD', reason: 'Streaming profitability improving but theme parks face macro headwinds.' },
  { id: 7, headline: 'Pfizer Q1 Earnings Report', ticker: 'PFE', industry: 'Healthcare', date: '2026-05-05', impact: 'Medium', recommendation: 'HOLD', reason: 'Pipeline execution is critical as COVID-era revenue continues to fade.' },
  { id: 8, headline: 'Vertex Pharma Q1 Earnings', ticker: 'VRTX', industry: 'Healthcare', date: '2026-05-04', impact: 'High', recommendation: 'WATCH', reason: 'Gene therapy pipeline updates could be a transformative catalyst.' },
  { id: 9, headline: 'CVS Health Q1 Earnings Report', ticker: 'CVS', industry: 'Healthcare', date: '2026-05-07', impact: 'Medium', recommendation: 'HOLD', reason: 'Healthcare services integration and cost management progress in focus.' },
  { id: 10, headline: 'Iran-US Peace Talks Pressure Oil Prices', ticker: 'XOM', industry: 'Energy', date: '2026-05-01', impact: 'High', recommendation: 'SELL', reason: 'Crude oil fell 2% on peace deal hopes with further downside risk ahead.' },
  { id: 11, headline: 'Occidental Petroleum Q1 Earnings', ticker: 'OXY', industry: 'Energy', date: '2026-05-05', impact: 'Medium', recommendation: 'HOLD', reason: 'Buffett-backed but facing oil price headwinds from geopolitical easing.' },
  { id: 12, headline: 'HSBC Holdings Q1 Earnings Report', ticker: 'HSBC', industry: 'Finance', date: '2026-05-05', impact: 'Medium', recommendation: 'HOLD', reason: 'Global banking bellwether navigating interest rate uncertainty.' },
  { id: 13, headline: 'Prudential Financial Q1 Earnings', ticker: 'PRU', industry: 'Finance', date: '2026-05-05', impact: 'Medium', recommendation: 'WATCH', reason: 'Insurance and asset management positioning in a shifting rate environment.' },
  { id: 14, headline: 'April Nonfarm Payrolls Report', ticker: 'SPY', industry: 'Finance', date: '2026-05-08', impact: 'High', recommendation: 'WATCH', reason: 'Key employment data will shape Fed rate cut expectations for H2 2026.' },
];

const dateLabels = ['Apr 30', 'May 1', 'May 2', 'May 3', 'May 4', 'May 5', 'May 6', 'May 7', 'May 8'];
const impactLabels = ['High', 'Medium', 'Low'];
const todayIdx = 3;
const dateMap = { '2026-04-30': 0, '2026-05-01': 1, '2026-05-02': 2, '2026-05-03': 3, '2026-05-04': 4, '2026-05-05': 5, '2026-05-06': 6, '2026-05-07': 7, '2026-05-08': 8 };
const impactMap = { High: 0, Medium: 1, Low: 2 };

const P = { left: 80, right: 30, top: 40, bottom: 60 };
const W = 900, H = 380;
const plotW = W - P.left - P.right;
const plotH = H - P.top - P.bottom;
const xStep = plotW / 8;
const yStep = plotH / 3;

function App() {
  const [selectedId, setSelectedId] = useState(null);

  const positions = useMemo(() => {
    const groups = {};
    events.forEach(e => {
      const key = `${dateMap[e.date]}-${impactMap[e.impact]}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e.id);
    });
    const pos = {};
    events.forEach(e => {
      const di = dateMap[e.date];
      const ii = impactMap[e.impact];
      const key = `${di}-${ii}`;
      const group = groups[key];
      const idx = group.indexOf(e.id);
      const count = group.length;
      const spread = 16;
      const offsetX = count > 1 ? (idx - (count - 1) / 2) * spread : 0;
      pos[e.id] = { x: P.left + di * xStep + offsetX, y: P.top + ii * yStep + yStep / 2 };
    });
    return pos;
  }, []);

  const selected = events.find(e => e.id === selectedId);
  const todayX = P.left + todayIdx * xStep;

  const styles = {
    root: { background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: 24 },
    container: { maxWidth: 960, margin: '0 auto' },
    title: { fontSize: 28, fontWeight: 700, marginBottom: 4 },
    subtitle: { color: '#94a3b8', marginBottom: 8, fontSize: 14 },
    legend: { display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' },
    legendDot: (c) => ({ width: 12, height: 12, borderRadius: '50%', background: c }),
    legendItem: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 },
    card: { background: '#151c2c', borderRadius: 12, padding: 16, marginBottom: 16 },
    detailCard: (c) => ({ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 16, border: `1px solid ${c}33` }),
    badge: (bg, dark) => ({ background: bg, color: dark ? '#000' : '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }),
    recBadge: (bg, dark) => ({ background: bg, color: dark ? '#000' : '#fff', padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700 }),
    recBadgeSm: (bg, dark) => ({ background: bg, color: dark ? '#000' : '#fff', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }),
    tableWrap: { background: '#151c2c', borderRadius: 12, overflow: 'hidden' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
    th: { padding: '12px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' },
    td: { padding: '10px 14px' },
  };

  return (
    <div style={styles.root}>
      <div style={styles.container}>
        <h1 style={styles.title}>Daily Market Analysis</h1>
        <p style={styles.subtitle}>May 3, 2026 — S&P 500: 7,230.12 (ATH) | Nasdaq: 25,114.44 (ATH) | Dow: 49,499.27</p>

        <div style={styles.legend}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={styles.legendItem}>
              <div style={styles.legendDot(color)} />
              <span>{name}</span>
            </div>
          ))}
        </div>

        <div style={styles.card}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            <rect x={P.left} y={P.top} width={todayX - P.left} height={plotH} fill="rgba(239,68,68,0.06)" />
            <rect x={todayX} y={P.top} width={P.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

            {impactLabels.map((label, i) => {
              const y = P.top + i * yStep + yStep / 2;
              return (
                <g key={label}>
                  <line x1={P.left} y1={y} x2={P.left + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                  <text x={P.left - 12} y={y + 4} textAnchor="end" fill="#64748b" fontSize={12}>{label}</text>
                </g>
              );
            })}

            {dateLabels.map((label, i) => (
              <text key={i} x={P.left + i * xStep} y={H - 15} textAnchor="middle" fill={i === todayIdx ? '#f87171' : '#64748b'} fontSize={12} fontWeight={i === todayIdx ? 700 : 400}>{label}</text>
            ))}

            <line x1={todayX} y1={P.top} x2={todayX} y2={P.top + plotH} stroke="#f87171" strokeWidth={2} strokeDasharray="6 4" />
            <text x={todayX} y={P.top - 8} textAnchor="middle" fill="#f87171" fontSize={11} fontWeight={600}>TODAY</text>

            {events.map(e => {
              const p = positions[e.id];
              return (
                <circle
                  key={e.id}
                  cx={p.x}
                  cy={p.y}
                  r={selectedId === e.id ? 10 : 7}
                  fill={INDUSTRY_COLORS[e.industry]}
                  stroke={selectedId === e.id ? '#fff' : 'none'}
                  strokeWidth={2}
                  style={{ cursor: 'pointer', transition: 'r 0.15s' }}
                  onClick={() => setSelectedId(selectedId === e.id ? null : e.id)}
                />
              );
            })}
          </svg>
        </div>

        {selected && (
          <div style={styles.detailCard(INDUSTRY_COLORS[selected.industry])}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{selected.headline}</h3>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={styles.badge(INDUSTRY_COLORS[selected.industry] + '22', false)}>{selected.industry}</span>
                  <span style={{ color: '#94a3b8', fontSize: 13 }}>{selected.ticker} · {selected.date} · {selected.impact} Impact</span>
                </div>
              </div>
              <span style={styles.recBadge(REC_COLORS[selected.recommendation], selected.recommendation === 'HOLD')}>{selected.recommendation}</span>
            </div>
            <p style={{ color: '#cbd5e1', marginTop: 12, fontSize: 14, lineHeight: 1.5 }}>{selected.reason}</p>
          </div>
        )}

        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                  <th key={h} style={styles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map(e => (
                <tr key={e.id} onClick={() => setSelectedId(e.id)} style={{ borderBottom: '1px solid #1e293b11', cursor: 'pointer', background: selectedId === e.id ? '#1e293b' : 'transparent' }}>
                  <td style={{ ...styles.td, color: '#94a3b8' }}>{e.date.slice(5)}</td>
                  <td style={{ ...styles.td, fontWeight: 600 }}>{e.ticker}</td>
                  <td style={styles.td}>{e.headline}</td>
                  <td style={styles.td}><span style={{ color: INDUSTRY_COLORS[e.industry] }}>{e.industry}</span></td>
                  <td style={{ ...styles.td, color: e.impact === 'High' ? '#f87171' : '#94a3b8' }}>{e.impact}</td>
                  <td style={styles.td}><span style={styles.recBadgeSm(REC_COLORS[e.recommendation], e.recommendation === 'HOLD')}>{e.recommendation}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;
