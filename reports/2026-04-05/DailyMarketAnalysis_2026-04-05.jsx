import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const TODAY = '2026-04-05';

const EVENTS = [
  { id: 1, headline: 'Tesla Q1 Deliveries Miss Estimates, Shares Drop 5%', industry: 'Tech', date: '2026-04-02', impact: 'High', ticker: 'TSLA', recommendation: 'HOLD', reason: 'Delivery miss already priced in; wait for Q1 earnings on Apr 20 for clearer direction.' },
  { id: 2, headline: 'Intel Fab 34 $14.2B Stake Repurchase from Apollo', industry: 'Tech', date: '2026-04-02', impact: 'High', ticker: 'INTC', recommendation: 'BUY', reason: 'Consolidating fab ownership signals confidence in foundry strategy and long-term margin expansion.' },
  { id: 3, headline: 'Oil Surges to $111 as Iran Conflict Escalates', industry: 'Energy', date: '2026-04-02', impact: 'High', ticker: 'XOM', recommendation: 'BUY', reason: 'Elevated crude prices directly boost upstream earnings; XOM well-positioned with diversified portfolio.' },
  { id: 4, headline: 'APA Corp Rallies 4.3% on Energy Sector Momentum', industry: 'Energy', date: '2026-04-02', impact: 'Medium', ticker: 'APA', recommendation: 'WATCH', reason: 'Sharp rally may be overextended short-term; monitor for pullback entry.' },
  { id: 5, headline: 'Nike Slides After Multiple Wall Street Price Target Cuts', industry: 'Finance', date: '2026-04-02', impact: 'Medium', ticker: 'NKE', recommendation: 'SELL', reason: 'Broad analyst downgrades suggest persistent demand weakness and margin pressure ahead.' },
  { id: 6, headline: 'Cruise Lines Tumble ~4% on Oil-Driven Cost Fears', industry: 'Finance', date: '2026-04-02', impact: 'Medium', ticker: 'CCL', recommendation: 'SELL', reason: 'Rising fuel costs squeeze thin margins; geopolitical risk adds booking uncertainty.' },
  { id: 7, headline: 'March Jobs Report Shows Strong Employment Data', industry: 'Finance', date: '2026-04-03', impact: 'High', ticker: 'SPY', recommendation: 'WATCH', reason: 'Strong labor data may delay Fed rate cuts; watch for bond market reaction Monday.' },
  { id: 8, headline: 'ConocoPhillips Gains 3% on Broad Energy Rally', industry: 'Energy', date: '2026-04-02', impact: 'Medium', ticker: 'COP', recommendation: 'BUY', reason: 'Strong free cash flow and shareholder returns make COP a top pick in elevated oil environment.' },
  { id: 9, headline: 'Tesla Q1 Earnings Report Expected', industry: 'Tech', date: '2026-04-20', impact: 'High', ticker: 'TSLA', recommendation: 'WATCH', reason: 'After delivery miss, earnings call guidance will be critical for near-term sentiment.' },
  { id: 10, headline: 'Alphabet Q1 Earnings Report Expected', industry: 'Tech', date: '2026-04-22', impact: 'High', ticker: 'GOOGL', recommendation: 'WATCH', reason: 'AI monetization progress and cloud growth rate will set the tone for big tech earnings.' },
  { id: 11, headline: 'Amazon Q1 Earnings Report Expected', industry: 'Tech', date: '2026-04-23', impact: 'Medium', ticker: 'AMZN', recommendation: 'HOLD', reason: 'AWS growth trajectory and retail margin trends remain key; consensus expectations are reasonable.' },
  { id: 12, headline: 'UnitedHealth Group Q1 Earnings Expected', industry: 'Healthcare', date: '2026-04-15', impact: 'High', ticker: 'UNH', recommendation: 'HOLD', reason: 'Managed care bellwether; medical cost ratio trends will signal sector-wide profitability outlook.' },
  { id: 13, headline: 'Johnson & Johnson Q1 Earnings Expected', industry: 'Healthcare', date: '2026-04-15', impact: 'Medium', ticker: 'JNJ', recommendation: 'BUY', reason: 'Defensive healthcare name with strong pipeline; attractive dividend yield in volatile market.' },
  { id: 14, headline: 'Chevron Rises 3% Amid Middle East Supply Concerns', industry: 'Energy', date: '2026-04-02', impact: 'Medium', ticker: 'CVX', recommendation: 'BUY', reason: 'Integrated major benefits from high oil prices with downstream hedging against volatility.' },
];

const DATES = [
  '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-05',
  '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10',
];

const IMPACT_Y = { High: 1, Medium: 2, Low: 3 };

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800, chartH = 260, padL = 60, padR = 30, padT = 40, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xScale = (date) => {
    const idx = DATES.indexOf(date);
    if (idx === -1) {
      const d = new Date(date);
      const start = new Date(DATES[0]);
      const end = new Date(DATES[DATES.length - 1]);
      const frac = (d - start) / (end - start);
      return padL + frac * plotW;
    }
    return padL + (idx / (DATES.length - 1)) * plotW;
  };

  const yScale = (impact) => padT + ((IMPACT_Y[impact] - 0.5) / 3) * plotH;

  const todayX = xScale(TODAY);
  const todayIdx = DATES.indexOf(TODAY);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>April 5, 2026 — 14 events across Tech, Healthcare, Energy & Finance</p>

      {/* Industry filter */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['All', ...Object.keys(INDUSTRY_COLORS)].map(ind => (
          <button key={ind} onClick={() => { setSelected(null); setFilterIndustry(ind); }}
            style={{
              padding: '0.4rem 1rem', borderRadius: '9999px', border: 'none', cursor: 'pointer',
              background: filterIndustry === ind ? (ind === 'All' ? '#6366f1' : INDUSTRY_COLORS[ind]) : '#1e293b',
              color: filterIndustry === ind ? '#fff' : '#94a3b8', fontWeight: 600, fontSize: '0.85rem',
            }}>
            {ind}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background (faint red) */}
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          {/* Future background (faint green) */}
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {DATES.map((d, i) => (
            <line key={d} x1={xScale(d)} y1={padT} x2={xScale(d)} y2={padT + plotH} stroke="#1e293b" strokeWidth={1} />
          ))}
          {['High', 'Medium', 'Low'].map(imp => (
            <line key={imp} x1={padL} y1={yScale(imp)} x2={padL + plotW} y2={yScale(imp)} stroke="#1e293b" strokeWidth={1} />
          ))}

          {/* Today line */}
          <line x1={todayX} y1={padT - 10} x2={todayX} y2={padT + plotH + 10} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 14} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={700}>TODAY</text>

          {/* Y-axis labels */}
          {['High', 'Medium', 'Low'].map(imp => (
            <text key={imp} x={padL - 10} y={yScale(imp) + 4} textAnchor="end" fill="#94a3b8" fontSize={11}>{imp}</text>
          ))}

          {/* X-axis labels */}
          {DATES.map(d => (
            <text key={d} x={xScale(d)} y={padT + plotH + 20} textAnchor="middle" fill="#94a3b8" fontSize={10}>
              {d.slice(5)}
            </text>
          ))}

          {/* Event dots */}
          {filtered.map(ev => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact);
            const jitter = ((ev.id * 17) % 20) - 10;
            return (
              <g key={ev.id} onClick={() => setSelected(ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx + jitter} cy={cy} r={selected?.id === ev.id ? 10 : 7}
                  fill={INDUSTRY_COLORS[ev.industry]} opacity={selected?.id === ev.id ? 1 : 0.85}
                  stroke={selected?.id === ev.id ? '#fff' : 'none'} strokeWidth={2} />
                <title>{ev.ticker}: {ev.headline}</title>
              </g>
            );
          })}
        </svg>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
          {Object.entries(INDUSTRY_COLORS).map(([ind, col]) => (
            <div key={ind} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: col, display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{ind}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>
                <strong style={{ color: INDUSTRY_COLORS[selected.industry] }}>{selected.industry}</strong> &middot; {selected.date} &middot; {selected.impact} Impact &middot; <strong>{selected.ticker}</strong>
              </p>
            </div>
            <span style={{
              padding: '0.35rem 1rem', borderRadius: '9999px', fontWeight: 700, fontSize: '0.85rem',
              background: REC_COLORS[selected.recommendation] + '22', color: REC_COLORS[selected.recommendation],
              border: `1px solid ${REC_COLORS[selected.recommendation]}44`,
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6 }}>{selected.reason}</p>
          <button onClick={() => setSelected(null)} style={{ marginTop: '1rem', background: '#1e293b', color: '#94a3b8', border: 'none', padding: '0.4rem 1rem', borderRadius: '0.5rem', cursor: 'pointer', fontSize: '0.85rem' }}>Close</button>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left' }}>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Date</th>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Ticker</th>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Headline</th>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Industry</th>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Impact</th>
              <th style={{ padding: '0.6rem 0.5rem', color: '#94a3b8' }}>Rec.</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}>
                <td style={{ padding: '0.6rem 0.5rem' }}>{ev.date.slice(5)}</td>
                <td style={{ padding: '0.6rem 0.5rem', fontWeight: 700 }}>{ev.ticker}</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>{ev.headline}</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '0.6rem 0.5rem' }}>{ev.impact}</td>
                <td style={{ padding: '0.6rem 0.5rem' }}>
                  <span style={{
                    padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700,
                    background: REC_COLORS[ev.recommendation] + '22', color: REC_COLORS[ev.recommendation],
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '2rem' }}>
        Generated on 2026-04-05 &middot; Data sourced from CNBC, Yahoo Finance, Earnings Whispers
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
