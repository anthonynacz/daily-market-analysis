import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const EVENTS = [
  { id: 1, headline: "Nasdaq Posts 12th Consecutive Gain — Longest Streak Since 2009", industry: "Tech", date: "2026-04-16", impact: "High", ticker: "QQQ", recommendation: "WATCH", reason: "Historic winning streak may signal overextension; watch for pullback" },
  { id: 2, headline: "Tesla Q1 Earnings — Deliveries Miss Wall Street Estimates", industry: "Tech", date: "2026-04-22", impact: "High", ticker: "TSLA", recommendation: "SELL", reason: "Delivered 358K vehicles vs 369K expected; margin pressure ahead" },
  { id: 3, headline: "ServiceNow Q1 Earnings — Enterprise AI Demand Surging", industry: "Tech", date: "2026-04-22", impact: "Medium", ticker: "NOW", recommendation: "BUY", reason: "Strong enterprise AI adoption driving accelerating subscription growth" },
  { id: 4, headline: "Texas Instruments Q1 Earnings — Chip Sector Bellwether", industry: "Tech", date: "2026-04-22", impact: "Medium", ticker: "TXN", recommendation: "HOLD", reason: "Semiconductor recovery signals remain mixed across end markets" },
  { id: 5, headline: "UnitedHealth Group Q1 Earnings Report", industry: "Healthcare", date: "2026-04-21", impact: "High", ticker: "UNH", recommendation: "HOLD", reason: "Largest health insurer faces regulatory headwinds but steady fundamentals" },
  { id: 6, headline: "Intuitive Surgical Q1 Earnings — Robotic Procedures Accelerate", industry: "Healthcare", date: "2026-04-21", impact: "High", ticker: "ISRG", recommendation: "BUY", reason: "Da Vinci procedure volumes continue to accelerate globally" },
  { id: 7, headline: "Boston Scientific Q1 Earnings — Device Demand Strong", industry: "Healthcare", date: "2026-04-22", impact: "Medium", ticker: "BSX", recommendation: "BUY", reason: "Medical device demand boosted by elective procedure recovery" },
  { id: 8, headline: "Oil Prices Crash 12% as Iran Opens Strait of Hormuz", industry: "Energy", date: "2026-04-17", impact: "High", ticker: "XOM", recommendation: "SELL", reason: "Supply relief from Hormuz opening creates near-term crude price pressure" },
  { id: 9, headline: "APA Corporation Drops 9% in Energy Selloff", industry: "Energy", date: "2026-04-17", impact: "High", ticker: "APA", recommendation: "SELL", reason: "Pure-play oil exposure makes APA vulnerable to further crude declines" },
  { id: 10, headline: "Occidental Petroleum Falls 7% on Oil Plunge", industry: "Energy", date: "2026-04-17", impact: "High", ticker: "OXY", recommendation: "SELL", reason: "Geopolitical supply shift undermines near-term pricing outlook" },
  { id: 11, headline: "GE Vernova Q1 Earnings — Energy Transition Leader", industry: "Energy", date: "2026-04-22", impact: "Medium", ticker: "GEV", recommendation: "BUY", reason: "Renewable energy and grid modernization demand remains robust" },
  { id: 12, headline: "S&P 500 Hits All-Time Record 7,126 on Peace Rally", industry: "Finance", date: "2026-04-17", impact: "High", ticker: "SPY", recommendation: "HOLD", reason: "Record high driven by peace optimism may already be priced in" },
  { id: 13, headline: "Capital One Q1 Earnings — Consumer Credit Watch", industry: "Finance", date: "2026-04-21", impact: "Medium", ticker: "COF", recommendation: "WATCH", reason: "Consumer credit quality trends are a key indicator for the broader economy" },
  { id: 14, headline: "CME Group Q1 Earnings — Trading Volumes Elevated", industry: "Finance", date: "2026-04-22", impact: "Medium", ticker: "CME", recommendation: "BUY", reason: "Elevated market volatility driving record derivatives trading volumes" },
];

const TODAY = '2026-04-19';
const DATES = ['2026-04-16','2026-04-17','2026-04-18','2026-04-19','2026-04-20','2026-04-21','2026-04-22','2026-04-23','2026-04-24'];
const DATE_LABELS = ['Apr 16','Apr 17','Apr 18','Apr 19','Apr 20','Apr 21','Apr 22','Apr 23','Apr 24'];
const IMPACT_LEVELS = { Low: 1, Medium: 2, High: 3 };

const CHART = { left: 70, right: 40, top: 30, bottom: 50, width: 780, height: 320 };
const plotW = CHART.width - CHART.left - CHART.right;
const plotH = CHART.height - CHART.top - CHART.bottom;

function getX(dateStr) {
  const idx = DATES.indexOf(dateStr);
  return CHART.left + (idx / (DATES.length - 1)) * plotW;
}

function getY(impact) {
  const level = IMPACT_LEVELS[impact];
  return CHART.top + plotH - ((level - 0.5) / 3) * plotH;
}

function ScatterChart({ selected, onSelect }) {
  const todayX = getX(TODAY);

  const positioned = useMemo(() => {
    const groups = {};
    EVENTS.forEach(e => {
      const key = `${e.date}_${e.impact}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    const result = [];
    Object.values(groups).forEach(group => {
      const cx = getX(group[0].date);
      const cy = getY(group[0].impact);
      const total = group.length;
      group.forEach((e, i) => {
        const offset = (i - (total - 1) / 2) * 18;
        result.push({ ...e, cx: cx + offset, cy });
      });
    });
    return result;
  }, []);

  return (
    <svg viewBox={`0 0 ${CHART.width} ${CHART.height}`} style={{ width: '100%', maxWidth: 780, display: 'block', margin: '0 auto' }}>
      <rect x={CHART.left} y={CHART.top} width={todayX - CHART.left} height={plotH} fill="rgba(239,68,68,0.06)" />
      <rect x={todayX} y={CHART.top} width={CHART.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />
      <line x1={todayX} y1={CHART.top} x2={todayX} y2={CHART.top + plotH} stroke="#ef4444" strokeWidth="2" strokeDasharray="6,4" />
      <text x={todayX} y={CHART.top - 8} fill="#ef4444" textAnchor="middle" fontSize="11" fontWeight="bold">TODAY</text>

      {[1, 2, 3].map(level => {
        const y = CHART.top + plotH - ((level - 0.5) / 3) * plotH;
        return (
          <g key={level}>
            <line x1={CHART.left} y1={y} x2={CHART.left + plotW} y2={y} stroke="#1e293b" strokeWidth="1" />
            <text x={CHART.left - 10} y={y + 4} fill="#94a3b8" textAnchor="end" fontSize="11">
              {level === 3 ? 'High' : level === 2 ? 'Medium' : 'Low'}
            </text>
          </g>
        );
      })}

      {DATES.map((d, i) => (
        <text key={d} x={CHART.left + (i / (DATES.length - 1)) * plotW} y={CHART.top + plotH + 20} fill="#94a3b8" textAnchor="middle" fontSize="10">
          {DATE_LABELS[i]}
        </text>
      ))}

      {positioned.map(e => (
        <g key={e.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(e.id === selected ? null : e.id)}>
          <circle cx={e.cx} cy={e.cy} r={selected === e.id ? 10 : 7} fill={INDUSTRY_COLORS[e.industry]} opacity={selected === e.id ? 1 : 0.85} stroke={selected === e.id ? '#fff' : 'none'} strokeWidth="2" />
          <text x={e.cx} y={e.cy - 12} fill="#e2e8f0" textAnchor="middle" fontSize="9" fontWeight="600">{e.ticker}</text>
        </g>
      ))}

      <rect x={CHART.left} y={CHART.top} width={plotW} height={plotH} fill="none" stroke="#1e293b" />
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return <div style={{ padding: 20, color: '#64748b', textAlign: 'center' }}>Click a dot on the chart to view event details</div>;
  return (
    <div style={{ background: '#151c2c', borderRadius: 10, padding: 20, margin: '16px auto', maxWidth: 600, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ background: INDUSTRY_COLORS[event.industry], color: '#0b0f1a', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{event.industry}</span>
        <span style={{ background: REC_COLORS[event.recommendation], color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 700 }}>{event.recommendation}</span>
        <span style={{ color: '#94a3b8', fontSize: 12, marginLeft: 'auto' }}>{event.date}</span>
      </div>
      <h3 style={{ color: '#f1f5f9', margin: '8px 0 4px', fontSize: 16 }}>{event.ticker} — {event.headline}</h3>
      <p style={{ color: '#94a3b8', margin: 0, fontSize: 14 }}>{event.reason}</p>
      <div style={{ marginTop: 8, color: '#64748b', fontSize: 12 }}>Impact: {event.impact}</div>
    </div>
  );
}

function EventTable() {
  return (
    <div style={{ overflowX: 'auto', margin: '16px auto', maxWidth: 780 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e293b' }}>
            {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
              <th key={h} style={{ padding: '8px 6px', color: '#94a3b8', textAlign: 'left', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVENTS.map(e => (
            <tr key={e.id} style={{ borderBottom: '1px solid #111827' }}>
              <td style={{ padding: '6px', color: '#cbd5e1', whiteSpace: 'nowrap' }}>{e.date}</td>
              <td style={{ padding: '6px', color: INDUSTRY_COLORS[e.industry], fontWeight: 700 }}>{e.ticker}</td>
              <td style={{ padding: '6px', color: '#e2e8f0' }}>{e.headline}</td>
              <td style={{ padding: '6px', color: INDUSTRY_COLORS[e.industry] }}>{e.industry}</td>
              <td style={{ padding: '6px', color: '#cbd5e1' }}>{e.impact}</td>
              <td style={{ padding: '6px' }}>
                <span style={{ background: REC_COLORS[e.recommendation], color: '#fff', padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{e.recommendation}</span>
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
    <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
      {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
        <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{name}</span>
        </div>
      ))}
    </div>
  );
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const selectedEvent = useMemo(() => EVENTS.find(e => e.id === selected) || null, [selected]);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', padding: '24px 16px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
      <div style={{ maxWidth: 820, margin: '0 auto' }}>
        <h1 style={{ color: '#f1f5f9', fontSize: 22, textAlign: 'center', margin: '0 0 4px' }}>Daily Market Analysis</h1>
        <p style={{ color: '#64748b', textAlign: 'center', margin: '0 0 20px', fontSize: 13 }}>April 19, 2026 — 14 Events across Tech, Healthcare, Energy, Finance</p>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, border: '1px solid #1e293b' }}>
          <h2 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 6px' }}>Event Timeline</h2>
          <Legend />
          <ScatterChart selected={selected} onSelect={setSelected} />
        </div>

        <DetailPanel event={selectedEvent} />

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, border: '1px solid #1e293b', marginTop: 16 }}>
          <h2 style={{ color: '#e2e8f0', fontSize: 14, margin: '0 0 8px' }}>All Events</h2>
          <EventTable />
        </div>
      </div>
    </div>
  );
}
