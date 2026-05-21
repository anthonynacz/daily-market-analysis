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

const TODAY = '2026-05-21';

const EVENTS = [
  {
    id: 1,
    headline: 'Nvidia Q1 Earnings Beat — Revenue $81.6B, Up 85% YoY',
    industry: 'Tech',
    date: '2026-05-20',
    impact: 'High',
    ticker: 'NVDA',
    recommendation: 'HOLD',
    reason: 'Strong beat already priced into 74% yearly rally; wait for pullback entry.',
  },
  {
    id: 2,
    headline: 'SpaceX Files IPO Prospectus With Regulators',
    industry: 'Tech',
    date: '2026-05-21',
    impact: 'High',
    ticker: 'SPACEX',
    recommendation: 'WATCH',
    reason: 'Record-setting IPO expected; monitor for pricing and allocation details.',
  },
  {
    id: 3,
    headline: 'GameStop Raises eBay Stake to 6.55%, Pushes Takeover',
    industry: 'Tech',
    date: '2026-05-20',
    impact: 'Medium',
    ticker: 'GME',
    recommendation: 'WATCH',
    reason: 'Hostile takeover bid adds speculative risk; high volatility expected.',
  },
  {
    id: 4,
    headline: 'eBay Board Rejects $56B GameStop Takeover Proposal',
    industry: 'Tech',
    date: '2026-05-20',
    impact: 'Medium',
    ticker: 'EBAY',
    recommendation: 'HOLD',
    reason: 'Board rejection creates uncertainty but underlying business remains solid.',
  },
  {
    id: 5,
    headline: 'Oil Prices Slide on Middle East Peace Optimism',
    industry: 'Energy',
    date: '2026-05-20',
    impact: 'High',
    ticker: 'XOM',
    recommendation: 'SELL',
    reason: 'Falling crude prices pressure energy sector margins near-term.',
  },
  {
    id: 6,
    headline: 'Comstock Resources Q1 Earnings Report',
    industry: 'Energy',
    date: '2026-05-19',
    impact: 'Medium',
    ticker: 'CRK',
    recommendation: 'HOLD',
    reason: 'Natural gas producer faces mixed demand outlook and pricing headwinds.',
  },
  {
    id: 7,
    headline: 'Chevron Benefits From Mideast De-escalation',
    industry: 'Energy',
    date: '2026-05-22',
    impact: 'Medium',
    ticker: 'CVX',
    recommendation: 'BUY',
    reason: 'Peace progress secures Chevron regional operations and reduces risk premium.',
  },
  {
    id: 8,
    headline: 'FOMC Meeting Minutes Released — Rates Held at 3.50-3.75%',
    industry: 'Finance',
    date: '2026-05-20',
    impact: 'High',
    ticker: 'SPY',
    recommendation: 'WATCH',
    reason: 'Fed holds steady; minutes may reveal timing clues for future cuts.',
  },
  {
    id: 9,
    headline: '10-Year Treasury Yield Hits Highest Level in a Year',
    industry: 'Finance',
    date: '2026-05-18',
    impact: 'High',
    ticker: 'TLT',
    recommendation: 'SELL',
    reason: 'Rising yields pressure bonds and rate-sensitive equities.',
  },
  {
    id: 10,
    headline: 'AMC CEO Adam Aron Buys 250K Shares Worth $344K',
    industry: 'Finance',
    date: '2026-05-20',
    impact: 'Medium',
    ticker: 'AMC',
    recommendation: 'WATCH',
    reason: 'Insider buying signals confidence but company fundamentals remain weak.',
  },
  {
    id: 11,
    headline: 'Q1 2026 GDP Advance Estimate Due May 28',
    industry: 'Finance',
    date: '2026-05-26',
    impact: 'High',
    ticker: 'SPY',
    recommendation: 'WATCH',
    reason: 'Key macro indicator for recession risk and Fed policy trajectory.',
  },
  {
    id: 12,
    headline: 'Dr. Reddy\'s Laboratories Q1 Earnings Filed',
    industry: 'Healthcare',
    date: '2026-05-19',
    impact: 'Medium',
    ticker: 'RDY',
    recommendation: 'HOLD',
    reason: 'Generic pharma steady but ongoing pricing pressure limits upside.',
  },
  {
    id: 13,
    headline: 'UnitedHealth Faces Heightened Regulatory Scrutiny',
    industry: 'Healthcare',
    date: '2026-05-22',
    impact: 'High',
    ticker: 'UNH',
    recommendation: 'SELL',
    reason: 'DOJ investigation and political headwinds weigh on managed care outlook.',
  },
  {
    id: 14,
    headline: 'Eli Lilly Expands GLP-1 Drug Manufacturing Capacity',
    industry: 'Healthcare',
    date: '2026-05-23',
    impact: 'High',
    ticker: 'LLY',
    recommendation: 'BUY',
    reason: 'Massive demand runway for weight-loss drugs supports premium valuation.',
  },
];

const DATES = [
  '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21',
  '2026-05-22', '2026-05-23', '2026-05-24', '2026-05-25', '2026-05-26',
];

const IMPACT_Y = { High: 1, Medium: 2, Low: 3 };

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 80 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const todayIndex = DATES.indexOf(TODAY);

  const dots = useMemo(() => {
    return EVENTS.map((ev) => {
      const di = DATES.indexOf(ev.date);
      const x = padding.left + (di / (DATES.length - 1)) * plotW;
      const y = padding.top + ((IMPACT_Y[ev.impact] - 1) / 2) * plotH;
      return { ...ev, x, y };
    });
  }, []);

  const todayX = padding.left + (todayIndex / (DATES.length - 1)) * plotW;

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '2rem' }}>{TODAY} — 14 events across 4 industries</p>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.85rem' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} style={{ width: '100%', maxWidth: chartWidth }}>
          <rect x={padding.left} y={padding.top} width={todayX - padding.left} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padding.top} width={padding.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {DATES.map((d, i) => {
            const x = padding.left + (i / (DATES.length - 1)) * plotW;
            return (
              <g key={d}>
                <line x1={x} y1={padding.top} x2={x} y2={padding.top + plotH} stroke="#1e293b" strokeWidth={1} />
                <text x={x} y={chartHeight - 10} textAnchor="middle" fill="#64748b" fontSize={11}>{d.slice(5)}</text>
              </g>
            );
          })}

          {['High', 'Medium'].map((label, i) => {
            const y = padding.top + (i / 2) * plotH;
            return (
              <g key={label}>
                <line x1={padding.left} y1={y} x2={padding.left + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}>{label}</text>
              </g>
            );
          })}

          <line x1={todayX} y1={padding.top - 10} x2={todayX} y2={padding.top + plotH + 10} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padding.top - 15} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={dot.id === selected?.id ? 9 : 7}
              fill={INDUSTRY_COLORS[dot.industry]}
              opacity={selected && selected.id !== dot.id ? 0.3 : 0.9}
              style={{ cursor: 'pointer', transition: 'all 0.2s' }}
              onClick={() => setSelected(dot.id === selected?.id ? null : dot)}
            />
          ))}
        </svg>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0' }}>{selected.ticker} · {selected.industry} · {selected.date} · {selected.impact} Impact</p>
            </div>
            <span style={{
              background: RECOMMENDATION_COLORS[selected.recommendation],
              color: selected.recommendation === 'HOLD' ? '#000' : '#fff',
              padding: '0.25rem 0.75rem',
              borderRadius: 999,
              fontSize: '0.8rem',
              fontWeight: 700,
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem' }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec.'].map((h) => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
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
                <td style={{ padding: '0.625rem 1rem', whiteSpace: 'nowrap' }}>{ev.date.slice(5)}</td>
                <td style={{ padding: '0.625rem 1rem', fontWeight: 600, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '0.625rem 1rem' }}>{ev.headline}</td>
                <td style={{ padding: '0.625rem 1rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry] }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '0.625rem 1rem' }}>{ev.impact}</td>
                <td style={{ padding: '0.625rem 1rem' }}>
                  <span style={{
                    background: RECOMMENDATION_COLORS[ev.recommendation],
                    color: ev.recommendation === 'HOLD' ? '#000' : '#fff',
                    padding: '0.15rem 0.5rem',
                    borderRadius: 999,
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem', textAlign: 'center' }}>
        Data sourced from CNBC, TheStreet, Kiplinger, BLS, and Federal Reserve. For informational purposes only — not financial advice.
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
