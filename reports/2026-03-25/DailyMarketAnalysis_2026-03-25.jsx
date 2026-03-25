import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

const EVENTS = [
  { id: 1, headline: 'Software Sector Selloff — IGV Down 23% YTD on AI Disruption Fears', industry: 'Tech', date: '2026-03-24', impact: 'High', ticker: 'MSFT', recommendation: 'SELL', reason: 'AI disruption fears are crushing software valuations with no near-term catalyst for reversal.' },
  { id: 2, headline: 'Salesforce Drops 4% Amid Weak Enterprise Spending', industry: 'Tech', date: '2026-03-24', impact: 'Medium', ticker: 'CRM', recommendation: 'SELL', reason: 'Enterprise AI headwinds and declining deal sizes signal continued weakness.' },
  { id: 3, headline: 'Micron Earnings Report — Q2 FY2026', industry: 'Tech', date: '2026-03-26', impact: 'High', ticker: 'MU', recommendation: 'WATCH', reason: 'Strong momentum in memory chips but semiconductor volatility warrants caution pre-earnings.' },
  { id: 4, headline: 'AWS Bahrain Region Disrupted by Drone Activity', industry: 'Tech', date: '2026-03-24', impact: 'Medium', ticker: 'AMZN', recommendation: 'HOLD', reason: 'Regional cloud disruption is temporary but highlights growing geopolitical risk to infrastructure.' },
  { id: 5, headline: 'Iran-US Peace Plan Proposal — Diplomatic Breakthrough', industry: 'Energy', date: '2026-03-25', impact: 'High', ticker: 'XLE', recommendation: 'WATCH', reason: 'A confirmed deal could crash oil prices 15-20%; wait for official confirmation before acting.' },
  { id: 6, headline: 'Crude Oil Surges to $91.80 as War Enters Fourth Week', industry: 'Energy', date: '2026-03-24', impact: 'High', ticker: 'CVX', recommendation: 'BUY', reason: 'Sustained high oil prices directly boost upstream energy revenues and margins.' },
  { id: 7, headline: 'Strait of Hormuz Shipping Restrictions — Iran $2M Transit Tax', industry: 'Energy', date: '2026-03-23', impact: 'High', ticker: 'XOM', recommendation: 'BUY', reason: 'Supply disruption keeps prices elevated; Exxon benefits from both upstream and refining margins.' },
  { id: 8, headline: 'Fed Holds Rates at 3.50-3.75% Citing Middle East Uncertainty', industry: 'Finance', date: '2026-03-22', impact: 'High', ticker: 'JPM', recommendation: 'HOLD', reason: 'Rate stability supports net interest income but geopolitical uncertainty limits upside.' },
  { id: 9, headline: 'Apollo $15B Fund Hit with Record Redemption Requests', industry: 'Finance', date: '2026-03-24', impact: 'High', ticker: 'APO', recommendation: 'SELL', reason: 'Redemptions exceeding 2x quarterly limits signal credit stress in private markets.' },
  { id: 10, headline: 'Russell 2000 Enters Correction Territory', industry: 'Finance', date: '2026-03-23', impact: 'High', ticker: 'IWM', recommendation: 'WATCH', reason: 'Small caps in correction — wait for stabilization before adding exposure.' },
  { id: 11, headline: 'SEC Considers Scrapping Quarterly Reporting Requirement', industry: 'Finance', date: '2026-03-24', impact: 'Medium', ticker: 'GS', recommendation: 'WATCH', reason: 'Shift to semi-annual reporting could reshape market structure; monitor comment period.' },
  { id: 12, headline: 'FedEx Earnings — Key Read on Global Trade Volumes', industry: 'Finance', date: '2026-03-26', impact: 'Medium', ticker: 'FDX', recommendation: 'WATCH', reason: 'FedEx volumes are a bellwether for global trade; Iran conflict impact on logistics is key.' },
  { id: 13, headline: 'Celsius Holdings Drops 10% on Growth Concerns', industry: 'Healthcare', date: '2026-03-24', impact: 'Medium', ticker: 'CELH', recommendation: 'SELL', reason: 'Growth deceleration in functional beverages amid rising competitive pressure from incumbents.' },
  { id: 14, headline: 'Defensive Rotation Into Healthcare — UNH Outperforms', industry: 'Healthcare', date: '2026-03-25', impact: 'Medium', ticker: 'UNH', recommendation: 'BUY', reason: 'Healthcare offers defensive positioning as investors rotate out of growth amid geopolitical risk.' },
];

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-03-25';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDate(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const startDate = parseDate('2026-03-22');
  const endDate = parseDate('2026-03-30');
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const chartW = 800, chartH = 300, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xScale = (dateStr) => {
    const d = parseDate(dateStr);
    const dayOffset = (d - startDate) / (1000 * 60 * 60 * 24);
    return padL + (dayOffset / totalDays) * plotW;
  };

  const yScale = (impact) => {
    const val = IMPACT_MAP[impact];
    return padT + plotH - ((val - 0.5) / 3) * plotH;
  };

  const todayX = xScale(TODAY);

  const filteredEvents = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const dateTicks = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dateTicks.push(new Date(d));
  }

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{TODAY} &middot; US Markets &middot; 14 Events Tracked</p>

      {/* Legend & Filter */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', ...Object.keys(INDUSTRY_COLORS)].map(ind => (
          <button key={ind} onClick={() => setFilterIndustry(ind)} style={{
            background: filterIndustry === ind ? (ind === 'All' ? '#334155' : INDUSTRY_COLORS[ind] + '33') : 'transparent',
            border: `1px solid ${ind === 'All' ? '#475569' : INDUSTRY_COLORS[ind]}`,
            color: ind === 'All' ? '#e2e8f0' : INDUSTRY_COLORS[ind],
            borderRadius: '9999px', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.8rem',
          }}>
            {ind === 'All' ? 'All Industries' : ind}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.05)" />
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.05)" />

          {[1, 2, 3].map(v => {
            const y = padT + plotH - ((v - 0.5) / 3) * plotH;
            return <line key={v} x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />;
          })}

          {[{ label: 'Low', val: 1 }, { label: 'Medium', val: 2 }, { label: 'High', val: 3 }].map(({ label, val }) => (
            <text key={val} x={padL - 10} y={padT + plotH - ((val - 0.5) / 3) * plotH + 4} textAnchor="end" fill="#64748b" fontSize={11}>{label}</text>
          ))}

          {dateTicks.map((d, i) => {
            const dateStr = d.toISOString().split('T')[0];
            return (
              <text key={i} x={xScale(dateStr)} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={10}>
                {formatDate(d)}
              </text>
            );
          })}

          <line x1={todayX} x2={todayX} y1={padT} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {filteredEvents.map(ev => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact);
            const isSelected = selected?.id === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 9 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx + 12} y={cy + 4} fill="#94a3b8" fontSize={9}>{ev.ticker}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                {selected.industry} &middot; {selected.date} &middot; Impact: {selected.impact} &middot; Ticker: <strong style={{ color: '#e2e8f0' }}>{selected.ticker}</strong>
              </p>
            </div>
            <span style={{
              background: REC_COLORS[selected.recommendation] + '22',
              color: REC_COLORS[selected.recommendation],
              padding: '0.25rem 0.75rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700,
              border: `1px solid ${REC_COLORS[selected.recommendation]}44`,
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem' }}>{selected.reason}</p>
          <button onClick={() => setSelected(null)} style={{ marginTop: '0.75rem', background: 'transparent', border: '1px solid #334155', color: '#94a3b8', padding: '0.25rem 0.75rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.5rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Industry', 'Ticker', 'Impact', 'Rec', 'Headline'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.5rem', color: '#64748b', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: '1px solid #1e293b11', cursor: 'pointer' }}>
                <td style={{ padding: '0.5rem', color: '#94a3b8' }}>{ev.date}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '0.5rem', color: ev.impact === 'High' ? '#f87171' : '#fbbf24' }}>{ev.impact}</td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{
                    background: REC_COLORS[ev.recommendation] + '22',
                    color: REC_COLORS[ev.recommendation],
                    padding: '0.15rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 600,
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
                <td style={{ padding: '0.5rem', color: '#cbd5e1', maxWidth: '400px' }}>{ev.headline}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '2rem' }}>
        Generated {TODAY} &middot; Not financial advice &middot; Do your own research
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
