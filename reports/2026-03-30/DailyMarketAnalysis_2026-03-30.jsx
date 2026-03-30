import { useState, useMemo } from 'react';

const COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const EVENTS = [
  { id: 1, headline: 'Iran Conflict Drives Brent Crude Above $113/Barrel', industry: 'Energy', date: '2026-03-27', impact: 'High', ticker: 'XOM', recommendation: 'BUY', reason: 'Oil producers benefit directly from sustained high crude prices driven by Middle East tensions.' },
  { id: 2, headline: 'Chevron Gains on Middle East Supply Fears', industry: 'Energy', date: '2026-03-27', impact: 'Medium', ticker: 'CVX', recommendation: 'HOLD', reason: 'Gains largely priced in; monitor Iran ceasefire negotiations before adding positions.' },
  { id: 3, headline: 'Fed Chair Powell Speech at Harvard University', industry: 'Finance', date: '2026-03-30', impact: 'High', ticker: 'SPY', recommendation: 'WATCH', reason: 'Powell may signal rate-hike timeline amid OECD inflation forecast of 4.2%.' },
  { id: 4, headline: 'Nvidia Pressured by AI Spending Doubts & Lawsuits', industry: 'Tech', date: '2026-03-28', impact: 'High', ticker: 'NVDA', recommendation: 'HOLD', reason: 'Long-term AI thesis intact but near-term headwinds from risk-off sentiment and cost scrutiny.' },
  { id: 5, headline: 'Meta Drops on Social Media Addiction Court Ruling', industry: 'Tech', date: '2026-03-27', impact: 'High', ticker: 'META', recommendation: 'SELL', reason: 'Mounting regulatory risk and litigation costs create significant overhang.' },
  { id: 6, headline: 'Alphabet Falls Alongside Meta on Ruling Spillover', industry: 'Tech', date: '2026-03-27', impact: 'Medium', ticker: 'GOOGL', recommendation: 'HOLD', reason: 'Less directly exposed than Meta but negative sentiment drag on big tech.' },
  { id: 7, headline: 'Nike Q3 Earnings Report Due', industry: 'Finance', date: '2026-03-31', impact: 'Medium', ticker: 'NKE', recommendation: 'WATCH', reason: 'Consumer spending bellwether; results will gauge discretionary demand strength.' },
  { id: 8, headline: 'OECD Raises US Inflation Forecast to 4.2%', industry: 'Finance', date: '2026-03-26', impact: 'High', ticker: 'TLT', recommendation: 'SELL', reason: 'Bond yields likely to rise further as stagflation fears grow; reduce duration.' },
  { id: 9, headline: 'March Jobs Report Release (Good Friday)', industry: 'Finance', date: '2026-04-03', impact: 'High', ticker: 'SPY', recommendation: 'WATCH', reason: 'Released when markets are closed; expect volatility on Monday open.' },
  { id: 10, headline: 'ISM Manufacturing Index Release', industry: 'Finance', date: '2026-04-01', impact: 'Medium', ticker: 'XLI', recommendation: 'WATCH', reason: 'Key gauge to distinguish between slowdown and stagflation scenarios.' },
  { id: 11, headline: 'VIX Surges to 31.05 — Highest Since April 2025', industry: 'Finance', date: '2026-03-27', impact: 'High', ticker: 'VIX', recommendation: 'WATCH', reason: 'Elevated fear gauge signals sustained volatility ahead; hedge portfolios.' },
  { id: 12, headline: 'Lucid Diagnostics Q4 Earnings Report', industry: 'Healthcare', date: '2026-03-30', impact: 'Low', ticker: 'LUCD', recommendation: 'WATCH', reason: 'Small-cap diagnostics play; watch for revenue growth signals in GI screening.' },
  { id: 13, headline: 'Healthcare Sector Squeezed by Stagflation Pressure', industry: 'Healthcare', date: '2026-03-28', impact: 'Medium', ticker: 'UNH', recommendation: 'HOLD', reason: 'Rising costs and inflation weigh on managed care margins despite defensive positioning.' },
  { id: 14, headline: 'Pharma Seen as Safe Haven Amid Market Selloff', industry: 'Healthcare', date: '2026-03-28', impact: 'Medium', ticker: 'JNJ', recommendation: 'BUY', reason: 'Dividend aristocrat with stable cash flows benefits from risk-off rotation.' },
];

const TODAY = '2026-03-30';

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };

const RECOMMENDATION_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / 86400000);
}

function formatDate(d) {
  const dt = parseDate(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const START_DATE = '2026-03-27';
const END_DATE = '2026-04-04';
const TOTAL_DAYS = daysBetween(START_DATE, END_DATE);

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800;
  const chartH = 300;
  const pad = { top: 40, right: 30, bottom: 50, left: 60 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  const xScale = (date) => pad.left + (daysBetween(START_DATE, date) / TOTAL_DAYS) * innerW;
  const yScale = (impact) => pad.top + innerH - ((IMPACT_Y[impact] - 0.5) / 3) * innerH;

  const todayX = xScale(TODAY);
  const dates = [];
  for (let i = 0; i <= TOTAL_DAYS; i++) {
    const d = new Date(parseDate(START_DATE).getTime() + i * 86400000);
    const ds = d.toISOString().slice(0, 10);
    dates.push(ds);
  }

  return (
    <div style={{ background: '#0b0f1a', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 20 }}>March 30, 2026 — 14 events across 4 industries</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['All', ...Object.keys(COLORS)].map(ind => (
          <button
            key={ind}
            onClick={() => { setFilterIndustry(ind); setSelected(null); }}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              background: filterIndustry === ind ? (ind === 'All' ? '#6366f1' : COLORS[ind]) : '#1e293b',
              color: filterIndustry === ind ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: 13,
            }}
          >
            {ind}
          </button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', maxWidth: chartW }}>
          {/* Past background */}
          <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={innerH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={todayX} y={pad.top} width={pad.left + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {[1, 2, 3].map(v => (
            <g key={v}>
              <line x1={pad.left} y1={pad.top + innerH - ((v - 0.5) / 3) * innerH} x2={pad.left + innerW} y2={pad.top + innerH - ((v - 0.5) / 3) * innerH} stroke="#1e293b" strokeDasharray="4" />
              <text x={pad.left - 10} y={pad.top + innerH - ((v - 0.5) / 3) * innerH + 4} textAnchor="end" fill="#64748b" fontSize={11}>
                {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
              </text>
            </g>
          ))}

          {/* Date labels */}
          {dates.map(d => (
            <text key={d} x={xScale(d)} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={10}>
              {formatDate(d)}
            </text>
          ))}

          {/* TODAY line */}
          <line x1={todayX} y1={pad.top - 10} x2={todayX} y2={pad.top + innerH + 10} stroke="#ef4444" strokeDasharray="6 3" strokeWidth={2} />
          <text x={todayX} y={pad.top - 16} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={700}>TODAY</text>

          {/* Event dots */}
          {filtered.map(ev => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact);
            const isSelected = selected && selected.id === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                {isSelected && <text x={cx} y={cy - 14} textAnchor="middle" fill="#fff" fontSize={10} fontWeight={600}>{ev.ticker}</text>}
              </g>
            );
          })}

          {/* Legend */}
          {Object.entries(COLORS).map(([name, color], i) => (
            <g key={name} transform={`translate(${pad.left + i * 120}, ${pad.top - 28})`}>
              <circle cx={0} cy={0} r={5} fill={color} />
              <text x={10} y={4} fill="#94a3b8" fontSize={11}>{name}</text>
            </g>
          ))}
        </svg>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{selected.headline}</h3>
            <span style={{
              padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700,
              background: RECOMMENDATION_COLORS[selected.recommendation], color: '#fff',
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: '4px 0' }}>
            <strong>Ticker:</strong> {selected.ticker} &nbsp;|&nbsp; <strong>Industry:</strong> {selected.industry} &nbsp;|&nbsp; <strong>Date:</strong> {formatDate(selected.date)} &nbsp;|&nbsp; <strong>Impact:</strong> {selected.impact}
          </p>
          <p style={{ color: '#cbd5e1', marginTop: 8 }}>{selected.reason}</p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Headline', 'Industry', 'Ticker', 'Impact', 'Rec.'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: '1px solid #1e293b22', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e293b'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                <td style={{ padding: '8px 10px' }}>{formatDate(ev.date)}</td>
                <td style={{ padding: '8px 10px' }}>{ev.headline}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: COLORS[ev.industry], fontWeight: 600 }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '8px 10px', fontWeight: 700 }}>{ev.ticker}</td>
                <td style={{ padding: '8px 10px' }}>{ev.impact}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700,
                    background: RECOMMENDATION_COLORS[ev.recommendation], color: '#fff',
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        Generated 2026-03-30 | Data sourced from CNBC, Bloomberg, TheStreet, FactSet, Yahoo Finance
      </p>
    </div>
  );
}
