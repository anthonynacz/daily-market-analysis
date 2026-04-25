import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Intel Q1 Earnings Beat – Stock Surges 23.6%", industry: "Tech", date: "2026-04-24", impact: "High", ticker: "INTC", recommendation: "BUY", reason: "Best daily gain since 1987 with strong forward guidance signals chipmaker turnaround." },
  { id: 2, headline: "Nvidia Crosses $5 Trillion Market Cap", industry: "Tech", date: "2026-04-24", impact: "High", ticker: "NVDA", recommendation: "HOLD", reason: "AI dominance confirmed but valuation at extreme premium levels." },
  { id: 3, headline: "Alphabet Unveils New AI Chips & Partnerships", industry: "Tech", date: "2026-04-22", impact: "High", ticker: "GOOGL", recommendation: "BUY", reason: "Custom AI silicon positions Alphabet to challenge Nvidia in AI infrastructure." },
  { id: 4, headline: "Meta Plans 10% Workforce Reduction", industry: "Tech", date: "2026-04-25", impact: "Medium", ticker: "META", recommendation: "WATCH", reason: "8,000 layoffs redirect spending toward AI but signal margin pressure." },
  { id: 5, headline: "Microsoft Fiscal Q3 2026 Earnings Due", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "MSFT", recommendation: "BUY", reason: "Analysts expect $4.04 EPS with 16.8% YoY growth from cloud and AI." },
  { id: 6, headline: "Tesla Q1 2026 Earnings Report", industry: "Tech", date: "2026-04-22", impact: "High", ticker: "TSLA", recommendation: "HOLD", reason: "Met consensus at $0.37 EPS but EV competition intensifying globally." },
  { id: 7, headline: "Cigna Group Q1 Earnings Due", industry: "Healthcare", date: "2026-04-30", impact: "Medium", ticker: "CI", recommendation: "WATCH", reason: "Key read on managed care medical cost trends and membership growth." },
  { id: 8, headline: "Record Low Consumer Sentiment Pressures Pharma", industry: "Healthcare", date: "2026-04-25", impact: "Medium", ticker: "PFE", recommendation: "HOLD", reason: "Consumer confidence at 49.8 may reduce discretionary healthcare spending." },
  { id: 9, headline: "US-Iran Ceasefire Eases Oil Supply Fears", industry: "Energy", date: "2026-04-22", impact: "High", ticker: "XOM", recommendation: "SELL", reason: "Geopolitical de-escalation removes crude oil risk premium from prices." },
  { id: 10, headline: "Oil Prices Decline on Middle East Peace", industry: "Energy", date: "2026-04-23", impact: "Medium", ticker: "CVX", recommendation: "HOLD", reason: "Lower crude prices offset by strong downstream refining margins." },
  { id: 11, headline: "Renewable Energy Stocks Gain on Policy Shift", industry: "Energy", date: "2026-04-24", impact: "Medium", ticker: "NEE", recommendation: "BUY", reason: "Clean energy benefits from geopolitical stability and policy tailwinds." },
  { id: 12, headline: "FOMC Meeting & Rate Decision Upcoming", industry: "Finance", date: "2026-04-28", impact: "High", ticker: "JPM", recommendation: "WATCH", reason: "Markets pricing in potential dovish signals amid weak consumer data." },
  { id: 13, headline: "S&P 500 Closes at Record High 7,165", industry: "Finance", date: "2026-04-24", impact: "High", ticker: "SPY", recommendation: "HOLD", reason: "Historic highs amid mixed economic signals suggest caution at current levels." },
  { id: 14, headline: "Consumer Sentiment Plunges to Record Low 49.8", industry: "Finance", date: "2026-04-25", impact: "High", ticker: "GS", recommendation: "WATCH", reason: "Weakest reading ever despite market rally creates dangerous divergence." },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const IMPACT_VAL = { High: 3, Medium: 2, Low: 1 };
const DATE_LABELS = ['Apr 22', 'Apr 23', 'Apr 24', 'Apr 25', 'Apr 26', 'Apr 27', 'Apr 28', 'Apr 29', 'Apr 30'];
const TODAY_INDEX = 3;

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const margin = { top: 36, right: 36, bottom: 56, left: 72 };
  const W = 920;
  const H = 380;
  const plotW = W - margin.left - margin.right;
  const plotH = H - margin.top - margin.bottom;

  const x = (dateStr) => {
    const day = parseInt(dateStr.split('-')[2], 10);
    return margin.left + ((day - 22) / 8) * plotW;
  };
  const y = (impact) => margin.top + plotH - ((IMPACT_VAL[impact] - 1) / 2) * plotH;
  const todayX = margin.left + (TODAY_INDEX / 8) * plotW;

  const dots = useMemo(() => {
    const groups = {};
    EVENTS.forEach(e => {
      const key = `${e.date}_${e.impact}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(e);
    });
    const result = [];
    Object.values(groups).forEach(group => {
      const n = group.length;
      group.forEach((e, i) => {
        const offset = (i - (n - 1) / 2) * 26;
        result.push({ ...e, cx: x(e.date) + offset, cy: y(e.impact) });
      });
    });
    return result;
  }, []);

  const sel = selected ? EVENTS.find(e => e.id === selected) : null;

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", padding: 24 }}>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: '#94a3b8', marginBottom: 20, fontSize: 14 }}>April 25, 2026 — 14 events across 4 industries</p>

        <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
              {name}
            </div>
          ))}
        </div>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20 }}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }}>
            <rect x={margin.left} y={margin.top} width={todayX - margin.left} height={plotH} fill="rgba(239,68,68,0.06)" />
            <rect x={todayX} y={margin.top} width={margin.left + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

            <line x1={todayX} y1={margin.top - 8} x2={todayX} y2={margin.top + plotH + 8} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" />
            <text x={todayX} y={margin.top - 14} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

            {DATE_LABELS.map((label, i) => {
              const lx = margin.left + (i / 8) * plotW;
              return (
                <g key={label}>
                  <line x1={lx} y1={margin.top} x2={lx} y2={margin.top + plotH} stroke="#1e293b" strokeWidth={1} />
                  <text x={lx} y={H - 16} textAnchor="middle" fill="#64748b" fontSize={11}>{label}</text>
                </g>
              );
            })}

            {['High', 'Medium', 'Low'].map(level => {
              const ly = y(level);
              return (
                <g key={level}>
                  <line x1={margin.left} y1={ly} x2={margin.left + plotW} y2={ly} stroke="#1e293b" strokeWidth={1} />
                  <text x={margin.left - 12} y={ly + 4} textAnchor="end" fill="#64748b" fontSize={11}>{level}</text>
                </g>
              );
            })}

            {dots.map(d => (
              <g key={d.id} onClick={() => setSelected(selected === d.id ? null : d.id)} style={{ cursor: 'pointer' }}>
                <circle cx={d.cx} cy={d.cy} r={selected === d.id ? 12 : 9} fill={INDUSTRY_COLORS[d.industry]} opacity={selected && selected !== d.id ? 0.3 : 0.9} stroke={selected === d.id ? '#fff' : 'none'} strokeWidth={2} />
                <text x={d.cx} y={d.cy - 14} textAnchor="middle" fill="#cbd5e1" fontSize={9} fontWeight={600}>{d.ticker}</text>
              </g>
            ))}
          </svg>
        </div>

        {sel && (
          <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${INDUSTRY_COLORS[sel.industry]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{sel.industry} · {sel.date}</div>
                <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{sel.headline}</h3>
                <span style={{ fontSize: 15, color: '#94a3b8', fontWeight: 600 }}>{sel.ticker}</span>
              </div>
              <span style={{ background: REC_COLORS[sel.recommendation], color: sel.recommendation === 'HOLD' ? '#000' : '#fff', padding: '6px 16px', borderRadius: 999, fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                {sel.recommendation}
              </span>
            </div>
            <p style={{ marginTop: 12, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{sel.reason}</p>
          </div>
        )}

        <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e, i) => (
                <tr key={e.id} onClick={() => setSelected(selected === e.id ? null : e.id)} style={{ borderBottom: '1px solid #1e293b', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)', cursor: 'pointer' }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{e.date.slice(5)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: INDUSTRY_COLORS[e.industry] }}>{e.ticker}</td>
                  <td style={{ padding: '10px 14px' }}>{e.headline}</td>
                  <td style={{ padding: '10px 14px' }}>{e.industry}</td>
                  <td style={{ padding: '10px 14px' }}>{e.impact}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ background: REC_COLORS[e.recommendation], color: e.recommendation === 'HOLD' ? '#000' : '#fff', padding: '3px 10px', borderRadius: 999, fontWeight: 700, fontSize: 11 }}>{e.recommendation}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default DailyMarketAnalysis;
