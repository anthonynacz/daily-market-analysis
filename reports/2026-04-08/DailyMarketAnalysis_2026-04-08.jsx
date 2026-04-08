import { useState, useMemo } from 'react';

const INDUSTRY_COLORS = {
  Tech: '#818cf8',
  Healthcare: '#34d399',
  Energy: '#fbbf24',
  Finance: '#fb7185',
};

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

const EVENTS = [
  {
    id: 1,
    headline: 'Intel Joins Musk\'s Terafab AI Chip Complex',
    industry: 'Tech',
    date: '2026-04-07',
    impact: 'High',
    ticker: 'INTC',
    recommendation: 'BUY',
    reason: 'Partnership with Musk\'s Terafab positions Intel at the center of next-gen AI chip manufacturing.',
  },
  {
    id: 2,
    headline: 'Broadcom Expands AI Partnerships with Alphabet & Anthropic',
    industry: 'Tech',
    date: '2026-04-07',
    impact: 'High',
    ticker: 'AVGO',
    recommendation: 'BUY',
    reason: 'Dual AI partnerships with major players signal strong revenue growth ahead for custom silicon.',
  },
  {
    id: 3,
    headline: 'ARM Holdings Slides 5% as AI Crescendo Fades',
    industry: 'Tech',
    date: '2026-04-07',
    impact: 'Medium',
    ticker: 'ARM',
    recommendation: 'HOLD',
    reason: 'Pullback after extended AI rally; fundamentals remain strong but valuation needs to cool.',
  },
  {
    id: 4,
    headline: 'Alphabet Q1 Earnings Report Expected',
    industry: 'Tech',
    date: '2026-04-12',
    impact: 'High',
    ticker: 'GOOG',
    recommendation: 'WATCH',
    reason: 'AI cloud revenue and ad spend trends will set the tone for big-tech earnings season.',
  },
  {
    id: 5,
    headline: 'Oil Crashes 15% on US-Iran Ceasefire Hopes',
    industry: 'Energy',
    date: '2026-04-07',
    impact: 'High',
    ticker: 'XOM',
    recommendation: 'SELL',
    reason: 'WTI plunged to $95.75 on geopolitical de-escalation; near-term downside pressure persists.',
  },
  {
    id: 6,
    headline: 'Chevron Hit by Brent Crude Drop to $94.40',
    industry: 'Energy',
    date: '2026-04-07',
    impact: 'High',
    ticker: 'CVX',
    recommendation: 'SELL',
    reason: 'Brent fell 13%+ overnight; integrated majors face margin compression if prices stay low.',
  },
  {
    id: 7,
    headline: 'Renewable Energy Stocks Rally on Oil Price Drop',
    industry: 'Energy',
    date: '2026-04-08',
    impact: 'Medium',
    ticker: 'ENPH',
    recommendation: 'BUY',
    reason: 'Cheap oil narrative fading fast; solar/wind capex still accelerating on policy tailwinds.',
  },
  {
    id: 8,
    headline: 'JPMorgan Chase Q1 Earnings Preview',
    industry: 'Finance',
    date: '2026-04-11',
    impact: 'High',
    ticker: 'JPM',
    recommendation: 'WATCH',
    reason: 'Bank earnings kick off Friday; net interest income guidance will move the entire sector.',
  },
  {
    id: 9,
    headline: 'Goldman Sachs Earnings Expected Next Week',
    industry: 'Finance',
    date: '2026-04-13',
    impact: 'High',
    ticker: 'GS',
    recommendation: 'WATCH',
    reason: 'Trading revenue and M&A pipeline commentary critical for investment bank outlook.',
  },
  {
    id: 10,
    headline: 'S&P 500 Holds Near All-Time Highs at 6,616',
    industry: 'Finance',
    date: '2026-04-07',
    impact: 'Medium',
    ticker: 'SPY',
    recommendation: 'HOLD',
    reason: 'Index resilient despite geopolitical volatility; breadth improving but stay cautious at highs.',
  },
  {
    id: 11,
    headline: 'Fed Minutes Release & Rate Outlook',
    industry: 'Finance',
    date: '2026-04-09',
    impact: 'High',
    ticker: 'XLF',
    recommendation: 'WATCH',
    reason: 'Markets pricing in rate path clarity; any hawkish surprise could jolt equities.',
  },
  {
    id: 12,
    headline: 'UnitedHealth Group Q1 Earnings Expected',
    industry: 'Healthcare',
    date: '2026-04-10',
    impact: 'High',
    ticker: 'UNH',
    recommendation: 'HOLD',
    reason: 'Bellwether managed-care report; Medicare Advantage enrollment trends are key metric to watch.',
  },
  {
    id: 13,
    headline: 'Johnson & Johnson Earnings Preview',
    industry: 'Healthcare',
    date: '2026-04-11',
    impact: 'Medium',
    ticker: 'JNJ',
    recommendation: 'HOLD',
    reason: 'MedTech segment growth and litigation reserve updates will drive sentiment.',
  },
  {
    id: 14,
    headline: 'Pfizer Pipeline Update & Oncology Data Readout',
    industry: 'Healthcare',
    date: '2026-04-09',
    impact: 'Medium',
    ticker: 'PFE',
    recommendation: 'WATCH',
    reason: 'Late-stage oncology trial data could catalyze a re-rating of the post-COVID portfolio.',
  },
  {
    id: 15,
    headline: 'Nasdaq Futures Surge 3.2% on Iran De-escalation',
    industry: 'Tech',
    date: '2026-04-08',
    impact: 'High',
    ticker: 'QQQ',
    recommendation: 'BUY',
    reason: 'Risk-on sentiment returning; tech-heavy index positioned to lead the recovery rally.',
  },
];

const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };

const TODAY = '2026-04-08';

function dateToX(dateStr, chartLeft, chartWidth, minDate, maxDate) {
  const d = new Date(dateStr).getTime();
  const min = new Date(minDate).getTime();
  const max = new Date(maxDate).getTime();
  return chartLeft + ((d - min) / (max - min)) * chartWidth;
}

function impactToY(impact, chartTop, chartHeight) {
  const val = IMPACT_MAP[impact];
  return chartTop + chartHeight - ((val - 0.5) / 3) * chartHeight;
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const chartLeft = 60;
  const chartTop = 30;
  const chartWidth = 700;
  const chartHeight = 220;
  const svgWidth = 800;
  const svgHeight = 310;

  const minDate = '2026-04-05';
  const maxDate = '2026-04-13';

  const todayX = dateToX(TODAY, chartLeft, chartWidth, minDate, maxDate);

  const days = useMemo(() => {
    const result = [];
    const start = new Date('2026-04-05');
    for (let i = 0; i <= 8; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d.toISOString().slice(0, 10));
    }
    return result;
  }, []);

  const dots = useMemo(() =>
    EVENTS.map((e) => ({
      ...e,
      cx: dateToX(e.date, chartLeft, chartWidth, minDate, maxDate),
      cy: impactToY(e.impact, chartTop, chartHeight),
    })),
    []
  );

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: 24 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24 }}>{TODAY} &mdash; 15 events across Tech, Healthcare, Energy &amp; Finance</p>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(INDUSTRY_COLORS).map(([ind, col]) => (
          <span key={ind} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: col, display: 'inline-block' }} />
            {ind}
          </span>
        ))}
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginLeft: 16 }}>
          <span style={{ width: 18, height: 2, background: '#ef4444', display: 'inline-block', borderTop: '2px dashed #ef4444' }} />
          Today
        </span>
      </div>

      {/* Chart */}
      <div style={{ background: '#151c2c', borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', height: 'auto' }}>
          {/* Past bg */}
          <rect x={chartLeft} y={chartTop} width={todayX - chartLeft} height={chartHeight} fill="rgba(239,68,68,0.06)" />
          {/* Future bg */}
          <rect x={todayX} y={chartTop} width={chartLeft + chartWidth - todayX} height={chartHeight} fill="rgba(34,197,94,0.06)" />
          {/* Grid lines */}
          {['High', 'Medium', 'Low'].map((imp) => {
            const y = impactToY(imp, chartTop, chartHeight);
            return (
              <g key={imp}>
                <line x1={chartLeft} y1={y} x2={chartLeft + chartWidth} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={chartLeft - 8} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}>{imp}</text>
              </g>
            );
          })}
          {/* Date axis */}
          {days.map((d) => {
            const x = dateToX(d, chartLeft, chartWidth, minDate, maxDate);
            return (
              <g key={d}>
                <line x1={x} y1={chartTop} x2={x} y2={chartTop + chartHeight} stroke="#1e293b" strokeWidth={1} />
                <text x={x} y={chartTop + chartHeight + 18} textAnchor="middle" fill="#64748b" fontSize={10}>
                  {d.slice(5)}
                </text>
              </g>
            );
          })}
          {/* Today line */}
          <line x1={todayX} y1={chartTop - 10} x2={todayX} y2={chartTop + chartHeight + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
          <text x={todayX} y={chartTop - 14} textAnchor="middle" fill="#ef4444" fontSize={10} fontWeight={700}>TODAY</text>
          {/* Dots */}
          {dots.map((dot) => (
            <circle
              key={dot.id}
              cx={dot.cx}
              cy={dot.cy}
              r={selected?.id === dot.id ? 9 : 7}
              fill={INDUSTRY_COLORS[dot.industry]}
              stroke={selected?.id === dot.id ? '#fff' : 'none'}
              strokeWidth={2}
              style={{ cursor: 'pointer', transition: 'r 0.2s' }}
              onClick={() => setSelected(selected?.id === dot.id ? null : dot)}
            />
          ))}
        </svg>
      </div>

      {/* Detail Panel */}
      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 24, borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{selected.headline}</h3>
              <p style={{ color: '#94a3b8', margin: '6px 0', fontSize: 14 }}>
                {selected.ticker} &bull; {selected.industry} &bull; {selected.date} &bull; Impact: {selected.impact}
              </p>
            </div>
            <span style={{
              background: REC_COLORS[selected.recommendation],
              color: selected.recommendation === 'HOLD' ? '#000' : '#fff',
              padding: '4px 14px',
              borderRadius: 999,
              fontWeight: 700,
              fontSize: 13,
              whiteSpace: 'nowrap',
            }}>
              {selected.recommendation}
            </span>
          </div>
          <p style={{ marginTop: 10, color: '#cbd5e1', fontSize: 14, lineHeight: 1.5 }}>{selected.reason}</p>
        </div>
      )}

      {/* Table */}
      <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map((h) => (
                <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: '#94a3b8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVENTS.map((e, i) => (
              <tr
                key={e.id}
                style={{ borderTop: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === e.id ? '#1e293b' : 'transparent' }}
                onClick={() => setSelected(selected?.id === e.id ? null : e)}
              >
                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{e.date.slice(5)}</td>
                <td style={{ padding: '10px 12px', fontWeight: 700, color: INDUSTRY_COLORS[e.industry] }}>{e.ticker}</td>
                <td style={{ padding: '10px 12px' }}>{e.headline}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: INDUSTRY_COLORS[e.industry] }} />
                    {e.industry}
                  </span>
                </td>
                <td style={{ padding: '10px 12px' }}>{e.impact}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    background: REC_COLORS[e.recommendation],
                    color: e.recommendation === 'HOLD' ? '#000' : '#fff',
                    padding: '2px 10px',
                    borderRadius: 999,
                    fontWeight: 700,
                    fontSize: 11,
                  }}>
                    {e.recommendation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#475569', fontSize: 11, marginTop: 24, textAlign: 'center' }}>
        Generated {TODAY}. For informational purposes only &mdash; not financial advice.
      </p>
    </div>
  );
}
