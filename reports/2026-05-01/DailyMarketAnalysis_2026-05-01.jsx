import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const RECOMMENDATIONS = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#eab308',
  WATCH: '#3b82f6',
};

const EVENTS = [
  { id: 1, headline: 'Microsoft Azure AI Revenue Surges 42% YoY', ticker: 'MSFT', industry: 'Tech', date: '2026-04-28', impact: 'High', recommendation: 'BUY', reason: 'Cloud AI services driving accelerating growth across enterprise segment.' },
  { id: 2, headline: 'AMD Data Center GPU Shipments Hit Record High', ticker: 'AMD', industry: 'Tech', date: '2026-04-29', impact: 'High', recommendation: 'BUY', reason: 'AI chip demand continues to outpace supply; strong forward guidance.' },
  { id: 3, headline: 'Oil Prices Spike on Iran Naval Blockade Fears', ticker: 'USO', industry: 'Energy', date: '2026-04-29', impact: 'High', recommendation: 'WATCH', reason: 'Geopolitical tensions creating supply uncertainty and price volatility.' },
  { id: 4, headline: 'Apple Q1 Earnings Beat: $2.01 EPS vs $1.95 Expected', ticker: 'AAPL', industry: 'Tech', date: '2026-04-30', impact: 'High', recommendation: 'BUY', reason: 'Revenue of $111.18B beats estimates; iPhone and Services segments strong.' },
  { id: 5, headline: 'S&P 500 Closes Above 7,200 for First Time Ever', ticker: 'SPY', industry: 'Finance', date: '2026-04-30', impact: 'High', recommendation: 'BUY', reason: 'Broad market strength and strongest monthly gain since 2020 signal bull continuation.' },
  { id: 6, headline: 'Exxon Mobil Beats Q1 Estimates Despite Iran Disruptions', ticker: 'XOM', industry: 'Energy', date: '2026-05-01', impact: 'High', recommendation: 'HOLD', reason: 'Solid earnings but geopolitical risks and supply delays add near-term uncertainty.' },
  { id: 7, headline: 'Chevron Q1 Revenue Tops Expectations, Shares Gain 1%', ticker: 'CVX', industry: 'Energy', date: '2026-05-01', impact: 'Medium', recommendation: 'HOLD', reason: 'Steady performance but limited upside catalyst amid volatile oil markets.' },
  { id: 8, headline: 'Trump Vows to Maintain Iran Naval Blockade', ticker: 'CL', industry: 'Energy', date: '2026-05-01', impact: 'High', recommendation: 'WATCH', reason: 'Continued blockade could further disrupt global oil supply chains.' },
  { id: 9, headline: 'Eli Lilly GLP-1 Drug Sales Surge 67% in Q1', ticker: 'LLY', industry: 'Healthcare', date: '2026-05-01', impact: 'High', recommendation: 'BUY', reason: 'Obesity and diabetes drug market expanding rapidly with strong demand.' },
  { id: 10, headline: 'US Non-Farm Payrolls Report Due Friday', ticker: 'SPY', industry: 'Finance', date: '2026-05-02', impact: 'High', recommendation: 'WATCH', reason: 'Labor market data critical for Fed rate-cut timing decisions.' },
  { id: 11, headline: 'Pfizer Expects FDA Decision on New RSV Treatment', ticker: 'PFE', industry: 'Healthcare', date: '2026-05-02', impact: 'Medium', recommendation: 'WATCH', reason: 'Approval could open significant new revenue stream but outcome uncertain.' },
  { id: 12, headline: 'Moderna mRNA Cancer Vaccine Phase 3 Data Readout', ticker: 'MRNA', industry: 'Healthcare', date: '2026-05-04', impact: 'Medium', recommendation: 'WATCH', reason: 'Positive results would be transformative but binary risk event.' },
  { id: 13, headline: 'Palantir Wins $1.2B Pentagon AI Contract', ticker: 'PLTR', industry: 'Tech', date: '2026-05-05', impact: 'Medium', recommendation: 'BUY', reason: 'Government AI spending accelerating; strong pipeline of defense deals.' },
  { id: 14, headline: 'FOMC Meeting Minutes Release Expected', ticker: 'TLT', industry: 'Finance', date: '2026-05-06', impact: 'High', recommendation: 'WATCH', reason: 'Markets seeking clarity on rate-cut timeline and inflation outlook.' },
];

const TODAY = '2026-05-01';

const DATES = [
  '2026-04-28', '2026-04-29', '2026-04-30', '2026-05-01',
  '2026-05-02', '2026-05-03', '2026-05-04', '2026-05-05', '2026-05-06',
];

const IMPACT_MAP = { Low: 1, Medium: 2, High: 3 };

const DATE_LABELS = ['Apr 28', 'Apr 29', 'Apr 30', 'May 1', 'May 2', 'May 3', 'May 4', 'May 5', 'May 6'];

export default function DailyMarketAnalysis() {
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filteredEvents = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const todayIndex = DATES.indexOf(TODAY);

  const getX = (date) => {
    const idx = DATES.indexOf(date);
    return padding.left + (idx / (DATES.length - 1)) * plotW;
  };

  const getY = (impact) => {
    const val = IMPACT_MAP[impact];
    return padding.top + plotH - ((val - 0.5) / 3) * plotH;
  };

  const todayX = getX(TODAY);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>{TODAY} &mdash; 14 events across Tech, Healthcare, Energy, Finance</p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {['All', ...Object.keys(INDUSTRY_COLORS)].map(ind => (
          <button key={ind} onClick={() => { setFilterIndustry(ind); setSelectedEvent(null); }}
            style={{ padding: '0.4rem 1rem', borderRadius: '9999px', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
              background: filterIndustry === ind ? (ind === 'All' ? '#334155' : INDUSTRY_COLORS[ind]) : '#1e293b',
              color: filterIndustry === ind ? '#fff' : '#94a3b8' }}>
            {ind}
          </button>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', overflowX: 'auto' }}>
        <svg width={chartWidth} height={chartHeight} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={padding.left} y={padding.top} width={todayX - padding.left} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={padding.top} width={padding.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          {DATES.map((d, i) => (
            <g key={d}>
              <line x1={getX(d)} y1={padding.top} x2={getX(d)} y2={padding.top + plotH} stroke="#1e293b" strokeWidth={1} />
              <text x={getX(d)} y={chartHeight - 10} textAnchor="middle" fill="#64748b" fontSize={11}>{DATE_LABELS[i]}</text>
            </g>
          ))}

          {['High', 'Medium', 'Low'].map(level => (
            <g key={level}>
              <line x1={padding.left} y1={getY(level)} x2={padding.left + plotW} y2={getY(level)} stroke="#1e293b" strokeWidth={1} />
              <text x={padding.left - 10} y={getY(level) + 4} textAnchor="end" fill="#64748b" fontSize={11}>{level}</text>
            </g>
          ))}

          <line x1={todayX} y1={padding.top - 10} x2={todayX} y2={padding.top + plotH + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padding.top - 15} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={700}>TODAY</text>

          {filteredEvents.map(event => {
            const cx = getX(event.date);
            const cy = getY(event.impact);
            const jitter = (event.id % 5 - 2) * 8;
            return (
              <g key={event.id} onClick={() => setSelectedEvent(selectedEvent?.id === event.id ? null : event)} style={{ cursor: 'pointer' }}>
                <circle cx={cx + jitter} cy={cy} r={8} fill={INDUSTRY_COLORS[event.industry]} opacity={0.85} stroke={selectedEvent?.id === event.id ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx + jitter} y={cy - 12} textAnchor="middle" fill="#94a3b8" fontSize={9}>{event.ticker}</text>
              </g>
            );
          })}
        </svg>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '1.5rem', marginTop: '1rem' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.3rem' }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>{selectedEvent.ticker} &bull; {selectedEvent.industry} &bull; {selectedEvent.date} &bull; Impact: {selectedEvent.impact}</p>
            </div>
            <span style={{ padding: '0.3rem 0.9rem', borderRadius: '9999px', fontSize: '0.8rem', fontWeight: 700, color: '#fff', background: RECOMMENDATIONS[selectedEvent.recommendation] }}>
              {selectedEvent.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '0.75rem', color: '#cbd5e1', fontSize: '0.9rem', lineHeight: 1.6 }}>{selectedEvent.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '1rem', padding: '1.5rem', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '1.15rem', fontWeight: 600, marginBottom: '1rem' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Headline', 'Ticker', 'Industry', 'Impact', 'Rec.'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '0.6rem 0.75rem', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map(event => (
              <tr key={event.id} onClick={() => setSelectedEvent(event)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.background = '#1e293b'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{event.date}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>{event.headline}</td>
                <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600, color: INDUSTRY_COLORS[event.industry] }}>{event.ticker}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[event.industry], display: 'inline-block' }} />
                    {event.industry}
                  </span>
                </td>
                <td style={{ padding: '0.6rem 0.75rem' }}>{event.impact}</td>
                <td style={{ padding: '0.6rem 0.75rem' }}>
                  <span style={{ padding: '0.2rem 0.6rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: 700, color: '#fff', background: RECOMMENDATIONS[event.recommendation] }}>
                    {event.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: '0.75rem', marginTop: '2rem' }}>
        Generated {TODAY} &mdash; For informational purposes only. Not financial advice.
      </p>
    </div>
  );
}
