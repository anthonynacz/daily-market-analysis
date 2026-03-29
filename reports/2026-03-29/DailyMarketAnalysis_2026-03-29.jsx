import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Nasdaq enters correction territory, down 10% from peak", industry: "Tech", date: "2026-03-27", impact: "High", ticker: "NVDA", recommendation: "HOLD", reason: "Wait for geopolitical clarity before adding to positions in volatile semiconductor space." },
  { id: 2, headline: "AI disruption fears crush software sector — IGV ETF down 23% YTD", industry: "Tech", date: "2026-03-27", impact: "High", ticker: "CRM", recommendation: "WATCH", reason: "Software valuations resetting as AI commoditizes traditional SaaS moats." },
  { id: 3, headline: "Magnificent Seven underperform S&P 500, down 12-13% YTD", industry: "Tech", date: "2026-03-27", impact: "High", ticker: "AAPL", recommendation: "HOLD", reason: "Mega-cap rotation may continue; avoid catching the falling knife." },
  { id: 4, headline: "Microsoft slides in broad tech selloff amid inflation fears", industry: "Tech", date: "2026-03-26", impact: "Medium", ticker: "MSFT", recommendation: "BUY", reason: "Strong cloud and AI fundamentals make this dip an attractive long-term entry." },
  { id: 5, headline: "Artelo Biosciences surges 149.8% on positive clinical data", industry: "Healthcare", date: "2026-03-27", impact: "Medium", ticker: "ARTL", recommendation: "HOLD", reason: "Massive spike is speculative; wait for data confirmation before chasing." },
  { id: 6, headline: "Biotech sector shows resilience as defensive rotation builds", industry: "Healthcare", date: "2026-03-31", impact: "Medium", ticker: "XBI", recommendation: "WATCH", reason: "Biotech may benefit from flight to non-cyclical sectors if downturn deepens." },
  { id: 7, headline: "Healthcare defensive rotation gains momentum amid stagflation fears", industry: "Healthcare", date: "2026-04-01", impact: "Medium", ticker: "UNH", recommendation: "BUY", reason: "UnitedHealth offers stable earnings and dividend growth in uncertain macro." },
  { id: 8, headline: "Crude oil crosses $100/barrel on Iran conflict escalation", industry: "Energy", date: "2026-03-27", impact: "High", ticker: "XOM", recommendation: "BUY", reason: "ExxonMobil directly benefits from elevated crude prices with strong cash flow." },
  { id: 9, headline: "Oil prices surge 6.76% in single session as Brent tops $112", industry: "Energy", date: "2026-03-27", impact: "High", ticker: "CVX", recommendation: "BUY", reason: "Chevron's integrated model provides upside with downside protection." },
  { id: 10, headline: "Middle East escalation threatens sustained energy price shock", industry: "Energy", date: "2026-03-28", impact: "High", ticker: "OXY", recommendation: "WATCH", reason: "Geopolitical premium could reverse sharply on ceasefire news." },
  { id: 11, headline: "Fed rate hike probability crosses 50% for first time in 2026", industry: "Finance", date: "2026-03-31", impact: "High", ticker: "JPM", recommendation: "SELL", reason: "Rate hike uncertainty pressures bank margins and loan demand outlook." },
  { id: 12, headline: "VIX surges 13% to 31.05 signaling extreme market fear", industry: "Finance", date: "2026-03-27", impact: "High", ticker: "SPY", recommendation: "WATCH", reason: "Elevated VIX suggests more volatility ahead; wait for stabilization." },
  { id: 13, headline: "Consumer sentiment drops to 53.3, down 5.8% from February", industry: "Finance", date: "2026-03-27", impact: "Medium", ticker: "WMT", recommendation: "HOLD", reason: "Walmart is well-positioned for consumer trade-down but priced for it." },
  { id: 14, headline: "Nike earnings report due March 31 amid consumer spending concerns", industry: "Finance", date: "2026-03-31", impact: "Medium", ticker: "NKE", recommendation: "WATCH", reason: "Earnings could set tone for consumer discretionary in Q2." },
];

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const REC_COLORS = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#eab308',
  WATCH: '#3b82f6',
};

const TODAY = '2026-03-29';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const DATE_MIN = '2026-03-26';
const DATE_MAX = '2026-04-03';

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800;
  const chartH = 320;
  const pad = { top: 40, right: 30, bottom: 50, left: 60 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  const minDate = parseDate(DATE_MIN);
  const maxDate = parseDate(DATE_MAX);
  const todayDate = parseDate(TODAY);
  const dayRange = (maxDate - minDate) / (1000 * 60 * 60 * 24);

  const impactY = { High: 0.15, Medium: 0.5, Low: 0.85 };

  function xPos(dateStr) {
    const d = parseDate(dateStr);
    const dayOffset = (d - minDate) / (1000 * 60 * 60 * 24);
    return pad.left + (dayOffset / dayRange) * innerW;
  }

  function yPos(impact) {
    return pad.top + (impactY[impact] || 0.5) * innerH;
  }

  const todayX = xPos(TODAY);

  const allDates = [];
  for (let i = 0; i <= dayRange; i++) {
    const d = new Date(minDate);
    d.setDate(d.getDate() + i);
    const str = d.toISOString().slice(0, 10);
    allDates.push(str);
  }

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '20px' }}>March 29, 2026 — US Equities Overview</p>

      {/* Industry filter */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
          <button
            key={ind}
            onClick={() => { setFilterIndustry(ind); setSelected(null); }}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              background: filterIndustry === ind ? (INDUSTRY_COLORS[ind] || '#6366f1') : '#1e293b',
              color: filterIndustry === ind ? '#0b0f1a' : '#94a3b8',
            }}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '16px', marginBottom: '20px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background */}
          <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={innerH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={todayX} y={pad.top} width={pad.left + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines and date labels */}
          {allDates.map(d => {
            const x = xPos(d);
            return (
              <g key={d}>
                <line x1={x} y1={pad.top} x2={x} y2={pad.top + innerH} stroke="#1e293b" strokeWidth={1} />
                <text x={x} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize="11">
                  {d.slice(5)}
                </text>
              </g>
            );
          })}

          {/* Impact labels */}
          {['High', 'Medium', 'Low'].map(level => (
            <text key={level} x={pad.left - 10} y={yPos(level) + 4} textAnchor="end" fill="#64748b" fontSize="12">
              {level}
            </text>
          ))}

          {/* Today line */}
          <line x1={todayX} y1={pad.top - 10} x2={todayX} y2={pad.top + innerH + 10} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={pad.top - 16} textAnchor="middle" fill="#ef4444" fontSize="12" fontWeight="bold">TODAY</text>

          {/* Event dots */}
          {filtered.map(ev => {
            const cx = xPos(ev.date);
            const cy = yPos(ev.impact);
            const isSelected = selected?.id === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx} y={cy - 12} textAnchor="middle" fill="#94a3b8" fontSize="10">{ev.ticker}</text>
              </g>
            );
          })}

          {/* Axis lines */}
          <line x1={pad.left} y1={pad.top + innerH} x2={pad.left + innerW} y2={pad.top + innerH} stroke="#334155" strokeWidth={1} />
          <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + innerH} stroke="#334155" strokeWidth={1} />
        </svg>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>{selected.headline}</h3>
              <p style={{ margin: '0 0 4px 0', color: '#94a3b8', fontSize: '14px' }}>
                <strong>{selected.ticker}</strong> &middot; {selected.industry} &middot; {selected.date} &middot; Impact: {selected.impact}
              </p>
              <p style={{ margin: '8px 0 0 0', color: '#cbd5e1', fontSize: '14px' }}>{selected.reason}</p>
            </div>
            <span style={{
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              background: REC_COLORS[selected.recommendation],
              color: selected.recommendation === 'HOLD' ? '#0b0f1a' : '#fff',
              whiteSpace: 'nowrap',
            }}>
              {selected.recommendation}
            </span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '13px', color: '#94a3b8' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Industry', 'Impact', 'Rec', 'Headline'].map(h => (
                <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => (
              <tr
                key={ev.id}
                onClick={() => setSelected(ev)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}
              >
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{ev.date.slice(5)}</td>
                <td style={{ padding: '10px 14px', fontWeight: 700, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{ev.industry}</td>
                <td style={{ padding: '10px 14px', color: ev.impact === 'High' ? '#ef4444' : '#eab308' }}>{ev.impact}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '2px 10px',
                    borderRadius: '12px',
                    fontSize: '11px',
                    fontWeight: 700,
                    background: REC_COLORS[ev.recommendation],
                    color: ev.recommendation === 'HOLD' ? '#0b0f1a' : '#fff',
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: '340px' }}>{ev.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
        Generated {TODAY} &middot; For informational purposes only &middot; Not financial advice
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
