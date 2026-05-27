import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, ticker: 'MU', headline: 'Micron surges 19%, crosses $1T market cap on AI memory demand', industry: 'Tech', date: '2026-05-26', impact: 'High', recommendation: 'BUY', reason: 'AI memory demand driving exceptional growth with analyst upgrades across the Street' },
  { id: 2, ticker: 'MRVL', headline: 'Marvell Technology Q1 earnings report due', industry: 'Tech', date: '2026-05-27', impact: 'High', recommendation: 'WATCH', reason: 'Data center chip demand expected to beat estimates amid AI infrastructure buildout' },
  { id: 3, ticker: 'CRM', headline: 'Salesforce Q1 earnings report due', industry: 'Tech', date: '2026-05-27', impact: 'High', recommendation: 'WATCH', reason: 'AI-driven enterprise spending and Agentforce adoption are key metrics to monitor' },
  { id: 4, ticker: 'DELL', headline: 'Dell Technologies Q1 earnings report due', industry: 'Tech', date: '2026-05-28', impact: 'Medium', recommendation: 'WATCH', reason: 'AI server order backlog may deliver upside surprise on infrastructure demand' },
  { id: 5, ticker: 'ZS', headline: 'Zscaler Q3 earnings report — cybersecurity spending steady', industry: 'Tech', date: '2026-05-26', impact: 'Medium', recommendation: 'HOLD', reason: 'Cybersecurity growth is steady but largely priced into current valuation' },
  { id: 6, ticker: 'BP', headline: 'BP chairman ousted amid governance crisis, shares fall sharply', industry: 'Energy', date: '2026-05-26', impact: 'High', recommendation: 'SELL', reason: 'Leadership turmoil and governance concerns signal deeper structural issues at the company' },
  { id: 7, ticker: 'XLE', headline: 'US-Iran peace deal prospects lift energy sector outlook', industry: 'Energy', date: '2026-05-27', impact: 'High', recommendation: 'WATCH', reason: 'Geopolitical resolution could significantly reshape oil supply and price dynamics' },
  { id: 8, ticker: 'CRK', headline: 'Comstock Resources Q1 results filing with SEC', industry: 'Energy', date: '2026-05-27', impact: 'Low', recommendation: 'HOLD', reason: 'Natural gas pure-play remains stable but lacks near-term catalyst' },
  { id: 9, ticker: 'COST', headline: 'Costco Q3 earnings — consumer staples resilience in focus', industry: 'Finance', date: '2026-05-28', impact: 'High', recommendation: 'BUY', reason: 'Consumer staples resilience and membership growth provide defensive upside amid confidence dip' },
  { id: 10, ticker: 'AZO', headline: 'AutoZone Q3 revenue miss sends shares plunging 10%', industry: 'Finance', date: '2026-05-26', impact: 'High', recommendation: 'SELL', reason: 'Revenue miss of $4.84B vs $4.86B expected signals weakening consumer discretionary demand' },
  { id: 11, ticker: 'BKE', headline: 'Buckle Inc Q1 earnings report due', industry: 'Finance', date: '2026-05-29', impact: 'Low', recommendation: 'HOLD', reason: 'Niche retailer with limited market-moving potential but steady dividend' },
  { id: 12, ticker: 'SPY', headline: 'Consumer Confidence Index drops to 93.1 from 93.8 in May', industry: 'Finance', date: '2026-05-27', impact: 'Medium', recommendation: 'WATCH', reason: 'Declining consumer confidence may pressure retail and discretionary stocks near-term' },
  { id: 13, ticker: 'RDY', headline: 'Dr. Reddys Laboratories Q4 earnings filing', industry: 'Healthcare', date: '2026-05-27', impact: 'Medium', recommendation: 'HOLD', reason: 'Steady generic drug pipeline delivers consistent results with limited growth upside' },
  { id: 14, ticker: 'XBI', headline: 'Biotech sector rallies as Nasdaq hits fresh all-time high', industry: 'Healthcare', date: '2026-05-26', impact: 'Medium', recommendation: 'BUY', reason: 'Nasdaq record close at 26,656 lifts biotech sentiment and fund inflows' },
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

const IMPACT_MAP = { High: 3, Medium: 2, Low: 1 };

const TODAY = '2026-05-27';

function parseDate(d) {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

const DATE_RANGE = [];
for (let i = -3; i <= 5; i++) {
  const d = new Date(2026, 4, 27 + i);
  DATE_RANGE.push(d);
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState('All');

  const filtered = useMemo(() => {
    if (filterIndustry === 'All') return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800;
  const chartH = 300;
  const padL = 50;
  const padR = 30;
  const padT = 30;
  const padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const minDate = DATE_RANGE[0].getTime();
  const maxDate = DATE_RANGE[DATE_RANGE.length - 1].getTime();

  function xPos(dateStr) {
    const t = parseDate(dateStr).getTime();
    return padL + ((t - minDate) / (maxDate - minDate)) * plotW;
  }

  function yPos(impact) {
    const level = IMPACT_MAP[impact];
    return padT + plotH - ((level - 0.5) / 3) * plotH;
  }

  const todayX = xPos(TODAY);

  const jitter = (id, axis) => {
    const seed = id * 7 + (axis === 'x' ? 3 : 17);
    return ((seed % 20) - 10);
  };

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'Inter, system-ui, sans-serif', padding: '24px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>May 27, 2026 — S&P 500: 7,519.12 (+0.61%) | Nasdaq: 26,656.18 (+1.19%) | Dow: 50,461.68 (−0.23%)</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map(ind => (
            <button
              key={ind}
              onClick={() => setFilterIndustry(ind)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
                background: filterIndustry === ind ? (ind === 'All' ? '#334155' : INDUSTRY_COLORS[ind]) : '#1e293b',
                color: filterIndustry === ind ? '#fff' : '#94a3b8',
              }}
            >
              {ind}
            </button>
          ))}
        </div>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, overflowX: 'auto' }}>
          <svg width={chartW} height={chartH} style={{ display: 'block', margin: '0 auto' }}>
            <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
            <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

            <line x1={todayX} y1={padT} x2={todayX} y2={padT + plotH} stroke="#ef4444" strokeWidth={1.5} strokeDasharray="6,4" />
            <text x={todayX} y={padT - 8} fill="#ef4444" fontSize={11} textAnchor="middle" fontWeight={600}>TODAY</text>

            {[1, 2, 3].map(level => {
              const y = padT + plotH - ((level - 0.5) / 3) * plotH;
              return (
                <g key={level}>
                  <line x1={padL} y1={y} x2={padL + plotW} y2={y} stroke="#1e293b" strokeWidth={1} />
                  <text x={padL - 8} y={y + 4} fill="#64748b" fontSize={11} textAnchor="end">
                    {level === 3 ? 'High' : level === 2 ? 'Med' : 'Low'}
                  </text>
                </g>
              );
            })}

            {DATE_RANGE.map((d, i) => {
              const x = padL + (i / (DATE_RANGE.length - 1)) * plotW;
              const label = `${d.getMonth() + 1}/${d.getDate()}`;
              return (
                <text key={i} x={x} y={padT + plotH + 20} fill="#64748b" fontSize={11} textAnchor="middle">
                  {label}
                </text>
              );
            })}

            {filtered.map(ev => {
              const cx = xPos(ev.date) + jitter(ev.id, 'x');
              const cy = yPos(ev.impact) + jitter(ev.id, 'y');
              const isSelected = selected?.id === ev.id;
              return (
                <g key={ev.id} onClick={() => setSelected(isSelected ? null : ev)} style={{ cursor: 'pointer' }}>
                  <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85} stroke={isSelected ? '#fff' : 'none'} strokeWidth={2} />
                  <text x={cx} y={cy - 12} fill="#e2e8f0" fontSize={10} textAnchor="middle" fontWeight={600}>{ev.ticker}</text>
                </g>
              );
            })}
          </svg>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12 }}>
            {Object.entries(INDUSTRY_COLORS).map(([name, color]) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94a3b8' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
                {name}
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{selected.ticker} — {selected.headline}</h3>
                <p style={{ color: '#94a3b8', fontSize: 13, margin: '8px 0' }}>{selected.industry} · {selected.date} · Impact: {selected.impact}</p>
                <p style={{ fontSize: 14, margin: 0, lineHeight: 1.5 }}>{selected.reason}</p>
              </div>
              <span style={{
                padding: '6px 16px',
                borderRadius: 20,
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                background: REC_COLORS[selected.recommendation],
                whiteSpace: 'nowrap',
              }}>
                {selected.recommendation}
              </span>
            </div>
          </div>
        )}

        <div style={{ background: '#151c2c', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #1e293b' }}>
                {['Ticker', 'Headline', 'Industry', 'Date', 'Impact', 'Rec'].map(h => (
                  <th key={h} style={{ padding: '12px 14px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => (
                <tr
                  key={ev.id}
                  onClick={() => setSelected(selected?.id === ev.id ? null : ev)}
                  style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer', background: selected?.id === ev.id ? '#1e293b' : 'transparent' }}
                >
                  <td style={{ padding: '10px 14px', fontWeight: 700, color: INDUSTRY_COLORS[ev.industry] }}>{ev.ticker}</td>
                  <td style={{ padding: '10px 14px', color: '#cbd5e1', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.headline}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{ev.industry}</td>
                  <td style={{ padding: '10px 14px', color: '#94a3b8' }}>{ev.date}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ color: ev.impact === 'High' ? '#f87171' : ev.impact === 'Medium' ? '#fbbf24' : '#94a3b8', fontWeight: 600 }}>{ev.impact}</span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{
                      padding: '3px 10px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      color: '#fff',
                      background: REC_COLORS[ev.recommendation],
                    }}>
                      {ev.recommendation}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ color: '#475569', fontSize: 11, marginTop: 16, textAlign: 'center' }}>
          Generated on 2026-05-27. For informational purposes only — not financial advice.
        </p>
      </div>
    </div>
  );
}
