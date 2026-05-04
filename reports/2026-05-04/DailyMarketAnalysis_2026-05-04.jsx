import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Apple Q2 Earnings Beat, Revenue Outlook Strong", industry: "Tech", date: "2026-05-01", impact: "High", ticker: "AAPL", recommendation: "BUY", reason: "Fiscal Q2 beat with strong guidance; 3%+ post-earnings rally shows confidence" },
  { id: 2, headline: "Palantir Technologies Reports Q1 Earnings", industry: "Tech", date: "2026-05-04", impact: "High", ticker: "PLTR", recommendation: "WATCH", reason: "AI/defense spending tailwinds; earnings after close today are pivotal" },
  { id: 3, headline: "AMD Earnings Report on Deck", industry: "Tech", date: "2026-05-06", impact: "High", ticker: "AMD", recommendation: "WATCH", reason: "Data center GPU growth and AI chip competition with NVDA in focus" },
  { id: 4, headline: "GameStop Proposes $56B Acquisition of eBay", industry: "Tech", date: "2026-05-02", impact: "High", ticker: "EBAY", recommendation: "HOLD", reason: "20% premium offered but regulatory and financing hurdles remain" },
  { id: 5, headline: "Pfizer Q1 Earnings Report Pre-Market", industry: "Healthcare", date: "2026-05-05", impact: "High", ticker: "PFE", recommendation: "WATCH", reason: "Pipeline progress and cost-cutting results will set direction" },
  { id: 6, headline: "Healthcare Sector Braces for Geopolitical Volatility", industry: "Healthcare", date: "2026-05-04", impact: "Medium", ticker: "UNH", recommendation: "HOLD", reason: "Defensive positioning as Iran tensions weigh on broader market" },
  { id: 7, headline: "Oil Surges on US-Iran Strait of Hormuz Tensions", industry: "Energy", date: "2026-05-04", impact: "High", ticker: "XOM", recommendation: "BUY", reason: "Geopolitical risk premium expanding; crude supply disruption fears" },
  { id: 8, headline: "Iran Missile Reports Roil Global Energy Markets", industry: "Energy", date: "2026-05-04", impact: "High", ticker: "CVX", recommendation: "WATCH", reason: "Conflicting reports on US frigate hit; extreme volatility expected" },
  { id: 9, headline: "Natural Gas Prices Climb on Middle East Uncertainty", industry: "Energy", date: "2026-05-05", impact: "Medium", ticker: "LNG", recommendation: "WATCH", reason: "LNG demand could spike if Strait of Hormuz shipping is disrupted" },
  { id: 10, headline: "S&P 500 Closes at Fresh All-Time High of 7,230", industry: "Finance", date: "2026-05-01", impact: "High", ticker: "SPY", recommendation: "HOLD", reason: "Momentum is strong but market is extended at record levels" },
  { id: 11, headline: "Nasdaq Composite Surges to Record 25,114", industry: "Finance", date: "2026-05-01", impact: "High", ticker: "QQQ", recommendation: "HOLD", reason: "Tech-driven rally; valuations stretched but trend intact" },
  { id: 12, headline: "Walt Disney Earnings Report Due Thursday", industry: "Finance", date: "2026-05-07", impact: "High", ticker: "DIS", recommendation: "WATCH", reason: "Streaming profitability and parks revenue are key metrics" },
  { id: 13, headline: "Dow Futures Drop on Iran Conflict Escalation", industry: "Finance", date: "2026-05-04", impact: "High", ticker: "DIA", recommendation: "WATCH", reason: "Geopolitical risk dragging futures down; watch for de-escalation" },
  { id: 14, headline: "Fed Consumer Credit Data Release", industry: "Finance", date: "2026-05-07", impact: "Medium", ticker: "JPM", recommendation: "HOLD", reason: "Consumer debt trends signal spending outlook for banks" },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const TODAY = '2026-05-04';

const DATES = ['2026-05-01','2026-05-02','2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-05-07','2026-05-08','2026-05-09'];
const DATE_LABELS = ['May 1','May 2','May 3','May 4','May 5','May 6','May 7','May 8','May 9'];
const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800, chartH = 300, padL = 50, padR = 30, padT = 30, padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const dateToX = (d) => {
    const idx = DATES.indexOf(d);
    if (idx === -1) return padL;
    return padL + (idx / (DATES.length - 1)) * plotW;
  };

  const impactToY = (imp) => {
    const val = IMPACT_MAP[imp] || 2;
    return padT + plotH - ((val - 0.5) / 3) * plotH;
  };

  const todayX = dateToX(TODAY);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>May 4, 2026 — 14 Key Events Across 4 Industries</p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
          <button key={ind} onClick={() => { setFilterIndustry(ind); setSelected(null); }}
            style={{ padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: filterIndustry === ind ? (ind === 'All' ? '#6366f1' : INDUSTRY_COLORS[ind]) : '#1e293b',
              color: filterIndustry === ind ? '#fff' : '#94a3b8' }}>
            {ind}
          </button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.05)" />
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.05)" />
          {[1, 2, 3].map(v => {
            const y = padT + plotH - ((v - 0.5) / 3) * plotH;
            return <g key={v}>
              <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
              <text x={padL - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}>{v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}</text>
            </g>;
          })}
          {DATES.map((d, i) => {
            const x = dateToX(d);
            return <text key={d} x={x} y={chartH - 8} textAnchor="middle" fill="#64748b" fontSize={11}>{DATE_LABELS[i]}</text>;
          })}
          <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>
          {filtered.map((ev, i) => {
            const baseX = dateToX(ev.date);
            const baseY = impactToY(ev.impact);
            const sameSpot = filtered.filter((e, j) => j < i && e.date === ev.date && e.impact === ev.impact);
            const ox = sameSpot.length * 18;
            const cx = baseX + ox;
            const cy = baseY;
            return (
              <g key={ev.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected?.id === ev.id ? null : ev)}>
                <circle cx={cx} cy={cy} r={selected?.id === ev.id ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={selected?.id === ev.id ? 1 : 0.85}
                  stroke={selected?.id === ev.id ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#0b0f1a" fontSize={8} fontWeight={700}>{ev.ticker.slice(0, 3)}</text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '12px' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 6px 0' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '14px' }}>
                {selected.ticker} · {selected.industry} · {selected.date} · Impact: {selected.impact}
              </p>
              <p style={{ color: '#cbd5e1', margin: 0, fontSize: '14px' }}>{selected.reason}</p>
            </div>
            <span style={{ padding: '6px 16px', borderRadius: '999px', fontSize: '13px', fontWeight: 700,
              background: REC_COLORS[selected.recommendation] + '22', color: REC_COLORS[selected.recommendation] }}>
              {selected.recommendation}
            </span>
          </div>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginTop: 0, marginBottom: '12px' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: '1px solid #1e293b11', cursor: 'pointer' }}
                onMouseOver={e => e.currentTarget.style.background = '#1e293b'} onMouseOut={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '8px 10px', color: '#94a3b8' }}>{ev.date}</td>
                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{ev.ticker}</td>
                <td style={{ padding: '8px 10px' }}>{ev.headline}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '8px 10px' }}>{ev.impact}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: '999px', fontSize: '11px', fontWeight: 700,
                    background: REC_COLORS[ev.recommendation] + '22', color: REC_COLORS[ev.recommendation] }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DailyMarketAnalysis;
