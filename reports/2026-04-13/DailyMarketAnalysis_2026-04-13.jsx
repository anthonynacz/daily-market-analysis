import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Hormuz Strait Blockade Sends Oil Past $100", industry: "Energy", date: "2026-04-13", impact: "High", ticker: "XOM", recommendation: "BUY", reason: "Oil above $100 as Hormuz blockade disrupts 20% of global supply; Exxon benefits directly from sustained high crude prices." },
  { id: 2, headline: "Chevron Surges on Crude Oil Price Spike", industry: "Energy", date: "2026-04-13", impact: "High", ticker: "CVX", recommendation: "BUY", reason: "Major integrated oil company well-positioned with diversified upstream portfolio benefiting from $103+ WTI crude." },
  { id: 3, headline: "Occidental Petroleum Whipsaws on Geopolitical Risk", industry: "Energy", date: "2026-04-13", impact: "Medium", ticker: "OXY", recommendation: "WATCH", reason: "Permian exposure benefits from high prices but geopolitical uncertainty and position volatility add risk." },
  { id: 4, headline: "Goldman Sachs Misses on FICC Revenue", industry: "Finance", date: "2026-04-13", impact: "High", ticker: "GS", recommendation: "SELL", reason: "Revenue miss in fixed-income trading despite record equities haul; premarket down 4.5% signals weak sentiment." },
  { id: 5, headline: "JPMorgan Chase Q1 Earnings Report", industry: "Finance", date: "2026-04-14", impact: "High", ticker: "JPM", recommendation: "WATCH", reason: "Bellwether bank sets the tone for earnings season; consumer credit quality and NII guidance are key metrics." },
  { id: 6, headline: "Citigroup Q1 Earnings Report", industry: "Finance", date: "2026-04-14", impact: "High", ticker: "C", recommendation: "WATCH", reason: "Restructuring progress under CEO Fraser and trading revenue will reveal transformation trajectory." },
  { id: 7, headline: "Johnson & Johnson Q1 Earnings", industry: "Healthcare", date: "2026-04-14", impact: "High", ticker: "JNJ", recommendation: "HOLD", reason: "Pharma pipeline strength and MedTech recovery are key growth drivers; talc liabilities remain an overhang." },
  { id: 8, headline: "BlackRock Q1 Earnings Report", industry: "Finance", date: "2026-04-14", impact: "Medium", ticker: "BLK", recommendation: "WATCH", reason: "AUM flows and ETF market share trends critical as passive investing dominance continues." },
  { id: 9, headline: "Bank of America Q1 Earnings", industry: "Finance", date: "2026-04-15", impact: "High", ticker: "BAC", recommendation: "WATCH", reason: "Rate sensitivity and consumer credit quality in focus amid macroeconomic uncertainty." },
  { id: 10, headline: "Morgan Stanley Q1 Earnings", industry: "Finance", date: "2026-04-15", impact: "Medium", ticker: "MS", recommendation: "WATCH", reason: "Wealth management growth and trading desk performance are key catalysts to monitor." },
  { id: 11, headline: "Abbott Laboratories Q1 Earnings", industry: "Healthcare", date: "2026-04-16", impact: "Medium", ticker: "ABT", recommendation: "WATCH", reason: "Medical device demand growth and diagnostics revenue normalization trajectory in focus." },
  { id: 12, headline: "Netflix Q1 Earnings Report", industry: "Tech", date: "2026-04-16", impact: "High", ticker: "NFLX", recommendation: "WATCH", reason: "Subscriber growth and ad-tier monetization critical after strong Q4 momentum." },
  { id: 13, headline: "CPI Inflation Holds at 3.4% YoY", industry: "Finance", date: "2026-04-10", impact: "High", ticker: "TLT", recommendation: "HOLD", reason: "Inflation still above Fed 2% target keeps rate cuts unlikely near-term; bond yields remain elevated." },
  { id: 14, headline: "Nasdaq Posts Best Week Since November (+4.7%)", industry: "Tech", date: "2026-04-10", impact: "Medium", ticker: "QQQ", recommendation: "HOLD", reason: "Weekly rally on Iran peace hopes now at risk of reversal after weekend talks collapsed." },
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

const IMPACT_VALUES = { High: 3, Medium: 2, Low: 1 };

const TODAY = '2026-04-13';
const DATE_MIN = '2026-04-10';
const DATE_MAX = '2026-04-18';

function daysBetween(a, b) {
  return (new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24);
}

function formatDateLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function ScatterChart({ events, onSelect, selectedId }) {
  const margin = { top: 36, right: 36, bottom: 56, left: 56 };
  const width = 860;
  const height = 340;
  const innerW = width - margin.left - margin.right;
  const innerH = height - margin.top - margin.bottom;

  const totalDays = daysBetween(DATE_MIN, DATE_MAX);
  const todayX = margin.left + (daysBetween(DATE_MIN, TODAY) / totalDays) * innerW;

  const dateLabels = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(new Date(DATE_MIN + 'T00:00:00').getTime() + i * 86400000);
    const iso = d.toISOString().slice(0, 10);
    dateLabels.push({ iso, x: margin.left + (i / totalDays) * innerW });
  }

  const impactLevels = [
    { label: 'High', value: 3 },
    { label: 'Medium', value: 2 },
    { label: 'Low', value: 1 },
  ];

  const offsetMap = {};
  const dots = events.map((ev) => {
    const dx = daysBetween(DATE_MIN, ev.date);
    const x = margin.left + (dx / totalDays) * innerW;
    const baseY = margin.top + innerH - ((IMPACT_VALUES[ev.impact] - 0.5) / 3) * innerH;
    const key = `${ev.date}-${ev.impact}`;
    offsetMap[key] = (offsetMap[key] || 0) + 1;
    const offset = (offsetMap[key] - 1) * 22 - ((offsetMap[key] - 1) * 22) / 2;
    return { ...ev, cx: x + offset, cy: baseY };
  });

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', maxWidth: width, display: 'block', margin: '0 auto' }}>
      <rect x={margin.left} y={margin.top} width={todayX - margin.left} height={innerH} fill="rgba(239,68,68,0.06)" />
      <rect x={todayX} y={margin.top} width={margin.left + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />
      <line x1={todayX} y1={margin.top - 8} x2={todayX} y2={margin.top + innerH + 8} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />
      <text x={todayX} y={margin.top - 14} fill="#ef4444" textAnchor="middle" fontSize="11" fontWeight="bold">TODAY</text>
      <line x1={margin.left} y1={margin.top + innerH} x2={margin.left + innerW} y2={margin.top + innerH} stroke="#334155" strokeWidth="1" />
      <line x1={margin.left} y1={margin.top} x2={margin.left} y2={margin.top + innerH} stroke="#334155" strokeWidth="1" />
      {dateLabels.map((d) => (
        <g key={d.iso}>
          <line x1={d.x} y1={margin.top + innerH} x2={d.x} y2={margin.top + innerH + 6} stroke="#475569" strokeWidth="1" />
          <text x={d.x} y={margin.top + innerH + 22} fill="#94a3b8" textAnchor="middle" fontSize="10">{formatDateLabel(d.iso)}</text>
        </g>
      ))}
      {impactLevels.map((lvl) => {
        const y = margin.top + innerH - ((lvl.value - 0.5) / 3) * innerH;
        return (
          <g key={lvl.label}>
            <line x1={margin.left - 6} y1={y} x2={margin.left + innerW} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
            <text x={margin.left - 12} y={y + 4} fill="#94a3b8" textAnchor="end" fontSize="11">{lvl.label}</text>
          </g>
        );
      })}
      <text x={width / 2} y={height - 4} fill="#64748b" textAnchor="middle" fontSize="11">Date</text>
      <text x={14} y={margin.top + innerH / 2} fill="#64748b" textAnchor="middle" fontSize="11" transform={`rotate(-90,14,${margin.top + innerH / 2})`}>Impact</text>
      {dots.map((dot) => (
        <g key={dot.id} onClick={() => onSelect(dot.id)} style={{ cursor: 'pointer' }}>
          <circle cx={dot.cx} cy={dot.cy} r={selectedId === dot.id ? 10 : 7} fill={INDUSTRY_COLORS[dot.industry]} opacity={selectedId === dot.id ? 1 : 0.85} stroke={selectedId === dot.id ? '#fff' : 'none'} strokeWidth="2" />
          <text x={dot.cx} y={dot.cy - 12} fill="#e2e8f0" textAnchor="middle" fontSize="9" fontWeight="600">{dot.ticker}</text>
        </g>
      ))}
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return (
    <div style={{ background: '#151c2c', borderRadius: 10, padding: 24, textAlign: 'center', color: '#64748b', marginTop: 16 }}>
      Click a dot on the chart to view event details.
    </div>
  );
  return (
    <div style={{ background: '#151c2c', borderRadius: 10, padding: 24, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{event.headline}</span>
        <span style={{ background: REC_COLORS[event.recommendation], color: '#fff', borderRadius: 999, padding: '2px 14px', fontSize: 13, fontWeight: 700 }}>{event.recommendation}</span>
      </div>
      <div style={{ display: 'flex', gap: 20, marginTop: 12, flexWrap: 'wrap' }}>
        <span style={{ color: '#94a3b8' }}>Ticker: <strong style={{ color: INDUSTRY_COLORS[event.industry] }}>{event.ticker}</strong></span>
        <span style={{ color: '#94a3b8' }}>Industry: <strong style={{ color: INDUSTRY_COLORS[event.industry] }}>{event.industry}</strong></span>
        <span style={{ color: '#94a3b8' }}>Date: <strong style={{ color: '#e2e8f0' }}>{event.date}</strong></span>
        <span style={{ color: '#94a3b8' }}>Impact: <strong style={{ color: '#e2e8f0' }}>{event.impact}</strong></span>
      </div>
      <p style={{ color: '#cbd5e1', marginTop: 12, lineHeight: 1.6 }}>{event.reason}</p>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', marginTop: 8 }}>
      {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

function EventTable({ events, onSelect, selectedId }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr>
            {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec.'].map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', borderBottom: '1px solid #1e293b', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr
              key={ev.id}
              onClick={() => onSelect(ev.id)}
              style={{ cursor: 'pointer', background: selectedId === ev.id ? '#1e293b' : 'transparent' }}
            >
              <td style={{ padding: '10px 12px', color: '#cbd5e1', borderBottom: '1px solid #1e293b', whiteSpace: 'nowrap' }}>{ev.date}</td>
              <td style={{ padding: '10px 12px', color: INDUSTRY_COLORS[ev.industry], fontWeight: 700, borderBottom: '1px solid #1e293b' }}>{ev.ticker}</td>
              <td style={{ padding: '10px 12px', color: '#e2e8f0', borderBottom: '1px solid #1e293b' }}>{ev.headline}</td>
              <td style={{ padding: '10px 12px', color: INDUSTRY_COLORS[ev.industry], borderBottom: '1px solid #1e293b' }}>{ev.industry}</td>
              <td style={{ padding: '10px 12px', color: '#e2e8f0', borderBottom: '1px solid #1e293b' }}>{ev.impact}</td>
              <td style={{ padding: '10px 12px', borderBottom: '1px solid #1e293b' }}>
                <span style={{ background: REC_COLORS[ev.recommendation], color: '#fff', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{ev.recommendation}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DailyMarketAnalysis() {
  const [selectedId, setSelectedId] = useState(null);

  const sortedEvents = useMemo(() => [...EVENTS].sort((a, b) => a.date.localeCompare(b.date) || IMPACT_VALUES[b.impact] - IMPACT_VALUES[a.impact]), []);
  const selectedEvent = useMemo(() => EVENTS.find((e) => e.id === selectedId) || null, [selectedId]);

  const handleSelect = (id) => setSelectedId((prev) => (prev === id ? null : id));

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', padding: 32, fontFamily: "'Inter', 'Segoe UI', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 28, fontWeight: 800, margin: 0 }}>Daily Market Analysis</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginTop: 4 }}>April 13, 2026 &mdash; Hormuz blockade roils markets as Q1 earnings season kicks off</p>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, margin: '0 0 12px' }}>Market Event Timeline</h2>
          <ScatterChart events={sortedEvents} onSelect={handleSelect} selectedId={selectedId} />
          <Legend />
        </div>

        <DetailPanel event={selectedEvent} />

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 24, marginTop: 24 }}>
          <h2 style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 700, margin: '0 0 4px' }}>All Events</h2>
          <EventTable events={sortedEvents} onSelect={handleSelect} selectedId={selectedId} />
        </div>

        <p style={{ color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 24 }}>
          Generated by Daily Market Analysis &bull; Data as of April 13, 2026 &bull; Not financial advice
        </p>
      </div>
    </div>
  );
}

export default DailyMarketAnalysis;
