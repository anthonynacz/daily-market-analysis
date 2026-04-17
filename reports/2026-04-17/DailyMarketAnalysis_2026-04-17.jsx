import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, ticker: 'AVGO', headline: 'Broadcom Surges 3% on Meta 1GW AI Chip Deal', industry: 'Tech', date: '2026-04-16', impact: 'High', recommendation: 'BUY', reason: "Meta's billion-dollar AI chip commitment validates Broadcom's custom silicon leadership and long-term growth trajectory." },
  { id: 2, ticker: 'NFLX', headline: 'Netflix Drops 10% After Hastings Exit & Weak Q2 Guidance', industry: 'Tech', date: '2026-04-16', impact: 'High', recommendation: 'SELL', reason: 'Leadership vacuum with Reed Hastings departing after 29 years and disappointing Q2 outlook create significant near-term downside.' },
  { id: 3, ticker: 'IONQ', headline: 'IonQ Surges 20% on Quantum Computing Contract Wins', industry: 'Tech', date: '2026-04-15', impact: 'Medium', recommendation: 'WATCH', reason: 'Strong momentum on new contracts but quantum computing revenue remains highly speculative at this stage.' },
  { id: 4, ticker: 'META', headline: 'Meta Commits to 1GW AI Infrastructure Buildout', industry: 'Tech', date: '2026-04-17', impact: 'Medium', recommendation: 'HOLD', reason: 'Massive AI spending signals long-term ambition; maintain position but monitor capex efficiency closely.' },
  { id: 5, ticker: 'JPM', headline: 'JPMorgan Chase Q1 Earnings Beat Expectations', industry: 'Finance', date: '2026-04-14', impact: 'High', recommendation: 'BUY', reason: 'Dominant banking franchise thriving in current rate environment with strong trading and consumer credit revenue.' },
  { id: 6, ticker: 'BAC', headline: 'Bank of America Reports Steady Q1 Earnings', industry: 'Finance', date: '2026-04-15', impact: 'Medium', recommendation: 'HOLD', reason: 'Stable consumer banking performance but net interest margin is under gradual compression pressure.' },
  { id: 7, ticker: 'MS', headline: 'Morgan Stanley Q1 Earnings Mixed on Trading Volatility', industry: 'Finance', date: '2026-04-15', impact: 'Medium', recommendation: 'WATCH', reason: 'Wealth management division strong but trading revenue remains highly dependent on market conditions.' },
  { id: 8, ticker: 'SCHW', headline: 'Charles Schwab Q1 Earnings Report', industry: 'Finance', date: '2026-04-16', impact: 'Medium', recommendation: 'HOLD', reason: 'Client asset growth trending positive but persistent cash sorting headwinds limit upside.' },
  { id: 9, ticker: 'JNJ', headline: 'Johnson & Johnson Q1 Earnings Show Pipeline Strength', industry: 'Healthcare', date: '2026-04-14', impact: 'High', recommendation: 'BUY', reason: 'Robust pharmaceutical pipeline and accelerating MedTech segment growth support premium valuation.' },
  { id: 10, ticker: 'ABT', headline: 'Abbott Laboratories Q1 Earnings Report', industry: 'Healthcare', date: '2026-04-16', impact: 'Medium', recommendation: 'HOLD', reason: 'Solid diagnostics revenue base but increasing competition in continuous glucose monitoring market.' },
  { id: 11, ticker: 'UNH', headline: 'UnitedHealth Group Q1 Earnings Preview', industry: 'Healthcare', date: '2026-04-20', impact: 'High', recommendation: 'WATCH', reason: 'Healthcare bellwether whose forward guidance will set the tone for the entire managed care sector.' },
  { id: 12, ticker: 'XOM', headline: 'ExxonMobil Rallies on Iran War Resolution Hopes', industry: 'Energy', date: '2026-04-16', impact: 'High', recommendation: 'BUY', reason: 'Geopolitical de-escalation after Trump-Netanyahu talks supports stable oil prices and production outlook.' },
  { id: 13, ticker: 'CVX', headline: 'Chevron Positioned for Stability on Middle East Diplomacy', industry: 'Energy', date: '2026-04-17', impact: 'Medium', recommendation: 'WATCH', reason: 'Diplomatic progress in the Middle East could normalize energy markets; await clearer price direction.' },
  { id: 14, ticker: 'SPY', headline: 'Initial Jobless Claims Fall to 207K, Beat Estimates', industry: 'Finance', date: '2026-04-16', impact: 'Medium', recommendation: 'BUY', reason: 'Labor market resilience with claims below 215K consensus supports continued economic expansion and equity upside.' },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const BASE_DATE = new Date('2026-04-14T00:00:00');
const TODAY_STR = '2026-04-17';
const TOTAL_DAYS = 9;

const CHART_W = 920;
const CHART_H = 400;
const PAD = { left: 72, right: 32, top: 44, bottom: 54 };
const PLOT = {
  left: PAD.left,
  right: CHART_W - PAD.right,
  top: PAD.top,
  bottom: CHART_H - PAD.bottom,
  width: CHART_W - PAD.left - PAD.right,
  height: CHART_H - PAD.top - PAD.bottom,
};

function dateToX(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const diff = (d - BASE_DATE) / (1000 * 60 * 60 * 24);
  return PLOT.left + (diff / (TOTAL_DAYS - 1)) * PLOT.width;
}

function impactToY(impact) {
  const map = { High: 0.2, Medium: 0.55, Low: 0.85 };
  return PLOT.top + (map[impact] || 0.55) * PLOT.height;
}

function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const todayX = dateToX(TODAY_STR);

  const dots = useMemo(() => {
    const groups = {};
    EVENTS.forEach((e, i) => {
      const key = `${e.date}-${e.impact}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(i);
    });
    return EVENTS.map((e, i) => {
      const key = `${e.date}-${e.impact}`;
      const group = groups[key];
      const idx = group.indexOf(i);
      const spread = group.length > 1 ? (idx - (group.length - 1) / 2) : 0;
      return { ...e, cx: dateToX(e.date) + spread * 22, cy: impactToY(e.impact) + spread * 10 };
    });
  }, []);

  const dateLabels = useMemo(() => {
    const labels = [];
    for (let i = 0; i < TOTAL_DAYS; i++) {
      const d = new Date(BASE_DATE);
      d.setDate(d.getDate() + i);
      labels.push({
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        x: PLOT.left + (i / (TOTAL_DAYS - 1)) * PLOT.width,
        isToday: i === 3,
      });
    }
    return labels;
  }, []);

  const containerStyle = {
    background: '#0b0f1a',
    color: '#e2e8f0',
    minHeight: '100vh',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    padding: '32px 40px',
    maxWidth: 980,
    margin: '0 auto',
  };

  return (
    <div style={containerStyle}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: '#f1f5f9' }}>
          Daily Market Analysis
        </h1>
        <p style={{ color: '#64748b', fontSize: 14, margin: '6px 0 0' }}>
          April 17, 2026 &middot; S&P 500: 7,041.28 &middot; Nasdaq: 24,102.70 (12th straight gain) &middot; Dow: 48,578.72
        </p>
      </div>

      <div style={{ background: '#151c2c', borderRadius: 14, padding: '24px 20px 16px', marginBottom: 20, border: '1px solid #1e293b' }}>
        <h2 style={{ fontSize: 15, color: '#94a3b8', margin: '0 0 16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          Event Timeline &mdash; Impact Scatter
        </h2>
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ width: '100%', height: 'auto' }}>
          <rect x={PLOT.left} y={PLOT.top} width={todayX - PLOT.left} height={PLOT.height} fill="rgba(239,68,68,0.06)" rx={4} />
          <rect x={todayX} y={PLOT.top} width={PLOT.right - todayX} height={PLOT.height} fill="rgba(34,197,94,0.06)" rx={4} />

          <text x={PLOT.left + (todayX - PLOT.left) / 2} y={PLOT.top + 18} fill="rgba(239,68,68,0.25)" textAnchor="middle" fontSize={12} fontWeight={600}>PAST</text>
          <text x={todayX + (PLOT.right - todayX) / 2} y={PLOT.top + 18} fill="rgba(34,197,94,0.25)" textAnchor="middle" fontSize={12} fontWeight={600}>UPCOMING</text>

          <line x1={todayX} y1={PLOT.top} x2={todayX} y2={PLOT.bottom} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={PLOT.top - 10} fill="#ef4444" textAnchor="middle" fontSize={11} fontWeight={700}>TODAY</text>

          <line x1={PLOT.left} y1={impactToY('High')} x2={PLOT.right} y2={impactToY('High')} stroke="#1e293b" strokeWidth={1} />
          <line x1={PLOT.left} y1={impactToY('Medium')} x2={PLOT.right} y2={impactToY('Medium')} stroke="#1e293b" strokeWidth={1} />

          <text x={PLOT.left - 12} y={impactToY('High')} fill="#94a3b8" textAnchor="end" fontSize={12} dominantBaseline="middle" fontWeight={500}>High</text>
          <text x={PLOT.left - 12} y={impactToY('Medium')} fill="#94a3b8" textAnchor="end" fontSize={12} dominantBaseline="middle" fontWeight={500}>Medium</text>

          <line x1={PLOT.left} y1={PLOT.top} x2={PLOT.left} y2={PLOT.bottom} stroke="#334155" strokeWidth={1} />
          <line x1={PLOT.left} y1={PLOT.bottom} x2={PLOT.right} y2={PLOT.bottom} stroke="#334155" strokeWidth={1} />

          {dateLabels.map((d, i) => (
            <text key={i} x={d.x} y={PLOT.bottom + 22} fill={d.isToday ? '#ef4444' : '#64748b'} textAnchor="middle" fontSize={11} fontWeight={d.isToday ? 700 : 400}>
              {d.label}
            </text>
          ))}

          {dots.map((d) => (
            <g key={d.id} onClick={() => setSelected(selected && selected.id === d.id ? null : d)} style={{ cursor: 'pointer' }}>
              <circle cx={d.cx} cy={d.cy} r={selected && selected.id === d.id ? 11 : 7} fill={INDUSTRY_COLORS[d.industry]} opacity={selected && selected.id === d.id ? 1 : 0.85} stroke={selected && selected.id === d.id ? '#fff' : 'transparent'} strokeWidth={2} />
              <text x={d.cx} y={d.cy - 14} fill="#cbd5e1" textAnchor="middle" fontSize={9.5} fontWeight={600}>{d.ticker}</text>
            </g>
          ))}
        </svg>

        <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginTop: 10, flexWrap: 'wrap' }}>
          {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color }} />
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: '20px 24px', marginBottom: 20, border: '1px solid #1e293b', animation: 'fadeIn 0.2s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 18, color: '#f1f5f9' }}>
                <span style={{ color: INDUSTRY_COLORS[selected.industry] }}>{selected.ticker}</span> &mdash; {selected.headline}
              </h3>
            </div>
            <span style={{
              background: REC_COLORS[selected.recommendation],
              color: selected.recommendation === 'HOLD' ? '#000' : '#fff',
              padding: '5px 16px',
              borderRadius: 20,
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ color: '#94a3b8', margin: '12px 0 10px', lineHeight: 1.5, fontSize: 14 }}>{selected.reason}</p>
          <div style={{ display: 'flex', gap: 24, color: '#64748b', fontSize: 13, flexWrap: 'wrap' }}>
            <span>Industry: <span style={{ color: INDUSTRY_COLORS[selected.industry] }}>{selected.industry}</span></span>
            <span>Date: {selected.date}</span>
            <span>Impact: <span style={{ color: selected.impact === 'High' ? '#f87171' : '#fbbf24' }}>{selected.impact}</span></span>
          </div>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: 14, padding: '20px 20px 8px', border: '1px solid #1e293b' }}>
        <h2 style={{ fontSize: 15, color: '#94a3b8', margin: '0 0 12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
          All Events
        </h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #1e293b' }}>
                {['Ticker', 'Headline', 'Industry', 'Date', 'Impact', 'Recommendation'].map((h) => (
                  <th key={h} style={{ textAlign: 'left', padding: '10px 8px', color: '#475569', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {EVENTS.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={(ev) => { ev.currentTarget.style.background = '#1a2236'; }}
                  onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={{ padding: '10px 8px', color: '#e2e8f0', fontWeight: 700, fontSize: 14 }}>{e.ticker}</td>
                  <td style={{ padding: '10px 8px', color: '#cbd5e1', fontSize: 13 }}>{e.headline}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ color: INDUSTRY_COLORS[e.industry], fontSize: 13 }}>{e.industry}</span>
                  </td>
                  <td style={{ padding: '10px 8px', color: '#94a3b8', fontSize: 13 }}>{e.date.slice(5)}</td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{ color: e.impact === 'High' ? '#f87171' : '#fbbf24', fontSize: 13 }}>{e.impact}</span>
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <span style={{
                      background: REC_COLORS[e.recommendation],
                      color: e.recommendation === 'HOLD' ? '#000' : '#fff',
                      padding: '2px 12px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                    }}>
                      {e.recommendation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: '#334155', fontSize: 11, marginTop: 24 }}>
        Generated on April 17, 2026. For informational purposes only &mdash; not financial advice.
      </p>
    </div>
  );
}

export default DailyMarketAnalysis;
