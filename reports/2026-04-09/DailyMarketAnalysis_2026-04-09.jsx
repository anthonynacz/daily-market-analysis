import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Nvidia Surges 10% on AI Spending Boom", industry: "Tech", date: "2026-04-08", impact: "High", ticker: "NVDA", recommendation: "BUY", reason: "AI capex cycle accelerating; Nvidia dominates GPU market with no near-term challenger." },
  { id: 2, headline: "Tesla Q1 Earnings Preview — Deliveries Beat Expected", industry: "Tech", date: "2026-04-20", impact: "High", ticker: "TSLA", recommendation: "WATCH", reason: "Strong deliveries but margin pressure from price cuts warrants caution until earnings confirm." },
  { id: 3, headline: "Meta Platforms Rallies on AI Assistant Monetization", industry: "Tech", date: "2026-04-08", impact: "Medium", ticker: "META", recommendation: "HOLD", reason: "AI revenue upside priced in; wait for Q1 report to confirm ad market strength." },
  { id: 4, headline: "AMD Gains 7% as Data Center GPU Demand Surges", industry: "Tech", date: "2026-04-08", impact: "Medium", ticker: "AMD", recommendation: "BUY", reason: "MI400 chip gaining enterprise traction; data center revenue growing faster than expected." },
  { id: 5, headline: "Microsoft Earnings Due Apr 28 — Azure Growth in Focus", industry: "Tech", date: "2026-04-28", impact: "High", ticker: "MSFT", recommendation: "HOLD", reason: "Azure AI workloads strong but valuation stretched; hold for post-earnings clarity." },
  { id: 6, headline: "US-Iran Ceasefire Sends S&P 500 Up 2.5%", industry: "Energy", date: "2026-04-08", impact: "High", ticker: "SPY", recommendation: "WATCH", reason: "Ceasefire fragile with both sides alleging breaches; market rally may be premature." },
  { id: 7, headline: "Crude Oil Drops Below $95 on Ceasefire Hopes", industry: "Energy", date: "2026-04-08", impact: "High", ticker: "CVX", recommendation: "BUY", reason: "Chevron well-positioned if oil stabilizes near $90; strong dividend yield provides downside protection." },
  { id: 8, headline: "ExxonMobil Navigates Geopolitical Volatility", industry: "Energy", date: "2026-04-09", impact: "Medium", ticker: "XOM", recommendation: "HOLD", reason: "Solid fundamentals but oil price direction unclear until ceasefire status confirmed." },
  { id: 9, headline: "Fed Rate Cut Odds Jump After Oil Pullback", industry: "Finance", date: "2026-04-09", impact: "High", ticker: "JPM", recommendation: "BUY", reason: "Lower energy costs could ease inflation, bringing rate cuts closer; JPM benefits from steepening yield curve." },
  { id: 10, headline: "Russell 2000 Enters Correction Territory", industry: "Finance", date: "2026-04-07", impact: "High", ticker: "IWM", recommendation: "WATCH", reason: "Small caps most exposed to war-driven cyclical downturn; wait for stabilization before entry." },
  { id: 11, headline: "Goldman Sachs Kicks Off Bank Earnings Season Apr 11", industry: "Finance", date: "2026-04-11", impact: "Medium", ticker: "GS", recommendation: "HOLD", reason: "Trading revenue likely strong from volatility but investment banking pipeline uncertain." },
  { id: 12, headline: "Alphabet Q1 Earnings Preview — Search + AI Gemini", industry: "Tech", date: "2026-04-22", impact: "High", ticker: "GOOGL", recommendation: "WATCH", reason: "Gemini AI integration into Search is a wildcard; wait for revenue breakdown before acting." },
  { id: 13, headline: "UnitedHealth Group Earnings Expected Mid-April", industry: "Healthcare", date: "2026-04-14", impact: "Medium", ticker: "UNH", recommendation: "HOLD", reason: "Defensive play in volatile market; steady managed care growth but regulatory risk lingers." },
  { id: 14, headline: "Pfizer Pipeline Update — RSV & Oncology Progress", industry: "Healthcare", date: "2026-04-09", impact: "Medium", ticker: "PFE", recommendation: "WATCH", reason: "Pipeline catalysts ahead but post-COVID revenue decline still pressuring near-term results." },
  { id: 15, headline: "Biotech ETF Rebounds as Risk Appetite Returns", industry: "Healthcare", date: "2026-04-10", impact: "Low", ticker: "XBI", recommendation: "BUY", reason: "Sector oversold after Q1 selloff; ceasefire-driven risk-on rotation favors high-beta biotech." },
];

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-04-09';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatShort(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const dateRange = useMemo(() => {
    const start = parseDate('2026-04-06');
    const end = parseDate('2026-04-14');
    const dates = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      dates.push(new Date(d));
    }
    return dates;
  }, []);

  const chartW = 800;
  const chartH = 300;
  const pad = { top: 40, right: 30, bottom: 50, left: 60 };
  const innerW = chartW - pad.left - pad.right;
  const innerH = chartH - pad.top - pad.bottom;

  const xScale = (dateStr) => {
    const start = parseDate('2026-04-06').getTime();
    const end = parseDate('2026-04-14').getTime();
    const t = parseDate(dateStr).getTime();
    return pad.left + ((t - start) / (end - start)) * innerW;
  };

  const yScale = (impact) => {
    return pad.top + innerH - ((IMPACT_Y[impact] - 0.5) / 3) * innerH;
  };

  const todayX = xScale(TODAY);
  const selectedEvent = EVENTS.find(e => e.id === selected);

  return (
    <div style={{ background: '#0b0f1a', color: '#e2e8f0', minHeight: '100vh', fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: '24px' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, marginBottom: '4px' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: '24px', fontSize: '14px' }}>April 9, 2026 — 15 Key Events Across Tech, Healthcare, Energy & Finance</p>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', overflowX: 'auto' }}>
        <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background */}
          <rect x={pad.left} y={pad.top} width={todayX - pad.left} height={innerH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={todayX} y={pad.top} width={pad.left + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {[1, 2, 3].map(v => (
            <g key={v}>
              <line x1={pad.left} y1={yScale(['Low','Medium','High'][v-1])} x2={pad.left + innerW} y2={yScale(['Low','Medium','High'][v-1])} stroke="#1e293b" strokeDasharray="4" />
              <text x={pad.left - 10} y={yScale(['Low','Medium','High'][v-1]) + 4} textAnchor="end" fill="#64748b" fontSize="12">{['Low','Medium','High'][v-1]}</text>
            </g>
          ))}

          {/* X axis date labels */}
          {dateRange.map(d => {
            const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const x = xScale(ds);
            return (
              <g key={ds}>
                <line x1={x} y1={pad.top} x2={x} y2={pad.top + innerH} stroke="#1e293b" strokeDasharray="2" />
                <text x={x} y={chartH - 10} textAnchor="middle" fill="#64748b" fontSize="11">{formatShort(d)}</text>
              </g>
            );
          })}

          {/* Today line */}
          <line x1={todayX} y1={pad.top - 10} x2={todayX} y2={pad.top + innerH + 10} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 3" />
          <text x={todayX} y={pad.top - 15} textAnchor="middle" fill="#ef4444" fontSize="11" fontWeight="bold">TODAY</text>

          {/* Event dots */}
          {EVENTS.map(ev => {
            const cx = xScale(ev.date);
            const cy = yScale(ev.impact);
            const isSelected = selected === ev.id;
            if (cx < pad.left || cx > pad.left + innerW) return null;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev.id)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <title>{ev.ticker}: {ev.headline}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail panel */}
      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', marginBottom: '20px', borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '6px 0' }}>{selectedEvent.ticker} &middot; {selectedEvent.industry} &middot; {selectedEvent.date} &middot; Impact: {selectedEvent.impact}</p>
            </div>
            <span style={{
              padding: '4px 14px', borderRadius: '999px', fontSize: '13px', fontWeight: 600, color: '#fff',
              background: REC_COLORS[selectedEvent.recommendation]
            }}>
              {selectedEvent.recommendation}
            </span>
          </div>
          <p style={{ marginTop: '10px', fontSize: '14px', lineHeight: 1.6 }}>{selectedEvent.reason}</p>
        </div>
      )}

      {/* Events table */}
      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '20px', overflowX: 'auto' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px' }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', textAlign: 'left' }}>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Date</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Ticker</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Headline</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Industry</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Impact</th>
              <th style={{ padding: '8px 12px', color: '#94a3b8' }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(ev => (
              <tr key={ev.id} onClick={() => setSelected(ev.id)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected === ev.id ? '#1e293b' : 'transparent' }}>
                <td style={{ padding: '8px 12px' }}>{ev.date}</td>
                <td style={{ padding: '8px 12px', fontWeight: 600, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                <td style={{ padding: '8px 12px' }}>{ev.headline}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry], display: 'inline-block' }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '8px 12px' }}>{ev.impact}</td>
                <td style={{ padding: '8px 12px' }}>
                  <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 600, color: '#fff', background: REC_COLORS[ev.recommendation] }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: '11px', marginTop: '20px', textAlign: 'center' }}>
        Generated on 2026-04-09. For informational purposes only — not financial advice.
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
