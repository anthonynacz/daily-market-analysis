import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "AMD Q1 Earnings Beat — Stock Surges 18%", industry: "Tech", date: "2026-05-05", impact: "High", ticker: "AMD", recommendation: "BUY", reason: "Strong Q1 results with AI chip demand accelerating" },
  { id: 2, headline: "Super Micro Computer Tops Profit Estimates", industry: "Tech", date: "2026-05-05", impact: "High", ticker: "SMCI", recommendation: "HOLD", reason: "Profit beat offset by revenue miss — wait for clarity" },
  { id: 3, headline: "Micron HBM Memory Sold Out Through 2026", industry: "Tech", date: "2026-05-04", impact: "Medium", ticker: "MU", recommendation: "BUY", reason: "AI-driven HBM demand ensures strong revenue visibility" },
  { id: 4, headline: "Apple Reportedly Exploring Intel Chips for US Devices", industry: "Tech", date: "2026-05-06", impact: "Medium", ticker: "INTC", recommendation: "WATCH", reason: "Early-stage exploration — upside if confirmed but speculative" },
  { id: 5, headline: "Nasdaq Composite Hits Record Close at 25,326", industry: "Tech", date: "2026-05-05", impact: "High", ticker: "QQQ", recommendation: "HOLD", reason: "Extended after banner rally — wait for pullback to add" },
  { id: 6, headline: "US-Iran Deal Hopes Crash Oil Prices (-10.5%)", industry: "Energy", date: "2026-05-05", impact: "High", ticker: "XOM", recommendation: "SELL", reason: "Ceasefire deal would structurally reduce oil premiums" },
  { id: 7, headline: "Oil Rebounds to $110 on Escalation Fears", industry: "Energy", date: "2026-05-06", impact: "High", ticker: "CVX", recommendation: "WATCH", reason: "Extreme volatility — direction depends on diplomacy outcome" },
  { id: 8, headline: "Industrial Production & Capacity Data Due", industry: "Energy", date: "2026-05-09", impact: "Medium", ticker: "HAL", recommendation: "WATCH", reason: "Manufacturing gauge will signal energy capex trends" },
  { id: 9, headline: "S&P 500 All-Time High at 7,259", industry: "Finance", date: "2026-05-05", impact: "High", ticker: "SPY", recommendation: "BUY", reason: "Broad market strength with breadth confirmation" },
  { id: 10, headline: "Russell 2000 Leads Small-Cap Rally (+1.4%)", industry: "Finance", date: "2026-05-05", impact: "Medium", ticker: "IWM", recommendation: "BUY", reason: "Small-cap leadership signals healthy risk appetite rotation" },
  { id: 11, headline: "Consumer Credit Report Release", industry: "Finance", date: "2026-05-07", impact: "Medium", ticker: "JPM", recommendation: "WATCH", reason: "Key indicator for consumer lending health and bank exposure" },
  { id: 12, headline: "Gold & Silver Climb on Safe Haven Demand", industry: "Finance", date: "2026-05-06", impact: "Medium", ticker: "GLD", recommendation: "BUY", reason: "Geopolitical hedging demand persists amid uncertainty" },
  { id: 13, headline: "126 S&P 500 Companies Report Earnings This Week", industry: "Healthcare", date: "2026-05-07", impact: "Medium", ticker: "UNH", recommendation: "WATCH", reason: "Heavy healthcare earnings slate — wait for results" },
  { id: 14, headline: "Biotech Sector Rallies on Rate Cut Expectations", industry: "Healthcare", date: "2026-05-08", impact: "Medium", ticker: "XBI", recommendation: "BUY", reason: "Lower rates improve biotech funding environment" },
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

const TODAY = '2026-05-06';

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const dateRange = useMemo(() => {
    const dates = [];
    const start = new Date('2026-05-03');
    for (let i = 0; i <= 8; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  }, []);

  const chartWidth = 800;
  const chartHeight = 300;
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const impactToY = (impact) => {
    const map = { High: 3, Medium: 2, Low: 1 };
    const val = map[impact] || 1;
    return padding.top + plotHeight - ((val - 0.5) / 3) * plotHeight;
  };

  const dateToX = (date) => {
    const idx = dateRange.indexOf(date);
    if (idx === -1) return padding.left;
    return padding.left + (idx / (dateRange.length - 1)) * plotWidth;
  };

  const todayX = dateToX(TODAY);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', padding: '2rem', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Daily Market Analysis — {TODAY}</h1>
      <p style={{ color: '#94a3b8', marginBottom: '1.5rem', fontSize: '0.875rem' }}>Click any dot for details. Dashed red line = today.</p>

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <svg width={chartWidth} height={chartHeight} style={{ width: '100%', height: 'auto' }} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <rect x={padding.left} y={padding.top} width={todayX - padding.left} height={plotHeight} fill="rgba(239,68,68,0.05)" />
          <rect x={todayX} y={padding.top} width={padding.left + plotWidth - todayX} height={plotHeight} fill="rgba(34,197,94,0.05)" />
          <line x1={todayX} y1={padding.top} x2={todayX} y2={padding.top + plotHeight} stroke="#ef4444" strokeWidth="2" strokeDasharray="6,4" />
          <text x={todayX} y={padding.top - 8} fill="#ef4444" fontSize="11" textAnchor="middle">TODAY</text>

          {[1, 2, 3].map(level => (
            <g key={level}>
              <line x1={padding.left} y1={impactToY(['Low','Medium','High'][level-1])} x2={padding.left + plotWidth} y2={impactToY(['Low','Medium','High'][level-1])} stroke="#1e293b" strokeWidth="1" />
              <text x={padding.left - 10} y={impactToY(['Low','Medium','High'][level-1]) + 4} fill="#64748b" fontSize="11" textAnchor="end">{['Low','Medium','High'][level-1]}</text>
            </g>
          ))}

          {dateRange.map((d, i) => (
            <text key={d} x={dateToX(d)} y={padding.top + plotHeight + 20} fill="#64748b" fontSize="10" textAnchor="middle">{d.slice(5)}</text>
          ))}

          {EVENTS.map(ev => {
            const cx = dateToX(ev.date);
            const cy = impactToY(ev.impact);
            const jitter = (ev.id % 5 - 2) * 8;
            return (
              <circle
                key={ev.id}
                cx={cx + jitter}
                cy={cy}
                r={selected?.id === ev.id ? 10 : 7}
                fill={INDUSTRY_COLORS[ev.industry]}
                opacity={selected && selected.id !== ev.id ? 0.4 : 0.9}
                style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setSelected(ev)}
              />
            );
          })}
        </svg>

        <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', justifyContent: 'center' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.75rem' }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {name}
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.25rem', marginBottom: '1.5rem', borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{selected.headline}</h3>
              <p style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontSize: '0.85rem' }}><strong>Ticker:</strong> {selected.ticker} &nbsp;|&nbsp; <strong>Date:</strong> {selected.date} &nbsp;|&nbsp; <strong>Impact:</strong> {selected.impact}</p>
              <p style={{ margin: '0.5rem 0 0', color: '#cbd5e1', fontSize: '0.85rem' }}>{selected.reason}</p>
            </div>
            <span style={{ background: REC_COLORS[selected.recommendation], color: '#fff', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
              {selected.recommendation}
            </span>
          </div>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: '12px', padding: '1.25rem', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Ticker</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Headline</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Industry</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Impact</th>
              <th style={{ textAlign: 'left', padding: '0.5rem', color: '#94a3b8' }}>Rec</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map(ev => (
              <tr key={ev.id} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }} onClick={() => setSelected(ev)}>
                <td style={{ padding: '0.5rem' }}>{ev.date.slice(5)}</td>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '0.5rem' }}>{ev.headline}</td>
                <td style={{ padding: '0.5rem' }}><span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span></td>
                <td style={{ padding: '0.5rem' }}>{ev.impact}</td>
                <td style={{ padding: '0.5rem' }}><span style={{ background: REC_COLORS[ev.recommendation], color: '#fff', padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.7rem', fontWeight: 700 }}>{ev.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default DailyMarketAnalysis;
