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
  { id: 1, headline: 'Nvidia unveils new PC processor, shares climb 2%+', ticker: 'NVDA', industry: 'Tech', date: '2026-06-01', impact: 'High', rec: 'BUY', reason: 'New product catalyst with strong PC market tailwinds and AI integration.' },
  { id: 2, headline: 'Intel drops 6% as Nvidia encroaches on PC chip market', ticker: 'INTC', industry: 'Tech', date: '2026-06-01', impact: 'High', rec: 'SELL', reason: 'Losing PC chip dominance to Nvidia; competitive moat eroding.' },
  { id: 3, headline: 'Dell rises on Nvidia chip partnership for new PCs', ticker: 'DELL', industry: 'Tech', date: '2026-06-01', impact: 'Medium', rec: 'HOLD', reason: 'Benefits from Nvidia partnership but upside already priced in.' },
  { id: 4, headline: 'HP gains 4% premarket on Nvidia PC chip adoption', ticker: 'HPQ', industry: 'Tech', date: '2026-06-01', impact: 'Medium', rec: 'WATCH', reason: 'Short-term pop may fade; wait for sustained demand signals.' },
  { id: 5, headline: 'CrowdStrike Q1 earnings report expected', ticker: 'CRWD', industry: 'Tech', date: '2026-06-03', impact: 'High', rec: 'BUY', reason: 'Cybersecurity spending up; consensus expects strong ARR growth.' },
  { id: 6, headline: 'Broadcom Q2 earnings report due', ticker: 'AVGO', industry: 'Tech', date: '2026-06-05', impact: 'High', rec: 'BUY', reason: 'AI networking demand and VMware integration driving revenue beat expectations.' },
  { id: 7, headline: 'ExxonMobil surges as WTI crude hits $90.55 on US-Iran tensions', ticker: 'XOM', industry: 'Energy', date: '2026-06-01', impact: 'High', rec: 'BUY', reason: 'Geopolitical premium on oil likely sustained; strong cash flow at $90+ crude.' },
  { id: 8, headline: 'Chevron benefits from Brent crude rally to $94/barrel', ticker: 'CVX', industry: 'Energy', date: '2026-06-01', impact: 'Medium', rec: 'HOLD', reason: 'Solid position but valuation already reflects higher oil prices.' },
  { id: 9, headline: 'Occidental Petroleum gains on geopolitical oil risk premium', ticker: 'OXY', industry: 'Energy', date: '2026-06-02', impact: 'Medium', rec: 'WATCH', reason: 'Buffett-backed but leveraged to volatile oil price swings.' },
  { id: 10, headline: 'JPMorgan positioning ahead of June FOMC meeting', ticker: 'JPM', industry: 'Finance', date: '2026-06-01', impact: 'Medium', rec: 'HOLD', reason: 'Rate path uncertainty; strong balance sheet provides downside protection.' },
  { id: 11, headline: 'Goldman Sachs revises H2 market outlook upward', ticker: 'GS', industry: 'Finance', date: '2026-06-02', impact: 'Medium', rec: 'WATCH', reason: 'Trading revenue strong but investment banking recovery still uncertain.' },
  { id: 12, headline: 'Eli Lilly weight-loss drug Mounjaro demand accelerates', ticker: 'LLY', industry: 'Healthcare', date: '2026-06-02', impact: 'High', rec: 'BUY', reason: 'GLP-1 market expanding rapidly; Lilly leading in supply scale-up.' },
  { id: 13, headline: 'UnitedHealth navigates policy headwinds, guidance reaffirmed', ticker: 'UNH', industry: 'Healthcare', date: '2026-06-03', impact: 'Medium', rec: 'HOLD', reason: 'Regulatory risk offset by diversified Optum revenue streams.' },
  { id: 14, headline: 'Pfizer pipeline update: oncology drug Phase 3 data expected', ticker: 'PFE', industry: 'Healthcare', date: '2026-06-04', impact: 'Medium', rec: 'WATCH', reason: 'Binary event risk; wait for data readout before committing.' },
  { id: 15, headline: 'Fed FOMC meeting preview — rate decision June 17', ticker: 'SPY', industry: 'Finance', date: '2026-06-06', impact: 'High', rec: 'WATCH', reason: 'Markets pricing in hold; any hawkish surprise could trigger volatility.' },
];

const TODAY = '2026-06-01';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDateLabel(d) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[d.getMonth()]} ${d.getDate()}`;
}

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const dates = useMemo(() => {
    const result = [];
    const start = parseDate('2026-05-29');
    for (let i = 0; i < 9; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, []);

  const todayDate = parseDate(TODAY);
  const startDate = dates[0];
  const endDate = dates[dates.length - 1];
  const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);

  const chartW = 800;
  const chartH = 300;
  const pad = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotW = chartW - pad.left - pad.right;
  const plotH = chartH - pad.top - pad.bottom;

  const xScale = (d) => pad.left + ((d - startDate) / (1000 * 60 * 60 * 24)) / totalDays * plotW;
  const yScale = (impact) => {
    const map = { High: 3, Medium: 2, Low: 1 };
    const val = map[impact] || 2;
    return pad.top + plotH - ((val - 0.5) / 3) * plotH;
  };

  const todayX = xScale(todayDate);

  const selectedEvent = EVENTS.find(e => e.id === selected);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>June 1, 2026 — Market Events & Outlook</p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([ind, color]) => (
          <span key={ind} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {ind}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '24px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={plotH} fill="rgba(239,68,68,0.06)" />
          <rect x={todayX} y={pad.top} width={pad.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

          <line x1={todayX} y1={pad.top} x2={todayX} y2={pad.top + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={pad.top - 8} fill="#ef4444" fontSize={11} textAnchor="middle">TODAY</text>

          {dates.map((d, i) => (
            <g key={i}>
              <line x1={xScale(d)} y1={pad.top} x2={xScale(d)} y2={pad.top + plotH} stroke="#1e293b" strokeWidth={1} />
              <text x={xScale(d)} y={chartH - 10} fill="#64748b" fontSize={11} textAnchor="middle">{formatDateLabel(d)}</text>
            </g>
          ))}

          {['High', 'Medium', 'Low'].map((label, i) => {
            const y = yScale(label);
            return (
              <g key={label}>
                <line x1={pad.left} y1={y} x2={pad.left + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={pad.left - 10} y={y + 4} fill="#64748b" fontSize={11} textAnchor="end">{label}</text>
              </g>
            );
          })}

          {EVENTS.map((ev) => {
            const cx = xScale(parseDate(ev.date));
            const cy = yScale(ev.impact);
            const isSelected = selected === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev.id)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx} y={cy - 12} fill="#94a3b8" fontSize={9} textAnchor="middle">{ev.ticker}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '24px', border: `1px solid ${INDUSTRY_COLORS[selectedEvent.industry]}44` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '4px 0 0' }}>{selectedEvent.ticker} · {selectedEvent.industry} · {selectedEvent.date}</p>
            </div>
            <span style={{
              background: REC_COLORS[selectedEvent.rec],
              color: selectedEvent.rec === 'HOLD' ? '#000' : '#fff',
              padding: '4px 14px',
              borderRadius: '999px',
              fontSize: '13px',
              fontWeight: 700,
            }}>
              {selectedEvent.rec}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0 }}>{selectedEvent.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Industry', 'Impact', 'Headline', 'Rec'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev.id)} style={{ borderBottom: '1px solid #1e293b11', cursor: 'pointer' }}>
                <td style={{ padding: '8px 10px' }}>{ev.date}</td>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span>
                </td>
                <td style={{ padding: '8px 10px' }}>{ev.impact}</td>
                <td style={{ padding: '8px 10px', maxWidth: '320px' }}>{ev.headline}</td>
                <td style={{ padding: '8px 10px' }}>
                  <span style={{
                    background: REC_COLORS[ev.rec],
                    color: ev.rec === 'HOLD' ? '#000' : '#fff',
                    padding: '2px 10px',
                    borderRadius: '999px',
                    fontSize: '11px',
                    fontWeight: 700,
                  }}>
                    {ev.rec}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: '11px', marginTop: '20px', textAlign: 'center' }}>
        Data sourced from CNBC, TheStreet, TipRanks, Trading Economics · Not financial advice
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
