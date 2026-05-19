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
  { id: 1, headline: 'NVIDIA Earnings Report — AI Demand in Focus', industry: 'Tech', date: '2026-05-20', impact: 'High', ticker: 'NVDA', rec: 'BUY', reason: 'AI spending remains robust despite macro headwinds; data-center revenue expected to beat.' },
  { id: 2, headline: 'Broad Tech Selloff as Yields Surge', industry: 'Tech', date: '2026-05-18', impact: 'High', ticker: 'QQQ', rec: 'HOLD', reason: 'S&P Tech sector fell ~2% but long-term fundamentals intact; avoid panic selling.' },
  { id: 3, headline: 'LiveRamp Acquired by Publicis for $2.5B', industry: 'Tech', date: '2026-05-18', impact: 'Medium', ticker: 'RAMP', rec: 'HOLD', reason: 'Stock surged 27% on deal news; acquisition premium already fully priced in.' },
  { id: 4, headline: 'Keysight Technologies Earnings', industry: 'Tech', date: '2026-05-19', impact: 'Medium', ticker: 'KEYS', rec: 'WATCH', reason: 'Test equipment demand signals semiconductor cycle health; guidance is key.' },
  { id: 5, headline: 'Regeneron Drops 11.4% on Pipeline Setback', industry: 'Healthcare', date: '2026-05-18', impact: 'High', ticker: 'REGN', rec: 'WATCH', reason: 'Sharp decline may present buying opportunity if selloff proves overdone.' },
  { id: 6, headline: 'Biotech Sector Pressured by Rising Rates', industry: 'Healthcare', date: '2026-05-19', impact: 'Medium', ticker: 'XBI', rec: 'HOLD', reason: 'Higher rates weigh on growth-stage biotechs; stay selective in the space.' },
  { id: 7, headline: 'Healthcare Costs in Focus Ahead of FOMC', industry: 'Healthcare', date: '2026-05-20', impact: 'Medium', ticker: 'UNH', rec: 'HOLD', reason: 'Insurance sector navigating inflation headwinds; stable but limited upside near-term.' },
  { id: 8, headline: 'Iran Conflict Drives Oil to 12-Month High', industry: 'Energy', date: '2026-05-18', impact: 'High', ticker: 'XOM', rec: 'BUY', reason: 'Geopolitical premium supports energy majors; ExxonMobil well-positioned.' },
  { id: 9, headline: 'Chevron Benefits from Sustained High Crude', industry: 'Energy', date: '2026-05-19', impact: 'High', ticker: 'CVX', rec: 'BUY', reason: 'Strong free cash flow at current crude levels; dividend yield attractive.' },
  { id: 10, headline: 'Deere Earnings — Fuel Cost Impact on Ag', industry: 'Energy', date: '2026-05-21', impact: 'Medium', ticker: 'DE', rec: 'WATCH', reason: 'Agricultural equipment demand vs. input cost squeeze makes outlook uncertain.' },
  { id: 11, headline: '10Y Treasury Yield Surges Past 4.60%', industry: 'Finance', date: '2026-05-18', impact: 'High', ticker: 'TLT', rec: 'SELL', reason: 'Highest yield in a year pressures bond portfolios and rate-sensitive sectors.' },
  { id: 12, headline: 'FOMC Meeting Minutes — Historic Dissents', industry: 'Finance', date: '2026-05-20', impact: 'High', ticker: 'SPY', rec: 'WATCH', reason: 'April minutes may reveal depth of disagreement on rate path under new Fed Chair Warsh.' },
  { id: 13, headline: 'Home Depot Earnings Gauge Consumer Health', industry: 'Finance', date: '2026-05-19', impact: 'High', ticker: 'HD', rec: 'WATCH', reason: 'Housing-related spending under pressure from rates; guidance will set sentiment.' },
  { id: 14, headline: 'Walmart Earnings — Defensive Strength', industry: 'Finance', date: '2026-05-21', impact: 'High', ticker: 'WMT', rec: 'BUY', reason: 'Consumer staple leader thriving in uncertain macro; trade-down effect benefits WMT.' },
];

const DATES = ['2026-05-16','2026-05-17','2026-05-18','2026-05-19','2026-05-20','2026-05-21','2026-05-22','2026-05-23','2026-05-24'];
const DATE_LABELS = ['May 16','May 17','May 18','May 19','May 20','May 21','May 22','May 23','May 24'];
const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };
const TODAY = '2026-05-19';

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartW = 780, chartH = 340, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const todayIdx = DATES.indexOf(TODAY);

  const xScale = (d) => padL + (DATES.indexOf(d) / (DATES.length - 1)) * plotW;
  const yScale = (v) => padT + plotH - ((v - 0.5) / 3) * plotH;

  const jitteredEvents = useMemo(() => {
    const seen = {};
    return EVENTS.map((e) => {
      const key = `${e.date}-${e.impact}`;
      seen[key] = (seen[key] || 0) + 1;
      const count = seen[key];
      const offsetX = ((count - 1) % 3 - 1) * 14;
      const offsetY = Math.floor((count - 1) / 3) * 14;
      return { ...e, ox: offsetX, oy: offsetY };
    });
  }, []);

  const todayX = xScale(TODAY);
  const selectedEvent = selected ? jitteredEvents.find((e) => e.id === selected) : null;

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>May 19, 2026 — Market Events & Outlook</p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([ind, col]) => (
          <span key={ind} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: col, display: 'inline-block' }} />
            {ind}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {[1, 2, 3].map((v) => (
            <g key={v}>
              <line x1={padL} y1={yScale(v)} x2={padL + plotW} y2={yScale(v)} stroke="#1e293b" strokeWidth={1} />
              <text x={padL - 10} y={yScale(v) + 4} textAnchor="end" fill="#64748b" fontSize={12}>
                {v === 3 ? 'High' : v === 2 ? 'Med' : 'Low'}
              </text>
            </g>
          ))}

          {DATES.map((d, i) => (
            <text key={d} x={xScale(d)} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={11}>
              {DATE_LABELS[i]}
            </text>
          ))}

          <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {jitteredEvents.map((e) => {
            const cx = xScale(e.date) + e.ox;
            const cy = yScale(IMPACT_MAP[e.impact]) + e.oy;
            const isSelected = selected === e.id;
            return (
              <g key={e.id} onClick={() => setSelected(isSelected ? null : e.id)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[e.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx} y={cy + 4} textAnchor="middle" fill="#0b0f1a" fontSize={9} fontWeight={700} style={{ pointerEvents: 'none' }}>
                  {e.ticker.slice(0, 3)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0' }}>
                {selectedEvent.ticker} &middot; {selectedEvent.industry} &middot; {selectedEvent.date} &middot; Impact: {selectedEvent.impact}
              </p>
            </div>
            <span style={{
              padding: '4px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600,
              background: REC_COLORS[selectedEvent.rec] + '22', color: REC_COLORS[selectedEvent.rec],
            }}>
              {selectedEvent.rec}
            </span>
          </div>
          <p style={{ marginTop: '10px', fontSize: '14px', lineHeight: 1.6, color: '#cbd5e1' }}>{selectedEvent.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '12px' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Date</th>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Ticker</th>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Headline</th>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Industry</th>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Impact</th>
              <th style={{ padding: '8px 12px', color: '#64748b', fontWeight: 500 }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e) => (
              <tr key={e.id} onClick={() => setSelected(e.id)} style={{ borderBottom: '1px solid #1e293b22', cursor: 'pointer' }}>
                <td style={{ padding: '8px 12px' }}>{e.date}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: INDUSTRY_COLORS[e.industry] }}>{e.ticker}</td>
                <td style={{ padding: '8px 12px' }}>{e.headline}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[e.industry], display: 'inline-block' }} />
                    {e.industry}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>{e.impact}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600,
                    background: REC_COLORS[e.rec] + '22', color: REC_COLORS[e.rec],
                  }}>
                    {e.rec}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '12px', marginTop: '24px' }}>
        Generated on 2026-05-19. For informational purposes only — not financial advice.
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
