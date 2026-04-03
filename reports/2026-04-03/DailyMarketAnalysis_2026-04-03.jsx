import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const EVENTS = [
  {
    id: 1,
    headline: 'Oil Surges Near $110/bbl on Iran War Escalation',
    industry: 'Energy',
    date: '2026-04-02',
    impact: 'High',
    ticker: 'CL=F',
    recommendation: 'WATCH',
    reason: 'Extreme volatility — wait for ceasefire clarity before entering energy trades.',
  },
  {
    id: 2,
    headline: 'Tesla Q1 Deliveries Rise YoY but Fall QoQ, Shares Drop 5%',
    industry: 'Tech',
    date: '2026-04-02',
    impact: 'High',
    ticker: 'TSLA',
    recommendation: 'HOLD',
    reason: 'Delivery growth intact but sequential decline signals demand softness; wait for earnings April 20.',
  },
  {
    id: 3,
    headline: 'APA Corp Rallies 4.3% on Energy Sector Tailwinds',
    industry: 'Energy',
    date: '2026-04-02',
    impact: 'Medium',
    ticker: 'APA',
    recommendation: 'BUY',
    reason: 'Strong upstream exposure benefits from elevated crude; attractive valuation vs. peers.',
  },
  {
    id: 4,
    headline: 'Globalstar Jumps 13% on Amazon Acquisition Rumors',
    industry: 'Tech',
    date: '2026-04-02',
    impact: 'Medium',
    ticker: 'GSAT',
    recommendation: 'WATCH',
    reason: 'Speculative pop on unconfirmed report — high risk if deal falls through.',
  },
  {
    id: 5,
    headline: 'Airlines Sell Off ~4% on Surging Fuel Costs',
    industry: 'Finance',
    date: '2026-04-02',
    impact: 'High',
    ticker: 'DAL',
    recommendation: 'SELL',
    reason: 'Jet fuel costs compressing margins; geopolitical risk adds headwind through Q2.',
  },
  {
    id: 6,
    headline: 'Nike Reports Mixed Q3 Earnings',
    industry: 'Finance',
    date: '2026-04-02',
    impact: 'Medium',
    ticker: 'NKE',
    recommendation: 'HOLD',
    reason: 'Revenue beat but inventory buildup remains a concern; await forward guidance clarity.',
  },
  {
    id: 7,
    headline: 'S&P 500 Rockets on End-of-War Hopes Before Reversing',
    industry: 'Finance',
    date: '2026-04-01',
    impact: 'High',
    ticker: 'SPY',
    recommendation: 'HOLD',
    reason: 'Headline-driven whipsaw — stay diversified until geopolitical picture stabilizes.',
  },
  {
    id: 8,
    headline: 'Exxon Mobil Gains 3% as Crude Rallies',
    industry: 'Energy',
    date: '2026-04-01',
    impact: 'Medium',
    ticker: 'XOM',
    recommendation: 'BUY',
    reason: 'Integrated major with strong cash flow benefits from sustained high oil prices.',
  },
  {
    id: 9,
    headline: 'Russell 2000 Rallies as Small Caps Outperform',
    industry: 'Finance',
    date: '2026-04-02',
    impact: 'Medium',
    ticker: 'IWM',
    recommendation: 'BUY',
    reason: 'Small-cap rotation signals broadening market; domestic focus insulates from trade risk.',
  },
  {
    id: 10,
    headline: 'US Jobs Report (Non-Farm Payrolls) Due Friday',
    industry: 'Finance',
    date: '2026-04-03',
    impact: 'High',
    ticker: 'SPY',
    recommendation: 'WATCH',
    reason: 'Key labor data could shift Fed rate expectations — position hedges before release.',
  },
  {
    id: 11,
    headline: 'Alphabet Q1 Earnings Preview — AI Revenue in Focus',
    industry: 'Tech',
    date: '2026-04-22',
    impact: 'High',
    ticker: 'GOOGL',
    recommendation: 'BUY',
    reason: 'Cloud + AI momentum strong; search ad resilience makes pullbacks attractive entry points.',
  },
  {
    id: 12,
    headline: 'Amazon Q1 Earnings & Possible Globalstar Deal Update',
    industry: 'Tech',
    date: '2026-04-23',
    impact: 'High',
    ticker: 'AMZN',
    recommendation: 'BUY',
    reason: 'AWS growth re-accelerating and retail margins expanding; satellite play adds optionality.',
  },
  {
    id: 13,
    headline: 'Microsoft Q3 Earnings — Azure Growth Key Metric',
    industry: 'Tech',
    date: '2026-04-28',
    impact: 'High',
    ticker: 'MSFT',
    recommendation: 'BUY',
    reason: 'Copilot monetization ramping; Azure AI workloads driving durable double-digit growth.',
  },
  {
    id: 14,
    headline: 'Strait of Hormuz Monitoring Protocol Announced',
    industry: 'Energy',
    date: '2026-04-02',
    impact: 'Medium',
    ticker: 'USO',
    recommendation: 'WATCH',
    reason: 'Potential de-escalation signal but enforcement uncertain; oil could swing either way.',
  },
  {
    id: 15,
    headline: 'UnitedHealth Faces DOJ Antitrust Probe Reports',
    industry: 'Healthcare',
    date: '2026-04-01',
    impact: 'High',
    ticker: 'UNH',
    recommendation: 'SELL',
    reason: 'Regulatory overhang could compress multiples; risk/reward unfavorable near-term.',
  },
];

const DATES = [
  '2026-03-31', '2026-04-01', '2026-04-02', '2026-04-03',
  '2026-04-04', '2026-04-05', '2026-04-06', '2026-04-07', '2026-04-08',
];

const DATE_LABELS = ['Mar 31', 'Apr 1', 'Apr 2', 'Apr 3', 'Apr 4', 'Apr 5', 'Apr 6', 'Apr 7', 'Apr 8'];

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(
    () => (filterIndustry === 'All' ? EVENTS : EVENTS.filter((e) => e.industry === filterIndustry)),
    [filterIndustry]
  );

  const chartW = 800;
  const chartH = 300;
  const padL = 50;
  const padR = 20;
  const padT = 30;
  const padB = 40;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const todayIdx = DATES.indexOf('2026-04-03');
  const xScale = (date) => {
    const idx = DATES.indexOf(date);
    if (idx === -1) return padL + plotW * 0.5;
    return padL + (idx / (DATES.length - 1)) * plotW;
  };
  const yScale = (impact) => padT + plotH - ((IMPACT_MAP[impact] - 0.5) / 3) * plotH;
  const todayX = padL + (todayIdx / (DATES.length - 1)) * plotW;

  return (
    <div style={{ background: '#0b0f1a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 20 }}>2026-04-03 &mdash; Top events across Tech, Healthcare, Energy &amp; Finance</p>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['All', ...Object.keys(INDUSTRY_COLORS)].map((ind) => (
          <button
            key={ind}
            onClick={() => { setSelected(null); setFilterIndustry(ind); }}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: filterIndustry === ind ? '2px solid #818cf8' : '1px solid #334155',
              background: filterIndustry === ind ? '#1e293b' : '#151c2c',
              color: ind === 'All' ? '#e2e8f0' : INDUSTRY_COLORS[ind] || '#e2e8f0',
              cursor: 'pointer',
              fontWeight: filterIndustry === ind ? 700 : 400,
            }}
          >
            {ind}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, marginBottom: 20, overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past bg */}
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          {/* Future bg */}
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />
          {/* Grid lines */}
          {[1, 2, 3].map((v) => (
            <line key={v} x1={padL} x2={padL + plotW} y1={yScale(v === 1 ? 'Low' : v === 2 ? 'Medium' : 'High')} y2={yScale(v === 1 ? 'Low' : v === 2 ? 'Medium' : 'High')} stroke="#1e293b" />
          ))}
          {/* Y labels */}
          {['Low', 'Medium', 'High'].map((label) => (
            <text key={label} x={padL - 8} y={yScale(label) + 4} textAnchor="end" fill="#64748b" fontSize={11}>{label}</text>
          ))}
          {/* X labels */}
          {DATE_LABELS.map((label, i) => (
            <text key={i} x={padL + (i / (DATES.length - 1)) * plotW} y={chartH - 8} textAnchor="middle" fill="#64748b" fontSize={10}>{label}</text>
          ))}
          {/* TODAY line */}
          <line x1={todayX} x2={todayX} y1={padT} y2={padT + plotH} stroke="#ef4444" strokeDasharray="6 4" strokeWidth={2} />
          <text x={todayX} y={padT - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={700}>TODAY</text>
          {/* Dots */}
          {filtered.map((ev) => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact) + (Math.random() * 10 - 5);
            return (
              <circle
                key={ev.id}
                cx={cx}
                cy={cy}
                r={selected?.id === ev.id ? 9 : 7}
                fill={INDUSTRY_COLORS[ev.industry]}
                stroke={selected?.id === ev.id ? '#fff' : 'none'}
                strokeWidth={2}
                style={{ cursor: 'pointer', transition: 'r 0.2s' }}
                onClick={() => setSelected(ev)}
              />
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18 }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', margin: '6px 0' }}>
                <span style={{ color: INDUSTRY_COLORS[selected.industry], fontWeight: 600 }}>{selected.industry}</span> &bull; {selected.ticker} &bull; {selected.date} &bull; Impact: {selected.impact}
              </p>
            </div>
            <span style={{
              padding: '4px 14px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 700,
              color: '#fff',
              background: REC_COLORS[selected.recommendation],
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', marginTop: 10 }}>{selected.reason}</p>
          <button onClick={() => setSelected(null)} style={{ marginTop: 10, background: 'transparent', border: '1px solid #475569', color: '#94a3b8', padding: '4px 12px', borderRadius: 6, cursor: 'pointer' }}>Close</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
              <th style={{ padding: 8, color: '#94a3b8' }}>Date</th>
              <th style={{ padding: 8, color: '#94a3b8' }}>Headline</th>
              <th style={{ padding: 8, color: '#94a3b8' }}>Industry</th>
              <th style={{ padding: 8, color: '#94a3b8' }}>Ticker</th>
              <th style={{ padding: 8, color: '#94a3b8' }}>Impact</th>
              <th style={{ padding: 8, color: '#94a3b8' }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((ev) => (
              <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}>
                <td style={{ padding: 8 }}>{ev.date}</td>
                <td style={{ padding: 8 }}>{ev.headline}</td>
                <td style={{ padding: 8, color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</td>
                <td style={{ padding: 8, fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: 8 }}>{ev.impact}</td>
                <td style={{ padding: 8 }}>
                  <span style={{ padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, color: '#fff', background: REC_COLORS[ev.recommendation] }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 20 }}>Generated 2026-04-03 &bull; For informational purposes only &bull; Not financial advice</p>
    </div>
  );
}
