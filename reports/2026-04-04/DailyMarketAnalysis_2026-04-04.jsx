import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const EVENTS = [
  { id: 1, headline: 'Intel Completes $14.2B Fab 34 Stake Repurchase from Apollo', industry: 'Tech', date: '2026-04-02', impact: 'High', ticker: 'INTC', recommendation: 'BUY', reason: 'Major capacity investment signals strong long-term semiconductor demand and strategic reshoring.' },
  { id: 2, headline: 'Tesla Q1 Deliveries Fall Short of Wall Street Estimates', industry: 'Tech', date: '2026-04-02', impact: 'High', ticker: 'TSLA', recommendation: 'SELL', reason: 'Delivery miss amid growing competition and brand headwinds suggests near-term downside risk.' },
  { id: 3, headline: 'Nike Shares Slide After Numerous Price Target Cuts', industry: 'Tech', date: '2026-04-02', impact: 'Medium', ticker: 'NKE', recommendation: 'SELL', reason: 'Multiple analyst downgrades point to weakening consumer demand and margin pressure.' },
  { id: 4, headline: 'Oil Prices Surge Nearly 10% on Iran War Escalation', industry: 'Energy', date: '2026-04-02', impact: 'High', ticker: 'XOM', recommendation: 'BUY', reason: 'Geopolitical supply disruption drives crude near $110/bbl, benefiting major producers.' },
  { id: 5, headline: 'Diamondback Energy Rallies on Oil Price Spike', industry: 'Energy', date: '2026-04-02', impact: 'Medium', ticker: 'FANG', recommendation: 'HOLD', reason: 'Rally is geopolitically driven; wait for clarity on Iran situation before adding exposure.' },
  { id: 6, headline: 'ConocoPhillips Gains 3% Amid Broad Energy Rally', industry: 'Energy', date: '2026-04-03', impact: 'Medium', ticker: 'COP', recommendation: 'BUY', reason: 'Well-positioned with low breakeven costs to benefit from sustained higher oil prices.' },
  { id: 7, headline: 'Chevron Benefits from Crude Oil Price Spike', industry: 'Energy', date: '2026-04-02', impact: 'Medium', ticker: 'CVX', recommendation: 'BUY', reason: 'Integrated major with strong dividend yield offers defensive energy exposure.' },
  { id: 8, headline: 'JPMorgan Chase Q1 Earnings Report Due', industry: 'Finance', date: '2026-04-14', impact: 'High', ticker: 'JPM', recommendation: 'WATCH', reason: 'Bellwether bank report will set tone for financials and reveal credit quality trends.' },
  { id: 9, headline: 'Bank of America Q1 Earnings Report Due', industry: 'Finance', date: '2026-04-15', impact: 'High', ticker: 'BAC', recommendation: 'WATCH', reason: 'Key indicator of consumer banking health and net interest income trajectory.' },
  { id: 10, headline: 'UnitedHealth Group Q1 Earnings Report Due', industry: 'Healthcare', date: '2026-04-15', impact: 'High', ticker: 'UNH', recommendation: 'WATCH', reason: 'Largest health insurer results will signal managed care sector direction amid policy uncertainty.' },
  { id: 11, headline: 'Johnson & Johnson Q1 Earnings Report Due', industry: 'Healthcare', date: '2026-04-15', impact: 'Medium', ticker: 'JNJ', recommendation: 'WATCH', reason: 'Post-separation pharma-focused JNJ faces scrutiny on oncology pipeline progress.' },
  { id: 12, headline: 'Tesla Q1 Earnings Report Due', industry: 'Tech', date: '2026-04-20', impact: 'High', ticker: 'TSLA', recommendation: 'WATCH', reason: 'Margins and guidance will be critical after disappointing delivery numbers.' },
  { id: 13, headline: 'Alphabet Q1 Earnings Report Due', industry: 'Tech', date: '2026-04-22', impact: 'High', ticker: 'GOOGL', recommendation: 'WATCH', reason: 'AI monetization progress and cloud growth will drive sentiment across big tech.' },
  { id: 14, headline: 'Microsoft & Meta Q1 Earnings Reports Due', industry: 'Tech', date: '2026-04-28', impact: 'High', ticker: 'MSFT', recommendation: 'WATCH', reason: 'AI capex returns and ad revenue trends are key themes for mega-cap tech.' },
];

const TODAY = '2026-04-04';

const IMPACT_Y = { High: 3, Medium: 2, Low: 1 };

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

function formatDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartConfig = useMemo(() => {
    const startDate = new Date(2026, 3, 1);
    const endDate = new Date(2026, 3, 9);
    const totalDays = 8;
    const width = 900;
    const height = 300;
    const padX = 60;
    const padY = 40;
    const plotW = width - padX * 2;
    const plotH = height - padY * 2;
    const todayDate = parseDate(TODAY);

    const days = [];
    for (let i = 0; i <= totalDays; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      days.push(d);
    }

    const getX = (dateStr) => {
      const d = parseDate(dateStr);
      const diff = (d - startDate) / (1000 * 60 * 60 * 24);
      return padX + (diff / totalDays) * plotW;
    };

    const getY = (impact) => padY + plotH - ((IMPACT_Y[impact] - 0.5) / 3) * plotH;

    const todayX = padX + ((todayDate - startDate) / (1000 * 60 * 60 * 24) / totalDays) * plotW;

    return { width, height, padX, padY, plotW, plotH, days, getX, getY, todayX, startDate, totalDays };
  }, []);

  const selectedEvent = selected !== null ? EVENTS.find((e) => e.id === selected) : null;

  return (
    <div style={{ minHeight: '100vh', background: '#0b0f1a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif", padding: 32 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>{TODAY} | 14 Events Tracked</p>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
          <span key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
            {name}
          </span>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 24, marginBottom: 24, overflowX: 'auto' }}>
        <svg width={chartConfig.width} height={chartConfig.height} style={{ display: 'block', margin: '0 auto' }}>
          {/* Past background */}
          <rect x={chartConfig.padX} y={chartConfig.padY} width={chartConfig.todayX - chartConfig.padX} height={chartConfig.plotH} fill="rgba(239,68,68,0.06)" />
          {/* Future background */}
          <rect x={chartConfig.todayX} y={chartConfig.padY} width={chartConfig.padX + chartConfig.plotW - chartConfig.todayX} height={chartConfig.plotH} fill="rgba(34,197,94,0.06)" />

          {/* Grid lines */}
          {chartConfig.days.map((d, i) => {
            const x = chartConfig.padX + (i / chartConfig.totalDays) * chartConfig.plotW;
            return (
              <g key={i}>
                <line x1={x} y1={chartConfig.padY} x2={x} y2={chartConfig.padY + chartConfig.plotH} stroke="#1e293b" strokeWidth={1} />
                <text x={x} y={chartConfig.height - 8} fill="#64748b" fontSize={11} textAnchor="middle">{formatDate(d)}</text>
              </g>
            );
          })}

          {/* Y axis labels */}
          {['Low', 'Medium', 'High'].map((label, i) => (
            <text key={label} x={chartConfig.padX - 10} y={chartConfig.getY(label)} fill="#64748b" fontSize={11} textAnchor="end" dominantBaseline="middle">{label}</text>
          ))}

          {/* Horizontal grid */}
          {['Low', 'Medium', 'High'].map((label) => (
            <line key={label} x1={chartConfig.padX} y1={chartConfig.getY(label)} x2={chartConfig.padX + chartConfig.plotW} y2={chartConfig.getY(label)} stroke="#1e293b" strokeWidth={1} />
          ))}

          {/* Today line */}
          <line x1={chartConfig.todayX} y1={chartConfig.padY - 10} x2={chartConfig.todayX} y2={chartConfig.padY + chartConfig.plotH + 10} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={chartConfig.todayX} y={chartConfig.padY - 14} fill="#ef4444" fontSize={11} textAnchor="middle" fontWeight={600}>TODAY</text>

          {/* Event dots */}
          {EVENTS.map((ev) => {
            const cx = chartConfig.getX(ev.date);
            const cy = chartConfig.getY(ev.impact) + (ev.id % 3 - 1) * 8;
            const isSelected = selected === ev.id;
            return (
              <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev.id)} style={{ cursor: 'pointer' }}>
                <circle cx={cx} cy={cy} r={isSelected ? 9 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                <title>{ev.ticker}: {ev.headline}</title>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Detail Panel */}
      {selectedEvent && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 24, borderLeft: `4px solid ${INDUSTRY_COLORS[selectedEvent.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>{selectedEvent.headline}</h3>
              <p style={{ color: '#94a3b8', fontSize: 14 }}>
                <strong>{selectedEvent.ticker}</strong> &middot; {selectedEvent.industry} &middot; {selectedEvent.date} &middot; Impact: {selectedEvent.impact}
              </p>
              <p style={{ marginTop: 8, fontSize: 14 }}>{selectedEvent.reason}</p>
            </div>
            <span style={{
              padding: '6px 16px', borderRadius: 999, fontSize: 13, fontWeight: 700, color: '#fff',
              background: REC_COLORS[selectedEvent.recommendation],
            }}>
              {selectedEvent.recommendation}
            </span>
          </div>
        </div>
      )}

      {/* Events Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 24, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b', color: '#94a3b8' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Date</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Ticker</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Headline</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Industry</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Impact</th>
              <th style={{ textAlign: 'left', padding: '8px 12px' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((ev) => (
              <tr key={ev.id} onClick={() => setSelected(ev.id)} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected === ev.id ? '#1e293b' : 'transparent' }}>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{ev.date}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{ev.ticker}</td>
                <td style={{ padding: '10px 12px' }}>{ev.headline}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[ev.industry] }} />
                    {ev.industry}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>{ev.impact}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700, color: '#fff', background: REC_COLORS[ev.recommendation] }}>
                    {ev.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: 12, marginTop: 24, textAlign: 'center' }}>
        Generated on {TODAY}. For informational purposes only. Not financial advice.
      </p>
    </div>
  );
}
