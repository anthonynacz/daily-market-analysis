import { useState, useMemo } from 'react';

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

const EVENTS = [
  { id: 1, date: '2026-05-15', headline: 'Cerebras IPO Surges 68% on First Day of Trading', industry: 'Tech', impact: 'High', ticker: 'CBRS', rec: 'WATCH', reason: 'Massive first-day gain signals AI demand but $100B valuation is stretched' },
  { id: 2, date: '2026-05-15', headline: 'Cisco Earnings Beat — Stock Jumps 13.4%', industry: 'Tech', impact: 'High', ticker: 'CSCO', rec: 'BUY', reason: 'Strong Q3 with $15.8B revenue shows enterprise spending is resilient' },
  { id: 3, date: '2026-05-15', headline: 'Intel Retreats 6% on Rising Treasury Yields', industry: 'Tech', impact: 'Medium', ticker: 'INTC', rec: 'HOLD', reason: 'Macro-driven sell-off; fundamentals unchanged but sector rotation risk persists' },
  { id: 4, date: '2026-05-15', headline: 'Oil Surges to $109 on US-Iran Deal Dynamics', industry: 'Energy', impact: 'High', ticker: 'XOM', rec: 'BUY', reason: 'Elevated crude prices directly boost major oil company margins' },
  { id: 5, date: '2026-05-15', headline: '10-Year Treasury Yield Spikes to 4.55% — Highest in a Year', industry: 'Finance', impact: 'High', ticker: 'TLT', rec: 'SELL', reason: 'Rising yields pressure equity valuations and signal tighter financial conditions' },
  { id: 6, date: '2026-05-15', headline: 'S&P 500 Drops 1.24% After Trump-Xi Summit Disappoints', industry: 'Finance', impact: 'High', ticker: 'SPY', rec: 'HOLD', reason: 'Summit ended without breakthroughs; trade uncertainty weighs on sentiment' },
  { id: 7, date: '2026-05-16', headline: 'Oil Price Spike Raises Recession Warning Flags', industry: 'Energy', impact: 'Medium', ticker: 'USO', rec: 'SELL', reason: '50% oil surge historically precedes recessions — monitor duration closely' },
  { id: 8, date: '2026-05-16', headline: 'Healthcare Sector Under Pressure from Rising Rates', industry: 'Healthcare', impact: 'Medium', ticker: 'UNH', rec: 'HOLD', reason: 'Rate-sensitive healthcare names face headwinds; wait for stability' },
  { id: 9, date: '2026-05-18', headline: 'Alibaba Fiscal Q4 Earnings Report', industry: 'Tech', impact: 'Medium', ticker: 'BABA', rec: 'WATCH', reason: 'Results arrive amid US-China tension from summit; guidance key for outlook' },
  { id: 10, date: '2026-05-19', headline: 'Home Depot Q1 Earnings — Housing Market Bellwether', industry: 'Finance', impact: 'Medium', ticker: 'HD', rec: 'WATCH', reason: 'Rate sensitivity could weigh on results; consumer spending indicator' },
  { id: 11, date: '2026-05-20', headline: 'NVIDIA Fiscal Q1 Earnings — AI Spending Litmus Test', industry: 'Tech', impact: 'High', ticker: 'NVDA', rec: 'WATCH', reason: 'Historically beats EPS 86% of the time; sets tone for entire AI sector' },
  { id: 12, date: '2026-05-20', headline: 'FOMC April Meeting Minutes Release', industry: 'Finance', impact: 'High', ticker: 'SPY', rec: 'WATCH', reason: 'Will reveal Fed stance on inflation amid oil surge; rate held at 3.50-3.75%' },
  { id: 13, date: '2026-05-21', headline: 'Walmart Q1 Earnings — Consumer Spending Health Check', industry: 'Finance', impact: 'Medium', ticker: 'WMT', rec: 'WATCH', reason: 'Key indicator of whether inflation is affecting consumer purchasing power' },
  { id: 14, date: '2026-05-21', headline: 'Marvell Technology Earnings — Data Center Demand Signal', industry: 'Tech', impact: 'Medium', ticker: 'MRVL', rec: 'WATCH', reason: 'AI infrastructure play; results confirm data center spending trends' },
  { id: 15, date: '2026-05-21', headline: 'Biotech Sector Rebound Potential on Oversold Conditions', industry: 'Healthcare', impact: 'Medium', ticker: 'XBI', rec: 'BUY', reason: 'Yield-driven sell-off has created attractive entry points in quality biotech names' },
];

const TODAY = '2026-05-17';
const DATE_RANGE = ['2026-05-14', '2026-05-15', '2026-05-16', '2026-05-17', '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22'];
const DATE_LABELS = ['May 14', 'May 15', 'May 16', 'May 17', 'May 18', 'May 19', 'May 20', 'May 21', 'May 22'];
const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartW = 800;
  const chartH = 300;
  const pad = { top: 30, right: 30, bottom: 50, left: 60 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  const dots = useMemo(() => {
    const counts = {};
    return EVENTS.map((e) => {
      const key = `${e.date}-${e.impact}`;
      counts[key] = (counts[key] || 0);
      const offset = counts[key] * 18 - ((EVENTS.filter(ev => ev.date === e.date && ev.impact === e.impact).length - 1) * 9);
      counts[key]++;
      const xi = DATE_RANGE.indexOf(e.date);
      const x = pad.left + (xi / (DATE_RANGE.length - 1)) * innerW + offset;
      const y = pad.top + innerH - ((IMPACT_MAP[e.impact] - 0.5) / 3) * innerH;
      return { ...e, x, y };
    });
  }, []);

  const todayIdx = DATE_RANGE.indexOf(TODAY);
  const todayX = pad.left + (todayIdx / (DATE_RANGE.length - 1)) * innerW;

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>May 17, 2026 — 15 events across Tech, Healthcare, Energy &amp; Finance</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={innerH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={pad.top} width={pad.left + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />

          {[1, 2, 3].map((v) => {
            const y = pad.top + innerH - ((v - 0.5) / 3) * innerH;
            return (
              <g key={v}>
                <line x1={pad.left} x2={pad.left + innerW} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}>
                  {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
                </text>
              </g>
            );
          })}

          {DATE_RANGE.map((d, i) => {
            const x = pad.left + (i / (DATE_RANGE.length - 1)) * innerW;
            return (
              <text key={d} x={x} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={11}>
                {DATE_LABELS[i]}
              </text>
            );
          })}

          <line x1={todayX} x2={todayX} y1={pad.top - 10} y2={pad.top + innerH + 10} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={pad.top - 14} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {dots.map((d) => (
            <circle
              key={d.id}
              cx={d.x}
              cy={d.y}
              r={d.impact === 'High' ? 9 : 7}
              fill={INDUSTRY_COLORS[d.industry]}
              opacity={selected && selected.id !== d.id ? 0.3 : 0.9}
              stroke={selected && selected.id === d.id ? '#fff' : 'none'}
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
              onClick={() => setSelected(d.id === selected?.id ? null : d)}
            />
          ))}
        </svg>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: 14, marginBottom: 8 }}>
                {selected.ticker} · {selected.industry} · {selected.date} · Impact: {selected.impact}
              </p>
            </div>
            <span style={{ background: REC_COLORS[selected.rec], color: '#fff', padding: '4px 14px', borderRadius: 999, fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
              {selected.rec}
            </span>
          </div>
          <p style={{ fontSize: 14, color: '#cbd5e1' }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e) => (
              <tr
                key={e.id}
                onClick={() => setSelected(e)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', transition: 'background 0.15s' }}
                onMouseOver={(ev) => (ev.currentTarget.style.background = '#1e293b')}
                onMouseOut={(ev) => (ev.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{e.date}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600, color: INDUSTRY_COLORS[e.industry] }}>{e.ticker}</td>
                <td style={{ padding: '8px 10px' }}>{e.headline}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[e.industry], display: 'inline-block' }} />
                    {e.industry}
                  </span>
                </td>
                <td style={{ padding: '8px 10px' }}>{e.impact}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ background: REC_COLORS[e.rec], color: '#fff', padding: '2px 10px', borderRadius: 999, fontWeight: 600, fontSize: 11 }}>
                    {e.rec}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
        Generated {TODAY} · Data sourced from CNBC, Yahoo Finance, TheStreet, Kiplinger · Not financial advice
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
