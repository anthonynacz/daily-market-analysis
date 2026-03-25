import React from 'react';
import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const RECOMMENDATION_COLORS = {
  BUY: '#22c55e',
  SELL: '#ef4444',
  HOLD: '#eab308',
  WATCH: '#3b82f6',
};

const EVENTS = [
  { id: 1, headline: 'Micron (MU) Q2 Earnings Report', industry: 'Tech', date: '2026-03-26', impact: 'High', ticker: 'MU', recommendation: 'BUY', reason: 'Strong revenue and EPS growth streak; technical breakout confirmed last quarter.' },
  { id: 2, headline: 'Alibaba (BABA) Earnings — Weak Technical Setup', industry: 'Tech', date: '2026-03-26', impact: 'Medium', ticker: 'BABA', recommendation: 'HOLD', reason: 'Trading at multi-month lows; wait for earnings clarity before adding.' },
  { id: 3, headline: 'Accenture (ACN) Earnings — AI Consulting Disruption', industry: 'Tech', date: '2026-03-27', impact: 'Medium', ticker: 'ACN', recommendation: 'WATCH', reason: 'AI disruption narrative weighing on consulting sector; key read on enterprise spending.' },
  { id: 4, headline: 'Software Sector (IGV) Down 23% YTD on AI Fears', industry: 'Tech', date: '2026-03-24', impact: 'High', ticker: 'IGV', recommendation: 'WATCH', reason: 'Sector-wide selloff may be overdone but no catalyst for reversal yet.' },
  { id: 5, headline: 'AWS Bahrain Region Disrupted by Drone Activity', industry: 'Tech', date: '2026-03-24', impact: 'Medium', ticker: 'AMZN', recommendation: 'HOLD', reason: 'Cloud migration underway to other regions; limited long-term impact but watch for escalation.' },
  { id: 6, headline: 'Oil Surges Past $91 on Iran Strait of Hormuz Tensions', industry: 'Energy', date: '2026-03-24', impact: 'High', ticker: 'USO', recommendation: 'HOLD', reason: 'Prices elevated but diplomacy signals could trigger sharp reversal.' },
  { id: 7, headline: 'Brent Crude Drops 4.7% on US-Iran Diplomacy Hopes', industry: 'Energy', date: '2026-03-25', impact: 'High', ticker: 'BNO', recommendation: 'SELL', reason: 'If diplomatic resolution materializes, oil could fall significantly from wartime premium.' },
  { id: 8, headline: 'Chevron Rallies +1.82% as Energy Sector Outperforms', industry: 'Energy', date: '2026-03-24', impact: 'Medium', ticker: 'CVX', recommendation: 'BUY', reason: 'Strong defensive play while oil remains elevated; solid dividend yield.' },
  { id: 9, headline: 'Fed Holds Rates at 3.50-3.75%, Cites Middle East Uncertainty', industry: 'Finance', date: '2026-03-22', impact: 'High', ticker: 'SPY', recommendation: 'HOLD', reason: 'Rate path uncertain; inflation pressures from oil complicate cuts timeline.' },
  { id: 10, headline: 'Russell 2000 Enters Correction Territory', industry: 'Finance', date: '2026-03-23', impact: 'High', ticker: 'IWM', recommendation: 'WATCH', reason: 'Small caps historically rebound after corrections but macro headwinds persist.' },
  { id: 11, headline: 'SEC May Scrap Quarterly Reporting Requirement', industry: 'Finance', date: '2026-03-24', impact: 'Medium', ticker: 'XLF', recommendation: 'WATCH', reason: 'Major regulatory shift if enacted; could reduce short-term volatility but decrease transparency.' },
  { id: 12, headline: 'UMich Consumer Sentiment Final — Consensus 55.5', industry: 'Finance', date: '2026-03-27', impact: 'Medium', ticker: 'XLY', recommendation: 'WATCH', reason: 'Consumer confidence key indicator amid rising energy costs and geopolitical stress.' },
  { id: 13, headline: 'FedEx (FDX) Earnings — Global Trade Bellwether', industry: 'Finance', date: '2026-03-26', impact: 'Medium', ticker: 'FDX', recommendation: 'HOLD', reason: 'Shipping volumes reflect global trade health; Iran disruptions could impact guidance.' },
  { id: 14, headline: 'Healthcare Stocks Resilient as Defensive Play', industry: 'Healthcare', date: '2026-03-25', impact: 'Medium', ticker: 'XLV', recommendation: 'BUY', reason: 'Sector rotation into defensives amid geopolitical uncertainty supports healthcare names.' },
];

function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / (1000 * 60 * 60 * 24));
}

function App() {
  const [selected, setSelected] = useState(null);
  const today = '2026-03-25';

  const chartConfig = useMemo(() => {
    const startDate = '2026-03-22';
    const endDate = '2026-03-30';
    const totalDays = daysBetween(startDate, endDate);
    const width = 900;
    const height = 300;
    const padding = { top: 30, right: 30, bottom: 40, left: 60 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;
    const impactMap = { Low: 1, Medium: 2, High: 3 };

    const points = EVENTS.map(ev => {
      const dx = daysBetween(startDate, ev.date);
      const x = padding.left + (dx / totalDays) * plotW;
      const y = padding.top + plotH - ((impactMap[ev.impact] - 0.5) / 3) * plotH;
      return { ...ev, x, y };
    });

    const todayX = padding.left + (daysBetween(startDate, today) / totalDays) * plotW;

    const dates = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date('2026-03-22');
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const x = padding.left + (i / totalDays) * plotW;
      dates.push({ label, x });
    }

    return { width, height, padding, plotW, plotH, points, todayX, dates };
  }, []);

  const selectedEvent = selected ? EVENTS.find(e => e.id === selected) : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 20, background: '#0b0f1a', color: '#e2e8f0', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", minHeight: '100vh' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, color: '#f1f5f9' }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 20 }}>{today} | 14 Events Across 4 Industries</p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, marginBottom: 20, overflowX: 'auto' }}>
        <svg width={chartConfig.width} height={chartConfig.height} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background */}
          <rect x={chartConfig.padding.left} y={chartConfig.padding.top} width={chartConfig.todayX - chartConfig.padding.left} height={chartConfig.plotH} fill="rgba(239,68,68,0.05)" />
          {/* Future background */}
          <rect x={chartConfig.todayX} y={chartConfig.padding.top} width={chartConfig.padding.left + chartConfig.plotW - chartConfig.todayX} height={chartConfig.plotH} fill="rgba(34,197,94,0.05)" />
          {/* Today line */}
          <line x1={chartConfig.todayX} y1={chartConfig.padding.top} x2={chartConfig.todayX} y2={chartConfig.padding.top + chartConfig.plotH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={chartConfig.todayX} y={chartConfig.padding.top - 8} fill="#ef4444" fontSize={11} textAnchor="middle">TODAY</text>
          {/* Y axis labels */}
          {['Low', 'Medium', 'High'].map((label, i) => (
            <text key={label} x={chartConfig.padding.left - 10} y={chartConfig.padding.top + chartConfig.plotH - ((i + 0.5) / 3) * chartConfig.plotH + 4} fill="#64748b" fontSize={11} textAnchor="end">{label}</text>
          ))}
          {/* X axis dates */}
          {chartConfig.dates.map((d, i) => (
            <text key={i} x={d.x} y={chartConfig.padding.top + chartConfig.plotH + 20} fill="#64748b" fontSize={10} textAnchor="middle">{d.label}</text>
          ))}
          {/* Grid lines */}
          {[1, 2, 3].map(i => (
            <line key={i} x1={chartConfig.padding.left} y1={chartConfig.padding.top + chartConfig.plotH - ((i - 0.5) / 3) * chartConfig.plotH} x2={chartConfig.padding.left + chartConfig.plotW} y2={chartConfig.padding.top + chartConfig.plotH - ((i - 0.5) / 3) * chartConfig.plotH} stroke="#1e293b" strokeWidth={1} />
          ))}
          {/* Dots */}
          {chartConfig.points.map(pt => (
            <circle key={pt.id} cx={pt.x} cy={pt.y} r={selected === pt.id ? 9 : 7} fill={INDUSTRY_COLORS[pt.industry]} stroke={selected === pt.id ? '#fff' : 'none'} strokeWidth={2} style={{ cursor: 'pointer', opacity: selected && selected !== pt.id ? 0.3 : 1, transition: 'opacity 0.2s' }} onClick={() => setSelected(selected === pt.id ? null : pt.id)} />
          ))}
        </svg>
      </div>

      {/* Detail Panel */}
      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 style={{ fontSize: 18, marginBottom: 6 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: 13 }}>{selectedEvent.date} • {selectedEvent.industry} • <strong style={{ color: '#f1f5f9' }}>{selectedEvent.ticker}</strong> • Impact: {selectedEvent.impact}</p>
            </div>
            <span style={{ background: RECOMMENDATION_COLORS[selectedEvent.recommendation], color: '#000', fontWeight: 700, fontSize: 13, padding: '4px 14px', borderRadius: 20 }}>{selectedEvent.recommendation}</span>
          </div>
          <p style={{ marginTop: 12, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{selectedEvent.reason}</p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Headline', 'Industry', 'Ticker', 'Impact', 'Rec'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '8px 10px', color: '#64748b', fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...EVENTS].sort((a, b) => a.date.localeCompare(b.date)).map(ev => (
              <tr key={ev.id} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected === ev.id ? '#1e293b' : 'transparent' }} onClick={() => setSelected(selected === ev.id ? null : ev.id)}>
                <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ev.date}</td>
                <td style={{ padding: '8px 10px' }}>{ev.headline}</td>
                <td style={{ padding: '8px 10px' }}><span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span></td>
                <td style={{ padding: '8px 10px', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '8px 10px' }}>{ev.impact}</td>
                <td style={{ padding: '8px 10px' }}><span style={{ background: RECOMMENDATION_COLORS[ev.recommendation], color: '#000', fontWeight: 700, fontSize: 11, padding: '2px 10px', borderRadius: 12 }}>{ev.recommendation}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ textAlign: 'center', color: '#475569', fontSize: 11, marginTop: 20 }}>Generated 2026-03-25 • Data sourced from CNBC, Bloomberg, Yahoo Finance, Earnings Whispers</p>
    </div>
  );
}

export default App;
