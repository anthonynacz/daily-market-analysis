import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Intel Q1 Earnings Beat — Stock Surges 23.6%", industry: "Tech", date: "2026-04-24", impact: "High", ticker: "INTC", recommendation: "BUY", reason: "Massive earnings beat with semiconductor momentum signals strong demand cycle." },
  { id: 2, headline: "Semiconductor Rally Extends to 18 Consecutive Sessions", industry: "Tech", date: "2026-04-25", impact: "High", ticker: "NVDA", recommendation: "BUY", reason: "AI chip demand shows no signs of slowing; sustained rally reflects structural tailwind." },
  { id: 3, headline: "Meta Announces 10% Workforce Reduction", industry: "Tech", date: "2026-04-25", impact: "High", ticker: "META", recommendation: "HOLD", reason: "Cost cuts boost margins but signal heavy AI spending pressure ahead." },
  { id: 4, headline: "Oil Volatility Pressures Dow Jones Lower", industry: "Energy", date: "2026-04-25", impact: "Medium", ticker: "CVX", recommendation: "HOLD", reason: "Strong cash flow but near-term headwinds from geopolitical price swings." },
  { id: 5, headline: "Iran/Hormuz Escalation Pushes Crude Oil Higher", industry: "Energy", date: "2026-04-27", impact: "High", ticker: "XOM", recommendation: "BUY", reason: "Geopolitical risk premium supports energy names with upstream exposure." },
  { id: 6, headline: "Spotify Q1 Earnings Report", industry: "Tech", date: "2026-04-28", impact: "Medium", ticker: "SPOT", recommendation: "WATCH", reason: "Subscriber growth trajectory is key after recent price hikes." },
  { id: 7, headline: "Centene Q1 Earnings Report", industry: "Healthcare", date: "2026-04-28", impact: "Medium", ticker: "CNC", recommendation: "WATCH", reason: "Managed care sector faces ongoing regulatory scrutiny; await guidance." },
  { id: 8, headline: "BP Q1 Earnings Report", industry: "Energy", date: "2026-04-28", impact: "Medium", ticker: "BP", recommendation: "HOLD", reason: "Transitioning energy portfolio sends mixed signals to investors." },
  { id: 9, headline: "S&P Global Q1 Earnings Report", industry: "Finance", date: "2026-04-28", impact: "Medium", ticker: "SPGI", recommendation: "HOLD", reason: "Consistent performer with stable revenue growth and strong moat." },
  { id: 10, headline: "Coca-Cola Q1 Earnings Report", industry: "Finance", date: "2026-04-28", impact: "Low", ticker: "KO", recommendation: "HOLD", reason: "Defensive staple with predictable results; unlikely to surprise." },
  { id: 11, headline: "FOMC Interest Rate Decision — Rates Expected Steady", industry: "Finance", date: "2026-04-29", impact: "High", ticker: "JPM", recommendation: "WATCH", reason: "Rates expected at 3.50-3.75%; Powell's forward guidance is the real catalyst." },
  { id: 12, headline: "Magnificent Seven Earnings Week Kicks Off", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "MSFT", recommendation: "WATCH", reason: "Elevated expectations create binary outcome risk; wait for results." },
  { id: 13, headline: "Core PCE Price Index Release for March", industry: "Healthcare", date: "2026-04-30", impact: "High", ticker: "UNH", recommendation: "WATCH", reason: "Key inflation measure will shape Fed outlook and healthcare cost projections." },
  { id: 14, headline: "Healthcare Sector Q1 Earnings Season Results", industry: "Healthcare", date: "2026-04-30", impact: "Medium", ticker: "JNJ", recommendation: "HOLD", reason: "Steady defensive play offering stability amid broader market volatility." },
];

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-04-27';

const DATES = [
  '2026-04-24', '2026-04-25', '2026-04-26', '2026-04-27',
  '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01', '2026-05-02',
];

function formatDate(d) {
  const parts = d.split('-');
  return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
}

function App() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800, chartH = 300;
  const padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const todayIdx = DATES.indexOf(TODAY);

  function xPos(date) {
    const idx = DATES.indexOf(date);
    if (idx === -1) return padL;
    return padL + (idx / (DATES.length - 1)) * plotW;
  }

  function yPos(impact) {
    const val = IMPACT_MAP[impact] || 2;
    return padT + plotH - ((val - 0.5) / 3) * plotH;
  }

  const todayX = xPos(TODAY);

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>April 27, 2026 — US Equities Overview</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
          <button key={ind} onClick={() => setFilterIndustry(ind)} style={{
            padding: '0.4rem 1rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
            background: filterIndustry === ind ? (INDUSTRY_COLORS[ind] || '#6366f1') : '#1e293b',
            color: filterIndustry === ind ? '#0b0f1a' : '#94a3b8',
          }}>{ind}</button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <svg width={chartW} height={chartH} viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: 'auto' }}>
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 8} fill="#ef4444" fontSize={11} textAnchor="middle" fontWeight={700}>TODAY</text>

          {[1, 2, 3].map(level => {
            const y = padT + plotH - ((level - 0.5) / 3) * plotH;
            return (
              <g key={level}>
                <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={padL - 10} y={y + 4} fill="#64748b" fontSize={11} textAnchor="end">
                  {level === 3 ? 'High' : level === 2 ? 'Med' : 'Low'}
                </text>
              </g>
            );
          })}

          {DATES.map((d, i) => (
            <text key={d} x={xPos(d)} y={padT + plotH + 25} fill="#64748b" fontSize={11} textAnchor="middle">{formatDate(d)}</text>
          ))}

          {filtered.map((ev, i) => {
            const cx = xPos(ev.date);
            const cy = yPos(ev.impact);
            const jitter = (i % 3 - 1) * 12;
            return (
              <g key={ev.id} onClick={() => setSelected(selected?.id === ev.id ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy + jitter} r={selected?.id === ev.id ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={0.9} stroke={selected?.id === ev.id ? '#fff' : 'none'} strokeWidth={2} />
                <title>{ev.ticker}: {ev.headline}</title>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', marginTop: '0.75rem' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', color: '#94a3b8' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{selected.date} · {selected.industry} · Impact: {selected.impact}</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ background: '#1e293b', padding: '0.3rem 0.75rem', borderRadius: '0.5rem', fontWeight: 700, fontSize: '0.95rem', color: INDUSTRY_COLORS[selected.industry] }}>{selected.ticker}</span>
              <span style={{ background: REC_COLORS[selected.recommendation], color: '#0b0f1a', padding: '0.3rem 0.75rem', borderRadius: '9999px', fontWeight: 700, fontSize: '0.8rem' }}>{selected.recommendation}</span>
            </div>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', lineHeight: 1.6, fontSize: '0.9rem' }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '1rem', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '0.65rem 1rem', color: '#94a3b8' }}>{formatDate(ev.date)}</td>
                <td style={{ padding: '0.65rem 1rem', fontWeight: 700, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '0.65rem 1rem' }}>{ev.headline}</td>
                <td style={{ padding: '0.65rem 1rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry], display: 'inline-block' }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '0.65rem 1rem', color: ev.impact === 'High' ? '#f87171' : ev.impact === 'Medium' ? '#fbbf24' : '#94a3b8' }}>{ev.impact}</td>
                <td style={{ padding: '0.65rem 1rem' }}>
                  <span style={{ background: REC_COLORS[ev.recommendation], color: '#0b0f1a', padding: '0.2rem 0.6rem', borderRadius: '9999px', fontWeight: 700, fontSize: '0.75rem' }}>{ev.recommendation}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '1.5rem' }}>Generated on 2026-04-27 · For informational purposes only · Not financial advice</p>
    </div>
  );
}

export default App;
