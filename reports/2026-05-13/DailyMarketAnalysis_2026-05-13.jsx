import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "US CPI Inflation Hits 3.8%, Exceeds Forecasts", industry: "Finance", date: "2026-05-12", impact: "High", ticker: "SPY", recommendation: "HOLD", reason: "Rate cut expectations pushed back; stay defensive until clarity" },
  { id: 2, headline: "Crude Oil Surges Past $103 on Strait of Hormuz Tensions", industry: "Energy", date: "2026-05-12", impact: "High", ticker: "XOM", recommendation: "BUY", reason: "Geopolitical premium and supply constraints favor energy majors" },
  { id: 3, headline: "Qualcomm Drops ~10% in Semiconductor Selloff", industry: "Tech", date: "2026-05-12", impact: "High", ticker: "QCOM", recommendation: "WATCH", reason: "Wait for stabilization; macro headwinds still pressuring chips" },
  { id: 4, headline: "Micron Technology Plunges 5%+ on Tech Weakness", industry: "Tech", date: "2026-05-12", impact: "High", ticker: "MU", recommendation: "WATCH", reason: "Memory demand outlook uncertain amid inflation fears" },
  { id: 5, headline: "Cisco Systems Q3 FY2026 Earnings Report", industry: "Tech", date: "2026-05-13", impact: "High", ticker: "CSCO", recommendation: "HOLD", reason: "Enterprise networking stable but agentic AI pivot still early" },
  { id: 6, headline: "Alibaba Group Quarterly Earnings Release", industry: "Tech", date: "2026-05-13", impact: "Medium", ticker: "BABA", recommendation: "WATCH", reason: "China recovery trajectory remains the key variable" },
  { id: 7, headline: "Applied Materials Earnings & Chip Capex Outlook", industry: "Tech", date: "2026-05-14", impact: "High", ticker: "AMAT", recommendation: "WATCH", reason: "Semiconductor capex guidance will set sector tone" },
  { id: 8, headline: "GitLab Announces Agentic AI Restructuring", industry: "Tech", date: "2026-05-12", impact: "Medium", ticker: "GTLB", recommendation: "SELL", reason: "Broad restructuring signals near-term margin pressure" },
  { id: 9, headline: "Constellation Energy Beats on Nuclear Demand", industry: "Energy", date: "2026-05-11", impact: "Medium", ticker: "CEG", recommendation: "BUY", reason: "AI datacenter power demand drives nuclear renaissance" },
  { id: 10, headline: "National Grid Earnings Amid Energy Transition", industry: "Energy", date: "2026-05-14", impact: "Medium", ticker: "NGG", recommendation: "HOLD", reason: "Stable utility with predictable cash flows in volatile market" },
  { id: 11, headline: "Vestis Corp Surges 30% on Strong Q2 Beat", industry: "Finance", date: "2026-05-12", impact: "Medium", ticker: "VSTS", recommendation: "HOLD", reason: "Impressive beat but rally may already price in upside" },
  { id: 12, headline: "CleanSpark Falls 10% on Wider Q2 Losses", industry: "Finance", date: "2026-05-12", impact: "Medium", ticker: "CLSK", recommendation: "SELL", reason: "Crypto mining margins squeezed; losses widening to $1.52/share" },
  { id: 13, headline: "UnitedHealth Pressured by Rising Healthcare Costs", industry: "Healthcare", date: "2026-05-13", impact: "High", ticker: "UNH", recommendation: "HOLD", reason: "Inflation-driven cost pressure offsets membership growth" },
  { id: 14, headline: "Moderna Advances Next-Gen mRNA Pipeline Update", industry: "Healthcare", date: "2026-05-15", impact: "Medium", ticker: "MRNA", recommendation: "WATCH", reason: "Pipeline diversification promising but revenue transition uncertain" },
  { id: 15, headline: "Industrial Production & Capacity Utilization Data", industry: "Finance", date: "2026-05-16", impact: "Medium", ticker: "DIA", recommendation: "WATCH", reason: "Manufacturing health indicator amid inflation concerns" },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const TODAY = '2026-05-13';
const START_DATE = '2026-05-10';
const END_DATE = '2026-05-18';

function dayIndex(dateStr) {
  const start = new Date(START_DATE);
  const d = new Date(dateStr);
  return (d - start) / (1000 * 60 * 60 * 24);
}

const TOTAL_DAYS = dayIndex(END_DATE);
const IMPACT_Y = { High: 0.15, Medium: 0.5, Low: 0.85 };

function ScatterChart({ events, onSelect, selected }) {
  const pad = { top: 40, right: 30, bottom: 50, left: 60 };
  const w = 800, h = 340;
  const iw = w - pad.left - pad.right;
  const ih = h - pad.top - pad.bottom;
  const todayX = pad.left + (dayIndex(TODAY) / TOTAL_DAYS) * iw;

  const dates = [];
  for (let i = 0; i <= TOTAL_DAYS; i++) {
    const d = new Date(START_DATE);
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }

  const jitter = {};
  const getPos = (ev) => {
    const key = ev.date + ev.impact;
    jitter[key] = (jitter[key] || 0) + 1;
    const xOff = (jitter[key] - 1) * 18 - ((events.filter(e => e.date === ev.date && e.impact === ev.impact).length - 1) * 9);
    const x = pad.left + (dayIndex(ev.date) / TOTAL_DAYS) * iw + xOff;
    const y = pad.top + IMPACT_Y[ev.impact] * ih;
    return { x, y };
  };

  const positions = useMemo(() => {
    const j = {};
    return events.map(ev => {
      const key = ev.date + ev.impact;
      const sameGroup = events.filter(e => e.date === ev.date && e.impact === ev.impact);
      j[key] = (j[key] || 0) + 1;
      const idx = j[key] - 1;
      const xOff = (idx - (sameGroup.length - 1) / 2) * 20;
      const x = pad.left + (dayIndex(ev.date) / TOTAL_DAYS) * iw + xOff;
      const y = pad.top + IMPACT_Y[ev.impact] * ih;
      return { ...ev, cx: x, cy: y };
    });
  }, [events]);

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', maxWidth: 800, display: 'block', margin: '0 auto' }}>
      <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={ih} fill="rgba(239,68,68,0.06)" />
      <rect x={todayX} y={pad.top} width={pad.left + iw - todayX} height={ih} fill="rgba(34,197,94,0.06)" />
      <line x1={todayX} y1={pad.top - 5} x2={todayX} y2={pad.top + ih + 5} stroke="#ef4444" strokeWidth="2" strokeDasharray="6,4" />
      <text x={todayX} y={pad.top - 10} fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold">TODAY</text>

      {dates.map((d, i) => {
        const x = pad.left + (i / TOTAL_DAYS) * iw;
        return (
          <g key={d}>
            <line x1={x} y1={pad.top} x2={x} y2={pad.top + ih} stroke="#1e293b" strokeWidth="1" />
            <text x={x} y={h - 10} fill="#64748b" fontSize="10" textAnchor="middle">{d.slice(5)}</text>
          </g>
        );
      })}

      {['High', 'Medium'].map(level => {
        const y = pad.top + IMPACT_Y[level] * ih;
        return (
          <g key={level}>
            <line x1={pad.left} y1={y} x2={pad.left + iw} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3,3" />
            <text x={pad.left - 8} y={y + 4} fill="#94a3b8" fontSize="11" textAnchor="end">{level}</text>
          </g>
        );
      })}

      {positions.map(ev => (
        <g key={ev.id} style={{ cursor: 'pointer' }} onClick={() => onSelect(ev.id)}>
          <circle cx={ev.cx} cy={ev.cy} r={selected === ev.id ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={selected === ev.id ? 1 : 0.85} stroke={selected === ev.id ? '#fff' : 'none'} strokeWidth="2" />
          <text x={ev.cx} y={ev.cy - 12} fill="#cbd5e1" fontSize="9" textAnchor="middle" fontWeight="600">{ev.ticker}</text>
        </g>
      ))}
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return <div style={{ color: '#64748b', textAlign: 'center', padding: 24 }}>Click a dot on the chart to view event details</div>;
  return (
    <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, margin: '16px auto', maxWidth: 600 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ background: INDUSTRY_COLORS[event.industry], color: '#0b0f1a', borderRadius: 6, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>{event.industry}</span>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{event.date}</span>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>•</span>
        <span style={{ color: '#94a3b8', fontSize: 13 }}>{event.impact} Impact</span>
      </div>
      <h3 style={{ color: '#f1f5f9', margin: '8px 0 4px', fontSize: 17 }}>{event.headline}</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
        <span style={{ color: '#e2e8f0', fontWeight: 700, fontSize: 20 }}>{event.ticker}</span>
        <span style={{ background: REC_COLORS[event.recommendation], color: '#fff', borderRadius: 20, padding: '3px 14px', fontSize: 13, fontWeight: 700 }}>{event.recommendation}</span>
      </div>
      <p style={{ color: '#94a3b8', marginTop: 10, fontSize: 14, lineHeight: 1.5 }}>{event.reason}</p>
    </div>
  );
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const selectedEvent = EVENTS.find(e => e.id === selected) || null;

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '24px 16px' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>
        <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4, color: '#f1f5f9' }}>Daily Market Analysis</h1>
        <p style={{ color: '#64748b', marginBottom: 24, fontSize: 14 }}>{TODAY} — 15 events across Tech, Healthcare, Energy & Finance</p>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {name}
            </span>
          ))}
        </div>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, marginBottom: 8 }}>
          <ScatterChart events={EVENTS} onSelect={id => setSelected(id === selected ? null : id)} selected={selected} />
        </div>

        <DetailPanel event={selectedEvent} />

        <h2 style={{ fontSize: 18, fontWeight: 700, marginTop: 32, marginBottom: 12, color: '#f1f5f9' }}>All Events</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec.'].map(h => (
                  <th key={h} style={{ padding: '10px 8px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.map(ev => (
                <tr key={ev.id} onClick={() => setSelected(ev.id === selected ? null : ev.id)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected === ev.id ? '#1e293b' : 'transparent' }}>
                  <td style={{ padding: '10px 8px', color: '#94a3b8' }}>{ev.date.slice(5)}</td>
                  <td style={{ padding: '10px 8px', fontWeight: 700, color: '#e2e8f0' }}>{ev.ticker}</td>
                  <td style={{ padding: '10px 8px', color: '#cbd5e1', maxWidth: 300 }}>{ev.headline}</td>
                  <td style={{ padding: '10px 8px' }}><span style={{ color: INDUSTRY_COLORS[ev.industry], fontWeight: 600 }}>{ev.industry}</span></td>
                  <td style={{ padding: '10px 8px', color: ev.impact === 'High' ? '#f87171' : '#fbbf24' }}>{ev.impact}</td>
                  <td style={{ padding: '10px 8px' }}><span style={{ background: REC_COLORS[ev.recommendation], color: '#fff', borderRadius: 12, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{ev.recommendation}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}