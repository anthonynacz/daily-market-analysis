import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const RECOMMENDATION_COLORS = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#eab308',
  WATCH: '#3b82f6',
};

const EVENTS = [
  { id: 1, headline: 'UnitedHealth Group Q1 Earnings — Strong Revenue but Rising Medical Costs', date: '2026-04-21', industry: 'Healthcare', impact: 'High', ticker: 'UNH', recommendation: 'HOLD', reason: 'Solid topline growth offset by rising medical loss ratios pressuring margins.' },
  { id: 2, headline: 'Capital One Q1 Earnings — Consumer Lending Steady', date: '2026-04-21', industry: 'Finance', impact: 'Medium', ticker: 'COF', recommendation: 'HOLD', reason: 'Healthy consumer lending volumes offset by higher credit loss provisions.' },
  { id: 3, headline: 'Alphabet Unveils New AI Chips & Cloud Partnerships', date: '2026-04-22', industry: 'Tech', impact: 'High', ticker: 'GOOGL', recommendation: 'BUY', reason: 'New custom AI silicon and expanded cloud partnerships strengthen competitive moat.' },
  { id: 4, headline: 'Tesla Q1 Earnings Beat Estimates, Shares Jump', date: '2026-04-22', industry: 'Tech', impact: 'High', ticker: 'TSLA', recommendation: 'HOLD', reason: 'Earnings beat but slowing delivery growth and margin compression warrant caution.' },
  { id: 5, headline: 'IBM Q1 Earnings Miss — Consulting Weakness Drags', date: '2026-04-22', industry: 'Tech', impact: 'High', ticker: 'IBM', recommendation: 'SELL', reason: 'Revenue miss and weak consulting guidance sent shares down 7%.' },
  { id: 6, headline: 'ServiceNow Billings Miss Sends Shares Down 13%', date: '2026-04-22', industry: 'Tech', impact: 'High', ticker: 'NOW', recommendation: 'SELL', reason: 'Subscription billings miss signals slowing enterprise software demand.' },
  { id: 7, headline: 'GE Vernova Soars 12% on Strong Power Generation Demand', date: '2026-04-22', industry: 'Energy', impact: 'High', ticker: 'GEV', recommendation: 'BUY', reason: 'Surging power generation and grid equipment demand drives breakout quarter.' },
  { id: 8, headline: 'Iran Ceasefire Extension Lifts Oil & Equity Markets', date: '2026-04-22', industry: 'Energy', impact: 'High', ticker: 'XOM', recommendation: 'HOLD', reason: 'Geopolitical stability supports energy sector but reduced risk premium caps upside.' },
  { id: 9, headline: 'Coinbase Rallies 5% as Crypto Market Booms', date: '2026-04-22', industry: 'Finance', impact: 'Medium', ticker: 'COIN', recommendation: 'BUY', reason: 'Risk-on sentiment and ceasefire headlines spark broad crypto rally.' },
  { id: 10, headline: 'S&P Global Flash PMI — Manufacturing & Services Gauge', date: '2026-04-23', industry: 'Finance', impact: 'High', ticker: 'SPY', recommendation: 'WATCH', reason: 'Key leading indicator for economic momentum and Fed policy direction.' },
  { id: 11, headline: 'New Home Sales Report — Housing Market Health Check', date: '2026-04-24', industry: 'Finance', impact: 'Medium', ticker: 'DHI', recommendation: 'WATCH', reason: 'Housing data critical amid elevated mortgage rates and tight inventory.' },
  { id: 12, headline: 'Boston Scientific Pipeline & Innovation Showcase', date: '2026-04-24', industry: 'Healthcare', impact: 'Medium', ticker: 'BSX', recommendation: 'WATCH', reason: 'Medical device pipeline update could catalyze Q2 outlook revisions.' },
  { id: 13, headline: 'Durable Goods Orders — Capital Spending Indicator', date: '2026-04-25', industry: 'Energy', impact: 'Medium', ticker: 'CAT', recommendation: 'WATCH', reason: 'Factory orders data signals industrial capex trends and energy infrastructure spend.' },
  { id: 14, headline: 'GDP Q1 Advance Estimate — First Growth Reading', date: '2026-04-28', industry: 'Finance', impact: 'High', ticker: 'SPY', recommendation: 'WATCH', reason: 'First official Q1 growth estimate crucial for Fed rate path and market direction.' },
];

const TODAY = '2026-04-23';

const DATES = [
  '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23',
  '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27', '2026-04-28',
];

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const todayIndex = DATES.indexOf(TODAY);

  const points = useMemo(() => {
    return EVENTS.map((ev) => {
      const di = DATES.indexOf(ev.date);
      const x = padding.left + (di / (DATES.length - 1)) * plotW;
      const impactVal = IMPACT_MAP[ev.impact];
      const y = padding.top + plotH - ((impactVal - 0.5) / 3) * plotH;
      return { ...ev, x, y };
    });
  }, []);

  const todayX = padding.left + (todayIndex / (DATES.length - 1)) * plotW;

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{TODAY} &middot; 14 events across Tech, Healthcare, Energy &amp; Finance</p>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([ind, col]) => (
          <span key={ind} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: col, display: 'inline-block' }} />
            {ind}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padding.left} y={padding.top} width={todayX - padding.left} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padding.top} width={padding.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {[1, 2, 3].map((v) => {
            const y = padding.top + plotH - ((v - 0.5) / 3) * plotH;
            return (
              <g key={v}>
                <line x1={padding.left} x2={padding.left + plotW} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize={12}>
                  {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
                </text>
              </g>
            );
          })}

          {DATES.map((d, i) => {
            const x = padding.left + (i / (DATES.length - 1)) * plotW;
            return (
              <text key={d} x={x} y={chartHeight - 10} textAnchor="middle" fill="#64748b" fontSize={11}>
                {d.slice(5)}
              </text>
            );
          })}

          <line x1={todayX} x2={todayX} y1={padding.top} y2={padding.top + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padding.top - 10} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {points.map((p) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.y}
              r={selected?.id === p.id ? 9 : 7}
              fill={INDUSTRY_COLORS[p.industry]}
              stroke={selected?.id === p.id ? '#fff' : 'none'}
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
              onClick={() => setSelected(selected?.id === p.id ? null : p)}
            />
          ))}
        </svg>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', border: '1px solid #1e293b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0' }}>
                {selected.ticker} &middot; {selected.industry} &middot; {selected.date} &middot; Impact: {selected.impact}
              </p>
            </div>
            <span style={{
              padding: '0.25rem 0.75rem',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 700,
              color: '#fff',
              background: RECOMMENDATION_COLORS[selected.recommendation],
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem' }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.25rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Industry', 'Impact', 'Recommendation', 'Headline'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: '#94a3b8', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((ev) => (
              <tr
                key={ev.id}
                onClick={() => setSelected(ev)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}
              >
                <td style={{ padding: '0.6rem 0.75rem' }}>{ev.date.slice(5)}</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>{ev.impact}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: '#fff',
                    background: RECOMMENDATION_COLORS[ev.recommendation],
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>{ev.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DailyMarketAnalysis;
