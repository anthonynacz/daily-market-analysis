import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Oracle Announces Mass Layoffs in Thousands", industry: "Tech", date: "2026-03-29", impact: "Medium", ticker: "ORCL", recommendation: "HOLD", reason: "Restructuring may improve margins long-term but signals near-term revenue pressure." },
  { id: 2, headline: "Berkshire Hathaway Posts 8-Day Losing Streak", industry: "Finance", date: "2026-03-30", impact: "Medium", ticker: "BRK.B", recommendation: "BUY", reason: "Buffett signaled willingness to deploy $300B+ cash hoard on further market dips." },
  { id: 3, headline: "S&P 500 Surges 2.91% on Iran Peace Optimism", industry: "Finance", date: "2026-03-31", impact: "High", ticker: "SPY", recommendation: "BUY", reason: "Broad rally momentum as geopolitical risk premium fades; best day since May." },
  { id: 4, headline: "RH Plunges 18% on Weak Revenue Guidance", industry: "Finance", date: "2026-03-31", impact: "High", ticker: "RH", recommendation: "SELL", reason: "4-8% revenue growth guidance missed Street estimate of 8.8%, signaling demand softness." },
  { id: 5, headline: "Oil Prices Drop 2% on Iran Peace Talks", industry: "Energy", date: "2026-04-01", impact: "High", ticker: "XOM", recommendation: "SELL", reason: "Peace deal would collapse war premium; WTI falling from $100 toward $90s." },
  { id: 6, headline: "FOMC Meeting Concludes — Yields Fall to 4.28%", industry: "Finance", date: "2026-04-01", impact: "High", ticker: "JPM", recommendation: "BUY", reason: "Falling Treasury yields and dovish tone support bank valuations and lending margins." },
  { id: 7, headline: "ISM Manufacturing PMI Report (March)", industry: "Finance", date: "2026-04-01", impact: "Medium", ticker: "BAC", recommendation: "WATCH", reason: "Key leading indicator; expansion reading would confirm economic resilience." },
  { id: 8, headline: "Brent Crude Eases to $101 but Remains Elevated", industry: "Energy", date: "2026-04-01", impact: "Medium", ticker: "CVX", recommendation: "HOLD", reason: "Still elevated; wait for peace deal confirmation before repositioning." },
  { id: 9, headline: "Nike Fiscal Q3 2026 Earnings After Close", industry: "Tech", date: "2026-04-02", impact: "Medium", ticker: "NKE", recommendation: "HOLD", reason: "Consumer discretionary under pressure; watch for China recovery signals." },
  { id: 10, headline: "Nonfarm Payrolls & Unemployment Rate (March)", industry: "Finance", date: "2026-04-03", impact: "High", ticker: "GS", recommendation: "WATCH", reason: "Strong jobs data could delay expected Fed rate cuts and shift market sentiment." },
  { id: 11, headline: "Pfizer Oncology Pipeline Update Expected", industry: "Healthcare", date: "2026-04-03", impact: "Medium", ticker: "PFE", recommendation: "HOLD", reason: "Awaiting Phase 3 data on key oncology candidates to justify valuation." },
  { id: 12, headline: "Tesla Q1 Deliveries Data Release", industry: "Tech", date: "2026-04-04", impact: "High", ticker: "TSLA", recommendation: "WATCH", reason: "Deliveries crucial ahead of Apr 20 earnings; expect high volatility." },
  { id: 13, headline: "UnitedHealth Group Q1 Earnings Preview", industry: "Healthcare", date: "2026-04-05", impact: "Medium", ticker: "UNH", recommendation: "BUY", reason: "Strong managed care fundamentals and defensive positioning favor accumulation." },
  { id: 14, headline: "Schlumberger OPEC+ Output Review Outlook", industry: "Energy", date: "2026-04-06", impact: "Medium", ticker: "SLB", recommendation: "WATCH", reason: "OPEC+ production decisions will set near-term direction for oilfield services." },
];

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-04-01';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / (1000 * 60 * 60 * 24));
}

function formatDate(d) {
  const dt = parseDate(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');

  const filteredEvents = useMemo(() => {
    if (filter === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filter);
  }, [filter]);

  const chartW = 800, chartH = 300, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const startDate = '2026-03-29';
  const endDate = '2026-04-06';
  const totalDays = daysBetween(startDate, endDate);
  const todayX = padL + (daysBetween(startDate, TODAY) / totalDays) * plotW;

  function getX(date) {
    return padL + (daysBetween(startDate, date) / totalDays) * plotW;
  }
  function getY(impact) {
    return padT + plotH - ((IMPACT_Y[impact] - 0.5) / 3) * plotH;
  }

  const dates = [];
  for (let i = 0; i <= totalDays; i++) {
    const d = new Date(2026, 2, 29 + i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dates.push(ds);
  }

  return (
    <div style={{ background: '#0b0f1a', color: '#e2e8f0', minHeight: '100vh', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px' }}>April 1, 2026 &mdash; 14 Key Events Across Tech, Healthcare, Energy &amp; Finance</p>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
          <button key={ind} onClick={() => { setFilter(ind); setSelected(null); }}
            style={{
              padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
              background: filter === ind ? (INDUSTRY_COLORS[ind] || '#6366f1') : '#1e293b',
              color: filter === ind ? '#0b0f1a' : '#94a3b8', fontWeight: 600, fontSize: '13px'
            }}>
            {ind}
          </button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background */}
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {[1, 2, 3].map(v => (
            <g key={v}>
              <line x1={padL} y1={padT + plotH - ((v - 0.5) / 3) * plotH} x2={padL + plotW} y2={padT + plotH - ((v - 0.5) / 3) * plotH} stroke="#1e293b" strokeDasharray="4" />
              <text x={padL - 10} y={padT + plotH - ((v - 0.5) / 3) * plotH + 4} fill="#64748b" fontSize="12" textAnchor="end">
                {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
              </text>
            </g>
          ))}

          {/* Date labels */}
          {dates.map(d => (
            <text key={d} x={getX(d)} y={chartH - 10} fill="#64748b" fontSize="11" textAnchor="middle">
              {formatDate(d)}
            </text>
          ))}

          {/* TODAY line */}
          <line x1={todayX} y1={padT - 10} x2={todayX} y2={padT + plotH + 10} stroke="#ef4444" strokeDasharray="6,3" strokeWidth={2} />
          <text x={todayX} y={padT - 14} fill="#ef4444" fontSize="12" textAnchor="middle" fontWeight="700">TODAY</text>

          {/* Event dots */}
          {filteredEvents.map(ev => {
            const cx = getX(ev.date);
            const cy = getY(ev.impact);
            const isSelected = selected?.id === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx} y={cy - 12} fill="#94a3b8" fontSize="10" textAnchor="middle">{ev.ticker}</text>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '12px' }}>
          {Object.entries(INDUSTRY_COLORS).map(([ind, color]) => (
            <div key={ind} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>{ind}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', margin: '0 0 6px 0' }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', margin: '0 0 8px 0', fontSize: '14px' }}>
                {selected.ticker} &bull; {formatDate(selected.date)} &bull; {selected.industry} &bull; Impact: {selected.impact}
              </p>
            </div>
            <span style={{
              padding: '4px 14px', borderRadius: '20px', fontWeight: 700, fontSize: '13px',
              background: REC_COLORS[selected.recommendation], color: selected.recommendation === 'HOLD' ? '#0b0f1a' : '#fff'
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', margin: '8px 0 0 0', fontSize: '14px' }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
              <th style={{ padding: '8px', color: '#64748b' }}>Date</th>
              <th style={{ padding: '8px', color: '#64748b' }}>Headline</th>
              <th style={{ padding: '8px', color: '#64748b' }}>Ticker</th>
              <th style={{ padding: '8px', color: '#64748b' }}>Industry</th>
              <th style={{ padding: '8px', color: '#64748b' }}>Impact</th>
              <th style={{ padding: '8px', color: '#64748b' }}>Rec.</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev)}
                style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}>
                <td style={{ padding: '8px', whiteSpace: 'nowrap' }}>{formatDate(ev.date)}</td>
                <td style={{ padding: '8px' }}>{ev.headline}</td>
                <td style={{ padding: '8px', color: INDUSTRY_COLORS[ev.industry], fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry], marginRight: 6 }} />
                  {ev.industry}
                </td>
                <td style={{ padding: '8px' }}>{ev.impact}</td>
                <td style={{ padding: '8px' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: 700,
                    background: REC_COLORS[ev.recommendation], color: ev.recommendation === 'HOLD' ? '#0b0f1a' : '#fff'
                  }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '11px', marginTop: '20px' }}>
        Generated on April 1, 2026. For informational purposes only &mdash; not financial advice.
      </p>
    </div>
  );
}
