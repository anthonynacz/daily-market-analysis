import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Trump Signals Willingness to End Iran Campaign", industry: "Energy", date: "2026-03-31", impact: "High", ticker: "XLE", recommendation: "WATCH", reason: "De-escalation could ease oil premium but uncertainty remains high" },
  { id: 2, headline: "WTI Oil Surges Past $102/Barrel — Highest Since July", industry: "Energy", date: "2026-03-30", impact: "High", ticker: "XOM", recommendation: "HOLD", reason: "Geopolitical premium fully baked in; risk of sharp reversal on peace deal" },
  { id: 3, headline: "Energy Only Positive S&P Sector This Month", industry: "Energy", date: "2026-03-31", impact: "Medium", ticker: "CVX", recommendation: "BUY", reason: "Strong cash flows and dividends provide downside protection" },
  { id: 4, headline: "Micron Crashes 30% in 8 Sessions After Google AI Breakthrough", industry: "Tech", date: "2026-03-28", impact: "High", ticker: "MU", recommendation: "WATCH", reason: "Google breakthrough threatens memory demand outlook; wait for stabilization" },
  { id: 5, headline: "Nvidia Enters Bear Market — Down 21% From Highs", industry: "Tech", date: "2026-03-30", impact: "High", ticker: "NVDA", recommendation: "BUY", reason: "Long-term AI thesis intact; correction offers attractive entry point" },
  { id: 6, headline: "Morgan Stanley Cuts Meta Price Target to $775", industry: "Tech", date: "2026-03-30", impact: "Medium", ticker: "META", recommendation: "HOLD", reason: "Still a top pick at MS despite cut; wait for Q1 earnings clarity" },
  { id: 7, headline: "Alphabet Q1 Earnings Due April 22", industry: "Tech", date: "2026-04-22", impact: "High", ticker: "GOOGL", recommendation: "BUY", reason: "AI momentum and search dominance support upside surprise potential" },
  { id: 8, headline: "Fed Holds Rates at 3.5–3.75%, Cites Energy Uncertainty", industry: "Finance", date: "2026-03-30", impact: "High", ticker: "SPY", recommendation: "HOLD", reason: "Powell signals no near-term cuts; market in wait-and-see mode" },
  { id: 9, headline: "OECD Raises US Inflation Forecast to 4.2% From 2.8%", industry: "Finance", date: "2026-03-28", impact: "High", ticker: "TLT", recommendation: "SELL", reason: "Sharply higher inflation outlook puts bonds under sustained pressure" },
  { id: 10, headline: "Nonfarm Payrolls Report Due April 3", industry: "Finance", date: "2026-04-03", impact: "High", ticker: "SPY", recommendation: "WATCH", reason: "Key labor data will shape Fed rate expectations for Q2" },
  { id: 11, headline: "CPI Report Due April 14 — Inflation Fears in Focus", industry: "Finance", date: "2026-04-14", impact: "High", ticker: "TLT", recommendation: "WATCH", reason: "Will confirm or deny OECD's dire 4.2% inflation forecast" },
  { id: 12, headline: "UnitedHealth Under Pressure From Rising Healthcare Costs", industry: "Healthcare", date: "2026-04-01", impact: "Medium", ticker: "UNH", recommendation: "HOLD", reason: "Inflation squeezing margins but dominant market position provides buffer" },
  { id: 13, headline: "Biotech Sector Whipsawed by Rate Uncertainty", industry: "Healthcare", date: "2026-03-31", impact: "Medium", ticker: "XBI", recommendation: "WATCH", reason: "Growth names vulnerable to higher-for-longer rates; be selective" },
  { id: 14, headline: "Nike Q3 Earnings Due April 2 — Turnaround Watch", industry: "Finance", date: "2026-04-02", impact: "Medium", ticker: "NKE", recommendation: "WATCH", reason: "Analysts expect EPS of $0.29; guidance on consumer demand is key" },
];

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

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };

const TODAY = '2026-03-31';

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

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const dates = useMemo(() => {
    const result = [];
    const start = parseDate('2026-03-28');
    for (let i = 0; i <= 8; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      result.push(`${y}-${m}-${day}`);
    }
    return result;
  }, []);

  const chartW = 800, chartH = 300, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xScale = (date) => {
    const idx = daysBetween(dates[0], date);
    return padL + (idx / (dates.length - 1)) * plotW;
  };

  const yScale = (impact) => {
    return padT + plotH - ((IMPACT_Y[impact] - 0.5) / 3) * plotH;
  };

  const todayX = xScale(TODAY);
  const pastEnd = todayX;

  const selectedEvent = EVENTS.find(e => e.id === selected);

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', system-ui, sans-serif", padding: '2rem' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem' }}>March 31, 2026 — Q1 Final Trading Day</p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            <span style={{ fontSize: '0.85rem', color: '#94a3b8' }}>{name}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.5rem', marginBottom: '1.5rem' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', maxWidth: '100%' }}>
          {/* Past background */}
          <rect x={padL} y={padT} width={pastEnd - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={pastEnd} y={padT} width={padL + plotW - pastEnd} height={plotH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {[1, 2, 3].map(v => (
            <g key={v}>
              <line x1={padL} y1={yScale(Object.keys(IMPACT_Y).find(k => IMPACT_Y[k] === v))} x2={padL + plotW} y2={yScale(Object.keys(IMPACT_Y).find(k => IMPACT_Y[k] === v))} stroke="#1e293b" strokeWidth={1} />
              <text x={padL - 10} y={yScale(Object.keys(IMPACT_Y).find(k => IMPACT_Y[k] === v)) + 4} textAnchor="end" fill="#64748b" fontSize={12}>
                {Object.keys(IMPACT_Y).find(k => IMPACT_Y[k] === v)}
              </text>
            </g>
          ))}

          {/* X axis labels */}
          {dates.map(d => (
            <text key={d} x={xScale(d)} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize={11}>
              {formatDate(d)}
            </text>
          ))}

          {/* Today line */}
          <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={padT - 8} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

          {/* Event dots */}
          {EVENTS.map((ev, i) => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact);
            // Offset overlapping dots
            const sameSpot = EVENTS.filter((e, j) => j < i && e.date === ev.date && e.impact === ev.impact);
            const offsetX = sameSpot.length * 18;
            return (
              <g key={ev.id} onClick={() => setSelected(selected === ev.id ? null : ev.id)} style={{ cursor: 'pointer' }}>
                <circle cx={cx + offsetX} cy={cy} r={selected === ev.id ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={selected === ev.id ? 1 : 0.85} stroke={selected === ev.id ? '#fff' : 'none'} strokeWidth={2} />
                <text x={cx + offsetX} y={cy - 12} textAnchor="middle" fill="#94a3b8" fontSize={9}>{ev.ticker}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail Panel */}
      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: '1.25rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', margin: '0.25rem 0' }}>
                {selectedEvent.ticker} &middot; {selectedEvent.industry} &middot; {formatDate(selectedEvent.date)} &middot; Impact: {selectedEvent.impact}
              </p>
            </div>
            <span style={{
              padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.8rem', fontWeight: 700,
              background: REC_COLORS[selectedEvent.recommendation] + '22',
              color: REC_COLORS[selectedEvent.recommendation],
              border: `1px solid ${REC_COLORS[selectedEvent.recommendation]}44`
            }}>
              {selectedEvent.recommendation}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', fontSize: '0.9rem', marginTop: '0.5rem' }}>{selectedEvent.reason}</p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ background: '#1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                <th key={h} style={{ padding: '0.75rem 1rem', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b', background: selected === ev.id ? '#1e293b' : 'transparent' }}>
                <td style={{ padding: '0.6rem 1rem', whiteSpace: 'nowrap' }}>{formatDate(ev.date)}</td>
                <td style={{ padding: '0.6rem 1rem', fontWeight: 600, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '0.6rem 1rem' }}>{ev.headline}</td>
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry], display: 'inline-block' }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '0.6rem 1rem' }}>{ev.impact}</td>
                <td style={{ padding: '0.6rem 1rem' }}>
                  <span style={{
                    padding: '0.15rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 700,
                    background: REC_COLORS[ev.recommendation] + '22',
                    color: REC_COLORS[ev.recommendation],
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
        Generated 2026-03-31 &middot; For informational purposes only &middot; Not financial advice
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
