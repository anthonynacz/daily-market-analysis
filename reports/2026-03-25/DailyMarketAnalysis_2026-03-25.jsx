import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const EVENTS = [
  { id: 1, headline: 'Iran Receives 15-Point US Ceasefire Proposal', industry: 'Energy', date: '2026-03-25', impact: 'High', ticker: 'XLE', recommendation: 'WATCH', reason: 'Diplomatic breakthrough could ease oil prices but Tehran signaling rejection.' },
  { id: 2, headline: 'Brent Oil Surges to $102/Barrel on Mideast Tensions', industry: 'Energy', date: '2026-03-24', impact: 'High', ticker: 'XOM', recommendation: 'SELL', reason: 'Geopolitical premium is unsustainable if peace talks gain traction.' },
  { id: 3, headline: 'Import Prices Spike +1.3% MoM — Biggest in 4 Years', industry: 'Finance', date: '2026-03-25', impact: 'High', ticker: 'SPY', recommendation: 'HOLD', reason: 'Pipeline inflation may delay further Fed rate cuts.' },
  { id: 4, headline: 'Fed Holds Rates Steady at 3.50-3.75%', industry: 'Finance', date: '2026-03-22', impact: 'High', ticker: 'TLT', recommendation: 'HOLD', reason: 'Middle East uncertainty keeps Fed on the sidelines.' },
  { id: 5, headline: 'Arm Holdings Upgraded — AI CPU Chip Unveiled', industry: 'Tech', date: '2026-03-25', impact: 'Medium', ticker: 'ARM', recommendation: 'BUY', reason: 'Raymond James sees 23% upside on AI data center demand.' },
  { id: 6, headline: 'Amazon AWS Price Target Raised to $285', industry: 'Tech', date: '2026-03-25', impact: 'High', ticker: 'AMZN', recommendation: 'BUY', reason: 'Citi projects AWS revenue growth of +28% YoY in Q1.' },
  { id: 7, headline: 'AWS Bahrain Region Disrupted by Drone Activity', industry: 'Tech', date: '2026-03-24', impact: 'Medium', ticker: 'AMZN', recommendation: 'HOLD', reason: 'Second disruption this month — customers urged to migrate workloads.' },
  { id: 8, headline: 'Micron Earnings Report — Strong AI Memory Demand', industry: 'Tech', date: '2026-03-26', impact: 'High', ticker: 'MU', recommendation: 'BUY', reason: 'Strong technicals and fundamentals in primary uptrend ahead of report.' },
  { id: 9, headline: 'SpaceX IPO Filing Expected — Could Raise $75B+', industry: 'Tech', date: '2026-03-28', impact: 'High', ticker: 'SPACEX', recommendation: 'WATCH', reason: 'Potentially the largest IPO in history — filing imminent.' },
  { id: 10, headline: 'FedEx Q3 Earnings — Global Trade Bellwether', industry: 'Finance', date: '2026-03-26', impact: 'Medium', ticker: 'FDX', recommendation: 'HOLD', reason: 'Key read on global shipping volumes amid geopolitical disruption.' },
  { id: 11, headline: 'Alibaba Earnings — Weak Technicals at Multi-Month Lows', industry: 'Tech', date: '2026-03-27', impact: 'Medium', ticker: 'BABA', recommendation: 'HOLD', reason: 'Revenue growth expected but price action signals caution.' },
  { id: 12, headline: 'GameStop Q4 Earnings Report', industry: 'Finance', date: '2026-03-26', impact: 'Medium', ticker: 'GME', recommendation: 'WATCH', reason: 'Retail sentiment indicator — high volatility expected around results.' },
  { id: 13, headline: 'Paysign Surges 35% on Pharma Revenue Beat', industry: 'Healthcare', date: '2026-03-24', impact: 'Medium', ticker: 'PAYS', recommendation: 'BUY', reason: 'Strong Q4 beat with bullish 2026 guidance in patient affordability programs.' },
  { id: 14, headline: 'Software Sector Selloff — IGV Down 23% YTD', industry: 'Tech', date: '2026-03-23', impact: 'High', ticker: 'IGV', recommendation: 'SELL', reason: 'AI disruption fears are crushing SaaS multiples across the board.' },
  { id: 15, headline: 'GM Upgraded to Buy — $1.7B Pickup Tailwind', industry: 'Finance', date: '2026-03-25', impact: 'Medium', ticker: 'GM', recommendation: 'BUY', reason: 'Wolfe Research sees full-size pickup launch driving earnings through 2027.' },
];

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const TODAY = '2026-03-25';

function parseDateNum(d) {
  return new Date(d + 'T00:00:00').getTime();
}

function Chart({ events, onSelect, selectedId }) {
  const width = 900;
  const height = 340;
  const pad = { top: 40, right: 30, bottom: 50, left: 60 };

  const dateRange = useMemo(() => {
    const today = parseDateNum(TODAY);
    const min = today - 3 * 86400000;
    const max = today + 5 * 86400000;
    return { min, max, today };
  }, []);

  const xScale = (val) => pad.left + ((val - dateRange.min) / (dateRange.max - dateRange.min)) * (width - pad.left - pad.right);
  const yScale = (val) => height - pad.bottom - ((val - 0.5) / 3) * (height - pad.top - pad.bottom);

  const todayX = xScale(dateRange.today);

  const dayLabels = useMemo(() => {
    const labels = [];
    for (let t = dateRange.min; t <= dateRange.max; t += 86400000) {
      const d = new Date(t);
      labels.push({ x: xScale(t), label: `${d.getMonth() + 1}/${d.getDate()}` });
    }
    return labels;
  }, [dateRange]);

  return (
    <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
      <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={height - pad.top - pad.bottom} fill="rgba(239,68,68,0.06)" />
      <rect x={todayX} y={pad.top} width={width - pad.right - todayX} height={height - pad.top - pad.bottom} fill="rgba(34,197,94,0.06)" />
      {[1, 2, 3].map((v) => (
        <g key={v}>
          <line x1={pad.left} x2={width - pad.right} y1={yScale(v)} y2={yScale(v)} stroke="#1e293b" strokeWidth={1} />
          <text x={pad.left - 10} y={yScale(v) + 4} fill="#64748b" fontSize={12} textAnchor="end">
            {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
          </text>
        </g>
      ))}
      {dayLabels.map((dl, i) => (
        <text key={i} x={dl.x} y={height - pad.bottom + 20} fill="#64748b" fontSize={11} textAnchor="middle">{dl.label}</text>
      ))}
      <line x1={todayX} x2={todayX} y1={pad.top} y2={height - pad.bottom} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
      <text x={todayX} y={pad.top - 10} fill="#ef4444" fontSize={12} textAnchor="middle" fontWeight="bold">TODAY</text>
      {events.map((ev) => {
        const cx = xScale(parseDateNum(ev.date));
        const cy = yScale(IMPACT_Y[ev.impact]);
        const isSelected = selectedId === ev.id;
        return (
          <g key={ev.id} onClick={() => onSelect(ev.id)} style={{ cursor: 'pointer' }}>
            <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
          </g>
        );
      })}
      <text x={width / 2} y={20} fill="#e2e8f0" fontSize={16} textAnchor="middle" fontWeight="bold">Market Events — Impact vs. Timeline</text>
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return <div style={{ color: '#64748b', padding: 20, textAlign: 'center' }}>Click a dot on the chart to view event details</div>;
  return (
    <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ background: INDUSTRY_COLORS[event.industry], color: '#0b0f1a', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{event.industry}</span>
        <span style={{ background: REC_COLORS[event.recommendation], color: event.recommendation === 'HOLD' ? '#0b0f1a' : '#fff', borderRadius: 20, padding: '2px 14px', fontSize: 13, fontWeight: 700 }}>{event.recommendation}</span>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{event.date}</span>
      </div>
      <h3 style={{ color: '#f1f5f9', margin: '8px 0 4px' }}>{event.headline}</h3>
      <p style={{ color: '#94a3b8', margin: 0 }}>
        <strong style={{ color: '#e2e8f0' }}>{event.ticker}</strong> &mdash; {event.reason}
      </p>
    </div>
  );
}

function EventTable({ events, onSelect, selectedId }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid #1e293b' }}>
            {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map((h) => (
              <th key={h} style={{ color: '#94a3b8', padding: '8px 12px', textAlign: 'left', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id} onClick={() => onSelect(ev.id)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selectedId === ev.id ? '#1e293b' : 'transparent' }}>
              <td style={{ color: '#cbd5e1', padding: '8px 12px', whiteSpace: 'nowrap' }}>{ev.date}</td>
              <td style={{ color: '#e2e8f0', padding: '8px 12px', fontWeight: 700 }}>{ev.ticker}</td>
              <td style={{ color: '#cbd5e1', padding: '8px 12px' }}>{ev.headline}</td>
              <td style={{ padding: '8px 12px' }}><span style={{ color: INDUSTRY_COLORS[ev.industry], fontWeight: 600 }}>{ev.industry}</span></td>
              <td style={{ color: '#cbd5e1', padding: '8px 12px' }}>{ev.impact}</td>
              <td style={{ padding: '8px 12px' }}><span style={{ background: REC_COLORS[ev.recommendation], color: ev.recommendation === 'HOLD' ? '#0b0f1a' : '#fff', borderRadius: 20, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{ev.recommendation}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '16px 0' }}>
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

  const sortedEvents = useMemo(() => [...EVENTS].sort((a, b) => a.date.localeCompare(b.date)), []);
  const selectedEvent = useMemo(() => EVENTS.find((e) => e.id === selectedId) || null, [selectedId]);

  const handleSelect = (id) => setSelectedId(id === selectedId ? null : id);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', padding: '32px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ color: '#f1f5f9', textAlign: 'center', fontSize: 28, marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: '#64748b', textAlign: 'center', marginBottom: 24 }}>March 25, 2026 &bull; 15 Events &bull; 4 Industries</p>

        <div style={{ background: '#151c2c', borderRadius: 16, padding: 24, marginBottom: 16 }}>
          <Chart events={sortedEvents} onSelect={handleSelect} selectedId={selectedId} />
          <Legend />
        </div>

        <DetailPanel event={selectedEvent} />

        <div style={{ background: '#151c2c', borderRadius: 16, padding: 24, marginTop: 24 }}>
          <h2 style={{ color: '#e2e8f0', fontSize: 18, marginTop: 0 }}>All Events</h2>
          <EventTable events={sortedEvents} onSelect={handleSelect} selectedId={selectedId} />
        </div>
      </div>
    </div>
  );
}
