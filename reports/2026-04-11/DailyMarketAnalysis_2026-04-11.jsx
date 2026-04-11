import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: 'Nvidia leads semiconductor rally on surging AI chip demand', industry: 'Tech', date: '2026-04-09', impact: 'High', ticker: 'NVDA', recommendation: 'BUY', reason: 'AI chip demand continues to accelerate with no signs of slowing; strong momentum play.' },
  { id: 2, headline: 'Netflix Q1 2026 earnings report — subscriber growth and ad-tier momentum', industry: 'Tech', date: '2026-04-16', impact: 'High', ticker: 'NFLX', recommendation: 'BUY', reason: 'Ad-supported tier driving revenue diversification; subscriber growth expected to beat estimates.' },
  { id: 3, headline: 'SaaS stocks plunge on fears AI will disrupt software business models', industry: 'Tech', date: '2026-04-10', impact: 'Medium', ticker: 'CRM', recommendation: 'SELL', reason: 'AI agents threaten traditional SaaS seat-based pricing; sector repricing underway.' },
  { id: 4, headline: 'Broadcom surges on AI infrastructure and networking demand', industry: 'Tech', date: '2026-04-09', impact: 'Medium', ticker: 'AVGO', recommendation: 'BUY', reason: 'Custom AI chip and networking business expanding rapidly with hyperscaler customers.' },
  { id: 5, headline: 'Johnson & Johnson Q1 earnings report — pharma stable but litigation looms', industry: 'Healthcare', date: '2026-04-14', impact: 'High', ticker: 'JNJ', recommendation: 'HOLD', reason: 'Pharma and MedTech segments solid but talc litigation overhang limits upside.' },
  { id: 6, headline: 'Abbott Laboratories Q1 earnings — medical device growth in focus', industry: 'Healthcare', date: '2026-04-16', impact: 'Medium', ticker: 'ABT', recommendation: 'HOLD', reason: 'Medical device segment growing but diagnostics revenue normalizing post-pandemic.' },
  { id: 7, headline: 'Pfizer pressured as CPI data reignites drug pricing concerns', industry: 'Healthcare', date: '2026-04-10', impact: 'Low', ticker: 'PFE', recommendation: 'HOLD', reason: 'Rising healthcare costs in CPI increase political pressure on pharma pricing.' },
  { id: 8, headline: 'ExxonMobil rallies as oil surges near $98/barrel on Iran tensions', industry: 'Energy', date: '2026-04-09', impact: 'High', ticker: 'XOM', recommendation: 'WATCH', reason: 'Oil price spike driven by geopolitics not fundamentals; high uncertainty warrants caution.' },
  { id: 9, headline: 'Chevron faces Strait of Hormuz supply disruption risk', industry: 'Energy', date: '2026-04-11', impact: 'High', ticker: 'CVX', recommendation: 'HOLD', reason: 'Strong balance sheet provides cushion but Hormuz shipping risk clouds near-term outlook.' },
  { id: 10, headline: 'Occidental volatile as Iran ceasefire compliance questioned', industry: 'Energy', date: '2026-04-10', impact: 'Medium', ticker: 'OXY', recommendation: 'WATCH', reason: 'Ceasefire fragility keeping energy names in flux; wait for geopolitical clarity.' },
  { id: 11, headline: 'JPMorgan Chase kicks off Q1 bank earnings season', industry: 'Finance', date: '2026-04-14', impact: 'High', ticker: 'JPM', recommendation: 'WATCH', reason: 'Bellwether for banking sector; loan loss provisions and NII guidance will set the tone.' },
  { id: 12, headline: 'Goldman Sachs Q1 earnings — trading revenue expected strong', industry: 'Finance', date: '2026-04-13', impact: 'High', ticker: 'GS', recommendation: 'HOLD', reason: 'Volatility boosting trading desks but investment banking recovery pace uncertain.' },
  { id: 13, headline: 'CPI inflation surges to 3.4% YoY — markets sell off sharply', industry: 'Finance', date: '2026-04-10', impact: 'High', ticker: 'SPY', recommendation: 'SELL', reason: 'Inflation re-acceleration from 2.4% to 3.4% threatens Fed rate cut timeline and equity valuations.' },
  { id: 14, headline: 'Bank of America Q1 earnings — consumer banking trends in focus', industry: 'Finance', date: '2026-04-15', impact: 'Medium', ticker: 'BAC', recommendation: 'HOLD', reason: 'Consumer credit quality and deposit trends will signal economic health.' },
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

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

const TODAY = '2026-04-11';

function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function ScatterChart({ events, onSelect, selectedId }) {
  const startDate = parseDate('2026-04-08');
  const endDate = parseDate('2026-04-16');
  const todayDate = parseDate(TODAY);
  const totalDays = (endDate - startDate) / 86400000;

  const pad = { top: 40, right: 30, bottom: 50, left: 60 };
  const w = 800, h = 350;
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  const dayToX = (dateStr) => {
    const diff = (parseDate(dateStr) - startDate) / 86400000;
    return pad.left + (diff / totalDays) * plotW;
  };

  const impactToY = (impact) => {
    const level = IMPACT_MAP[impact] || 2;
    return pad.top + plotH - ((level - 0.5) / 3.5) * plotH;
  };

  const todayX = dayToX(TODAY);
  const dates = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 800, display: 'block', margin: '0 auto' }}>
      {/* Past background */}
      <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={plotH} fill="rgba(239,68,68,0.06)" />
      {/* Future background */}
      <rect x={todayX} y={pad.top} width={pad.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />
      {/* Grid lines */}
      {[1, 2, 3].map(level => {
        const y = pad.top + plotH - ((level - 0.5) / 3.5) * plotH;
        return <line key={level} x1={pad.left} x2={pad.left + plotW} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />;
      })}
      {/* Y-axis labels */}
      {[{ label: 'Low', level: 1 }, { label: 'Med', level: 2 }, { label: 'High', level: 3 }].map(({ label, level }) => {
        const y = pad.top + plotH - ((level - 0.5) / 3.5) * plotH;
        return <text key={label} x={pad.left - 10} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize={12}>{label}</text>;
      })}
      {/* X-axis date labels */}
      {dates.map((d, i) => (
        <text key={i} x={pad.left + (i / totalDays) * plotW} y={h - 15} textAnchor="middle" fill="#94a3b8" fontSize={11}>
          {formatDate(d)}
        </text>
      ))}
      {/* Today line */}
      <line x1={todayX} x2={todayX} y1={pad.top - 5} y2={pad.top + plotH + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
      <text x={todayX} y={pad.top - 12} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight="bold">TODAY</text>
      {/* Axes */}
      <line x1={pad.left} x2={pad.left + plotW} y1={pad.top + plotH} y2={pad.top + plotH} stroke="#334155" strokeWidth={1} />
      <line x1={pad.left} x2={pad.left} y1={pad.top} y2={pad.top + plotH} stroke="#334155" strokeWidth={1} />
      {/* Labels */}
      <text x={pad.left + plotW / 2} y={h - 0} textAnchor="middle" fill="#64748b" fontSize={12}>Date</text>
      <text x={15} y={pad.top + plotH / 2} textAnchor="middle" fill="#64748b" fontSize={12} transform={`rotate(-90, 15, ${pad.top + plotH / 2})`}>Impact</text>
      {/* Event dots */}
      {events.map(ev => {
        const cx = dayToX(ev.date);
        const cy = impactToY(ev.impact);
        if (cx < pad.left || cx > pad.left + plotW) return null;
        const isSelected = ev.id === selectedId;
        return (
          <g key={ev.id} onClick={() => onSelect(ev.id)} style={{ cursor: 'pointer' }}>
            {isSelected && <circle cx={cx} cy={cy} r={12} fill="none" stroke={INDUSTRY_COLORS[ev.industry]} strokeWidth={2} opacity={0.5} />}
            <circle cx={cx} cy={cy} r={7} fill={INDUSTRY_COLORS[ev.industry]} opacity={0.9} />
            <title>{ev.ticker}: {ev.headline}</title>
          </g>
        );
      })}
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return <div style={{ padding: 20, color: '#64748b', textAlign: 'center' }}>Click a dot on the chart to view event details</div>;
  return (
    <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: INDUSTRY_COLORS[event.industry], fontWeight: 700, fontSize: 18 }}>{event.ticker}</span>
        <span style={{ background: '#0b0f1a', color: INDUSTRY_COLORS[event.industry], padding: '2px 10px', borderRadius: 20, fontSize: 12 }}>{event.industry}</span>
        <span style={{
          background: REC_COLORS[event.recommendation],
          color: event.recommendation === 'HOLD' ? '#000' : '#fff',
          padding: '3px 14px',
          borderRadius: 20,
          fontSize: 13,
          fontWeight: 700,
        }}>{event.recommendation}</span>
      </div>
      <div style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 8 }}>{event.headline}</div>
      <div style={{ color: '#94a3b8', fontSize: 13, marginBottom: 4 }}>Date: {event.date} &bull; Impact: {event.impact}</div>
      <div style={{ color: '#cbd5e1', fontSize: 13, marginTop: 8, lineHeight: 1.5 }}>{event.reason}</div>
    </div>
  );
}

function EventTable({ events, onSelect, selectedId }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e293b' }}>
            {['Ticker', 'Headline', 'Industry', 'Date', 'Impact', 'Rec'].map(h => (
              <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map(ev => (
            <tr
              key={ev.id}
              onClick={() => onSelect(ev.id)}
              style={{
                borderBottom: '1px solid #1e293b',
                cursor: 'pointer',
                background: ev.id === selectedId ? '#1e293b' : 'transparent',
              }}
            >
              <td style={{ padding: '8px', color: INDUSTRY_COLORS[ev.industry], fontWeight: 700 }}>{ev.ticker}</td>
              <td style={{ padding: '8px', color: '#e2e8f0', maxWidth: 350 }}>{ev.headline}</td>
              <td style={{ padding: '8px' }}>
                <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
              </td>
              <td style={{ padding: '8px', color: '#94a3b8' }}>{ev.date}</td>
              <td style={{ padding: '8px', color: ev.impact === 'High' ? '#ef4444' : ev.impact === 'Medium' ? '#eab308' : '#64748b' }}>{ev.impact}</td>
              <td style={{ padding: '8px' }}>
                <span style={{
                  background: REC_COLORS[ev.recommendation],
                  color: ev.recommendation === 'HOLD' ? '#000' : '#fff',
                  padding: '2px 10px',
                  borderRadius: 12,
                  fontSize: 11,
                  fontWeight: 700,
                }}>{ev.recommendation}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16 }}>
      {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
          <span style={{ color: '#94a3b8', fontSize: 13 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function DailyMarketAnalysis() {
  const [selectedId, setSelectedId] = useState(null);
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    if (filter === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filter);
  }, [filter]);

  const selected = EVENTS.find(e => e.id === selectedId) || null;

  const handleSelect = (id) => setSelectedId(prev => prev === id ? null : id);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: 24 }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, textAlign: 'center', marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ textAlign: 'center', color: '#64748b', marginBottom: 24, fontSize: 14 }}>April 11, 2026 &bull; 14 Events &bull; 4 Industries</p>

        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                background: filter === f ? (f === 'All' ? '#334155' : INDUSTRY_COLORS[f]) : '#151c2c',
                color: filter === f ? '#fff' : '#94a3b8',
                border: 'none',
                padding: '6px 16px',
                borderRadius: 20,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: filter === f ? 700 : 400,
              }}
            >{f}</button>
          ))}
        </div>

        <Legend />

        {/* Chart card */}
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>Event Impact Timeline</h2>
          <ScatterChart events={filtered} onSelect={handleSelect} selectedId={selectedId} />
        </div>

        {/* Detail panel */}
        <DetailPanel event={selected} />

        {/* Table card */}
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginTop: 16 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#94a3b8' }}>All Events</h2>
          <EventTable events={filtered} onSelect={handleSelect} selectedId={selectedId} />
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 24 }}>
          Data sourced from CNBC, Bloomberg, Earnings Whispers, Trading Economics. Not financial advice.
        </p>
      </div>
    </div>
  );
}
