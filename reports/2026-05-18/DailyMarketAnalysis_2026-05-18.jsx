import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: 'NVIDIA Q1 Earnings Report — AI Chip Titan Reports Amid Record Expectations', industry: 'Tech', date: '2026-05-20', impact: 'High', ticker: 'NVDA', rec: 'WATCH', reason: 'Massive AI demand but sky-high expectations make volatility likely around results' },
  { id: 2, headline: 'Cisco Surges 13.4% on Strong AI Networking Revenue Beat', industry: 'Tech', date: '2026-05-15', impact: 'High', ticker: 'CSCO', rec: 'BUY', reason: 'AI-driven enterprise networking demand exceeded estimates, signaling durable spending cycle' },
  { id: 3, headline: 'Intel Drops 6%+ in Broad Tech Selloff After Trump-Xi Summit', industry: 'Tech', date: '2026-05-15', impact: 'Medium', ticker: 'INTC', rec: 'HOLD', reason: 'Semiconductor sector rotation underway; wait for stabilization before adding exposure' },
  { id: 4, headline: 'Palo Alto Networks Quarterly Earnings Due', industry: 'Tech', date: '2026-05-19', impact: 'Medium', ticker: 'PANW', rec: 'WATCH', reason: 'Cybersecurity demand remains robust but premium valuation limits upside near-term' },
  { id: 5, headline: 'AMD Falls 5.7% Alongside Semiconductor Peers', industry: 'Tech', date: '2026-05-15', impact: 'Medium', ticker: 'AMD', rec: 'BUY', reason: 'Oversold on broad selloff; AI GPU pipeline and data-center momentum remain strong' },
  { id: 6, headline: 'Medtronic Quarterly Earnings — Medical Device Demand in Focus', industry: 'Healthcare', date: '2026-05-20', impact: 'Medium', ticker: 'MDT', rec: 'HOLD', reason: 'Steady surgical volume recovery but inflation pressuring margins' },
  { id: 7, headline: 'UnitedHealth Pressured as Rising Yields Hit Dividend Sectors', industry: 'Healthcare', date: '2026-05-16', impact: 'Medium', ticker: 'UNH', rec: 'WATCH', reason: 'Higher Treasury yields make dividend-heavy healthcare names less attractive near-term' },
  { id: 8, headline: 'Brent Crude Surges Past $111 on US-Iran Escalation Fears', industry: 'Energy', date: '2026-05-17', impact: 'High', ticker: 'XOM', rec: 'BUY', reason: 'Supply disruption risk supports elevated prices; Exxon benefits from upstream exposure' },
  { id: 9, headline: 'Trump Warns Iran to "Get Moving FAST" — Mideast Tensions Spike', industry: 'Energy', date: '2026-05-17', impact: 'High', ticker: 'CVX', rec: 'WATCH', reason: 'Geopolitical premium in oil could unwind quickly if diplomacy resumes' },
  { id: 10, headline: 'WTI Crude Hits $107 Amid Global Supply Disruption Fears', industry: 'Energy', date: '2026-05-16', impact: 'High', ticker: 'OXY', rec: 'WATCH', reason: 'Domestic producer benefits from high prices but exposed to policy reversal risk' },
  { id: 11, headline: 'FOMC Meeting Minutes Release — Fed Holds at 3.50-3.75%', industry: 'Finance', date: '2026-05-20', impact: 'High', ticker: 'SPY', rec: 'WATCH', reason: 'Markets parsing for dovish/hawkish signals from new Fed Chair Warsh' },
  { id: 12, headline: 'Treasury Yields Spike on Sticky Inflation Data', industry: 'Finance', date: '2026-05-15', impact: 'High', ticker: 'JPM', rec: 'HOLD', reason: 'Higher yields boost net interest income but dampen loan demand outlook' },
  { id: 13, headline: 'Home Depot Earnings — Consumer Spending Barometer', industry: 'Finance', date: '2026-05-19', impact: 'Medium', ticker: 'HD', rec: 'HOLD', reason: 'Housing market weakness offsets steady repair-and-remodel demand' },
  { id: 14, headline: 'Target Earnings Report — Retail Sentiment Check', industry: 'Finance', date: '2026-05-20', impact: 'Medium', ticker: 'TGT', rec: 'WATCH', reason: 'Discretionary spending under pressure from inflation; guidance key' },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };

const TODAY = '2026-05-18';
const DATES = ['2026-05-15', '2026-05-16', '2026-05-17', '2026-05-18', '2026-05-19', '2026-05-20', '2026-05-21', '2026-05-22', '2026-05-23'];
const DATE_LABELS = ['May 15', 'May 16', 'May 17', 'May 18', 'May 19', 'May 20', 'May 21', 'May 22', 'May 23'];

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() =>
    filterIndustry === 'All' ? EVENTS : EVENTS.filter(e => e.industry === filterIndustry),
    [filterIndustry]
  );

  const chartW = 800, chartH = 300, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xScale = (date) => {
    const idx = DATES.indexOf(date);
    return padL + (idx / (DATES.length - 1)) * plotW;
  };
  const yScale = (impact) => padT + plotH - ((IMPACT_Y[impact] - 0.5) / 3) * plotH;

  const todayX = xScale(TODAY);
  const pastEndX = xScale('2026-05-17');
  const futureStartX = xScale('2026-05-19');

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>May 18, 2026 — 14 events across 4 industries</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: '1.5rem', flexWrap: 'wrap' }}>
          {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
            <button key={ind} onClick={() => { setFilterIndustry(ind); setSelected(null); }}
              style={{ padding: '6px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                background: filterIndustry === ind ? (ind === 'All' ? '#334155' : INDUSTRY_COLORS[ind]) : '#1e293b',
                color: filterIndustry === ind ? '#fff' : '#94a3b8' }}>
              {ind}
            </button>
          ))}
        </div>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
          <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
            <rect x={padL} y={padT} width={pastEndX - padL + (xScale('2026-05-18') - pastEndX) / 2} height={plotH} fill="rgba(239,68,68,0.06)" />
            <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

            {DATES.map((d, i) => (
              <g key={d}>
                <line x1={xScale(d)} y1={padT} x2={xScale(d)} y2={padT + plotH} stroke="#1e293b" strokeWidth={1} />
                <text x={xScale(d)} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={11}>{DATE_LABELS[i]}</text>
              </g>
            ))}

            {[1, 2, 3].map(v => (
              <g key={v}>
                <line x1={padL} y1={yScale(['Low', 'Medium', 'High'][v - 1])} x2={padL + plotW} y2={yScale(['Low', 'Medium', 'High'][v - 1])} stroke="#1e293b" strokeWidth={1} />
                <text x={padL - 10} y={yScale(['Low', 'Medium', 'High'][v - 1]) + 4} textAnchor="end" fill="#64748b" fontSize={11}>
                  {['Low', 'Medium', 'High'][v - 1]}
                </text>
              </g>
            ))}

            <line x1={todayX} y1={padT - 10} x2={todayX} y2={padT + plotH + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
            <text x={todayX} y={padT - 14} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={700}>TODAY</text>

            {filtered.map((ev) => {
              const cx = xScale(ev.date);
              const cy = yScale(ev.impact);
              const jitter = ((ev.id * 17) % 20) - 10;
              return (
                <g key={ev.id} onClick={() => setSelected(selected?.id === ev.id ? null : ev)} style={{ cursor: 'pointer' }}>
                  <circle cx={cx + jitter} cy={cy} r={selected?.id === ev.id ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={selected && selected.id !== ev.id ? 0.3 : 0.9} stroke={selected?.id === ev.id ? '#fff' : 'none'} strokeWidth={2} />
                  <text x={cx + jitter} y={cy - 12} textAnchor="middle" fill={INDUSTRY_COLORS[ev.industry]} fontSize={9} fontWeight={600}>{ev.ticker}</text>
                </g>
              );
            })}
          </svg>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8 }}>
            {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                <span style={{ fontSize: 12, color: '#94a3b8' }}>{name}</span>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 600, marginBottom: 4 }}>{selected.headline}</h3>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>{selected.date} · {selected.industry} · Impact: {selected.impact}</p>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selected.ticker}</span>
                <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, color: '#fff', background: REC_COLORS[selected.rec] }}>{selected.rec}</span>
              </div>
            </div>
            <p style={{ marginTop: 10, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{selected.reason}</p>
          </div>
        )}

        <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => (
                <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{ev.date.slice(5)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700 }}>{ev.ticker}</td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.headline}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: INDUSTRY_COLORS[ev.industry], fontWeight: 600 }}>{ev.industry}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>{ev.impact}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, color: '#fff', background: REC_COLORS[ev.rec] }}>{ev.rec}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: '2rem' }}>
          Generated 2026-05-18 · Data sourced from CNBC, TheStreet, Yahoo Finance, Kiplinger, EconDay
        </p>
      </div>
    </div>
  );
}
