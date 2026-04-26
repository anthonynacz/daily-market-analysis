import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const EVENTS = [
  { id: 1, headline: 'Intel Q1 Earnings Surge +23.6%', industry: 'Tech', date: '2026-04-24', impact: 'High', ticker: 'INTC', recommendation: 'BUY', reason: 'Turnaround gains momentum with strong chip demand and foundry progress.' },
  { id: 2, headline: 'NVIDIA Extends AI Rally to Record Highs', industry: 'Tech', date: '2026-04-24', impact: 'High', ticker: 'NVDA', recommendation: 'HOLD', reason: 'Dominant AI position intact but valuations priced for perfection.' },
  { id: 3, headline: 'Tesla Q1 Earnings Show Margin Pressure', industry: 'Tech', date: '2026-04-22', impact: 'High', ticker: 'TSLA', recommendation: 'WATCH', reason: 'EV competition intensifies globally; margins under sustained pressure.' },
  { id: 4, headline: 'Amazon Q1 Earnings Preview — AI & Cloud Growth', industry: 'Tech', date: '2026-04-29', impact: 'High', ticker: 'AMZN', recommendation: 'BUY', reason: 'Anthropic partnership and Trainium chip adoption drive cloud outlook.' },
  { id: 5, headline: 'Meta Announces 8,000 Layoffs for Efficiency', industry: 'Tech', date: '2026-04-25', impact: 'Medium', ticker: 'META', recommendation: 'HOLD', reason: 'Cost cuts are positive but heavy AI infrastructure spending continues.' },
  { id: 6, headline: 'Cannabis Rescheduled to Schedule III', industry: 'Healthcare', date: '2026-04-25', impact: 'High', ticker: 'TLRY', recommendation: 'BUY', reason: '280E tax burden removed; sector profitability boost ahead.' },
  { id: 7, headline: 'Cigna Group Q1 Earnings Report', industry: 'Healthcare', date: '2026-04-30', impact: 'Medium', ticker: 'CI', recommendation: 'WATCH', reason: 'Healthcare cost trends will signal managed care sector direction.' },
  { id: 8, headline: 'GE Aerospace Backlog & Aviation Guidance', industry: 'Healthcare', date: '2026-04-28', impact: 'Medium', ticker: 'GE', recommendation: 'HOLD', reason: 'Strong aviation backlog but supply chain headwinds persist.' },
  { id: 9, headline: 'Oil Price Drop Pressures Energy Sector', industry: 'Energy', date: '2026-04-25', impact: 'Medium', ticker: 'XOM', recommendation: 'SELL', reason: 'Falling crude prices compress margins with limited near-term catalysts.' },
  { id: 10, headline: 'US-Iran Ceasefire Extension Eases Supply Fears', industry: 'Energy', date: '2026-04-23', impact: 'High', ticker: 'CVX', recommendation: 'HOLD', reason: 'Geopolitical de-escalation reduces risk premium and caps oil upside.' },
  { id: 11, headline: 'Texas Instruments Earnings — Chip Cycle Signal', industry: 'Energy', date: '2026-04-28', impact: 'Medium', ticker: 'TXN', recommendation: 'WATCH', reason: 'Semiconductor bellwether signals broader industrial chip demand trends.' },
  { id: 12, headline: 'Fed FOMC Meeting — Rate Decision Apr 28-29', industry: 'Finance', date: '2026-04-29', impact: 'High', ticker: 'JPM', recommendation: 'WATCH', reason: 'Markets pricing steady rates; any surprise would move all sectors.' },
  { id: 13, headline: 'American Express Q1 Earnings — Consumer Health', industry: 'Finance', date: '2026-04-28', impact: 'Medium', ticker: 'AXP', recommendation: 'HOLD', reason: 'Premium consumer spending remains resilient despite macro uncertainty.' },
  { id: 14, headline: 'S&P 500 Breaks Above 7,000 Milestone', industry: 'Finance', date: '2026-04-24', impact: 'High', ticker: 'SPY', recommendation: 'HOLD', reason: 'Historic milestone reached; watch for near-term consolidation.' },
];

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-04-26';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filteredEvents = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const startDate = parseDate('2026-04-23');
  const endDate = parseDate('2026-05-01');
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const chartW = 800;
  const chartH = 300;
  const padL = 60;
  const padR = 30;
  const padT = 30;
  const padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  function xPos(dateStr) {
    const d = parseDate(dateStr);
    const dayOffset = (d - startDate) / (1000 * 60 * 60 * 24);
    return padL + (dayOffset / totalDays) * plotW;
  }

  function yPos(impact) {
    const val = IMPACT_Y[impact];
    return padT + plotH - ((val - 0.5) / 3) * plotH;
  }

  const todayX = xPos(TODAY);

  const days = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>April 26, 2026 — 14 events across Tech, Healthcare, Energy & Finance</p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['All', ...Object.keys(INDUSTRY_COLORS)].map(ind => (
          <button
            key={ind}
            onClick={() => setFilterIndustry(ind)}
            style={{
              padding: '6px 16px',
              borderRadius: '20px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              background: filterIndustry === ind ? (ind === 'All' ? '#475569' : INDUSTRY_COLORS[ind]) : '#1e293b',
              color: filterIndustry === ind ? '#fff' : '#94a3b8',
            }}
          >
            {ind}
          </button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '16px', padding: '24px', marginBottom: '24px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>Event Timeline — Impact vs Date</h2>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {['High', 'Medium', 'Low'].map(level => {
            const y = yPos(level);
            return (
              <g key={level}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={padL - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize={12}>{level}</text>
              </g>
            );
          })}

          {days.map(d => {
            const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const x = xPos(ds);
            return (
              <g key={ds}>
                <line x1={x} y1={padT} x2={x} y2={padT + plotH} stroke="#1e293b" strokeWidth={0.5} />
                <text x={x} y={padT + plotH + 20} textAnchor="middle" fill="#64748b" fontSize={11}>{formatDate(d)}</text>
              </g>
            );
          })}

          <line x1={todayX} y1={padT - 10} x2={todayX} y2={padT + plotH + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 14} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {filteredEvents.map(ev => {
            const cx = xPos(ev.date);
            const cy = yPos(ev.impact);
            const isSelected = selected?.id === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <title>{ev.ticker}: {ev.headline}</title>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#94a3b8' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '16px', padding: '24px', marginBottom: '24px', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '4px' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '14px', margin: 0 }}>{selected.ticker} · {selected.industry} · {selected.date} · Impact: {selected.impact}</p>
            </div>
            <span style={{
              padding: '6px 18px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 700,
              color: '#fff',
              background: REC_COLORS[selected.recommendation],
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '12px', color: '#cbd5e1', lineHeight: 1.6 }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '16px', padding: '24px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(ev => (
              <tr
                key={ev.id}
                onClick={() => setSelected(ev)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}
              >
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ev.date}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '10px 12px' }}>{ev.headline}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry], display: 'inline-block' }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>{ev.impact}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#fff',
                    background: REC_COLORS[ev.recommendation],
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
        Generated {TODAY} · For informational purposes only · Not financial advice
      </p>
    </div>
  );
}
