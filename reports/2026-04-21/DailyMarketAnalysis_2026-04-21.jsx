import { useState, useMemo } from 'react';

const events = [
  { id: 1, headline: "Apple Names John Ternus as New CEO, Effective Sept 1", ticker: "AAPL", industry: "Tech", date: "2026-04-21", impact: "High", rec: "WATCH", reason: "Leadership transition creates short-term uncertainty; long-term product vision remains stable under insider promotion" },
  { id: 2, headline: "Nasdaq Composite Snaps Historic 13-Day Win Streak", ticker: "QQQ", industry: "Tech", date: "2026-04-20", impact: "Medium", rec: "HOLD", reason: "Longest streak since July 2009 ended on light volume; broad tech fundamentals still supportive" },
  { id: 3, headline: "GE Aerospace Reports Q1 Earnings Before Open", ticker: "GE", industry: "Tech", date: "2026-04-21", impact: "Medium", rec: "WATCH", reason: "Defense spending tailwinds and aviation recovery make this a key industrial bellwether" },
  { id: 4, headline: "MaxLinear Reports Q1 Earnings After Close", ticker: "MXL", industry: "Tech", date: "2026-04-23", impact: "Low", rec: "WATCH", reason: "Niche semiconductor name; consensus expects $0.18 EPS on $135M revenue as recovery indicator" },
  { id: 5, headline: "UnitedHealth Q1 Beats Estimates, Raises Full-Year Guidance", ticker: "UNH", industry: "Healthcare", date: "2026-04-21", impact: "High", rec: "HOLD", reason: "Blowout quarter already reflected in 7% pre-market surge; near-term upside limited" },
  { id: 6, headline: "Danaher Reports Q1 Earnings After Close", ticker: "DHR", industry: "Healthcare", date: "2026-04-22", impact: "Medium", rec: "WATCH", reason: "Biotech and life sciences spending signal; watch for commentary on lab demand recovery" },
  { id: 7, headline: "Intuitive Surgical Reports Q1 Earnings After Close", ticker: "ISRG", industry: "Healthcare", date: "2026-04-21", impact: "High", rec: "BUY", reason: "Robotic surgery leader with accelerating da Vinci procedure volumes and expanding global footprint" },
  { id: 8, headline: "US Navy Seizes Iranian Cargo Vessel, Crude Oil Spikes", ticker: "XLE", industry: "Energy", date: "2026-04-20", impact: "High", rec: "WATCH", reason: "Geopolitical escalation risks disrupting Middle East oil supply chains" },
  { id: 9, headline: "Oil Prices Ease as Iran Ceasefire Negotiations Progress", ticker: "USO", industry: "Energy", date: "2026-04-21", impact: "Medium", rec: "HOLD", reason: "WTI at $89, Brent at $95; diplomatic progress could significantly ease supply fears" },
  { id: 10, headline: "Halliburton Reports Q1 Earnings Before Open", ticker: "HAL", industry: "Energy", date: "2026-04-22", impact: "Medium", rec: "WATCH", reason: "Oilfield services bellwether; elevated crude prices supporting strong operating margins" },
  { id: 11, headline: "Markets Begin Positioning for Fed Hold at 3.50-3.75%", ticker: "SPY", industry: "Finance", date: "2026-04-26", impact: "High", rec: "HOLD", reason: "FOMC meets Apr 28-29; futures price in no change with attention on any dovish pivot in guidance" },
  { id: 12, headline: "Capital One Reports Q1 Earnings After Close", ticker: "COF", industry: "Finance", date: "2026-04-21", impact: "Medium", rec: "WATCH", reason: "Key consumer credit health barometer; watch charge-off rates and loan growth guidance" },
  { id: 13, headline: "Interactive Brokers Reports Q1 Earnings After Close", ticker: "IBKR", industry: "Finance", date: "2026-04-23", impact: "Medium", rec: "BUY", reason: "Record trading volumes and rising net interest income driving strong revenue growth" },
  { id: 14, headline: "TopBuild Surges 19% on $17B QXO Mega-Merger Deal", ticker: "BLD", industry: "Finance", date: "2026-04-21", impact: "High", rec: "SELL", reason: "Massive premium fully realized in one-day surge; significant integration and execution risk ahead" },
];

const COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const IMPACT_VAL = { High: 3, Medium: 2, Low: 1 };

const W = 800, H = 400;
const PAD = { l: 70, r: 30, t: 50, b: 70 };
const CW = W - PAD.l - PAD.r;
const CH = H - PAD.t - PAD.b;
const START = new Date('2026-04-18');
const TOTAL_DAYS = 8;

const dateToX = (ds) => PAD.l + ((new Date(ds) - START) / 864e5 / TOTAL_DAYS) * CW;
const impactToY = (imp) => PAD.t + CH * (1 - (IMPACT_VAL[imp] - 1) / 2);
const TODAY_X = dateToX('2026-04-21');

const DATE_LABELS = Array.from({ length: TOTAL_DAYS + 1 }, (_, i) => {
  const d = new Date(START);
  d.setDate(d.getDate() + i);
  return { label: `${d.getMonth() + 1}/${d.getDate()}`, x: PAD.l + (i / TOTAL_DAYS) * CW };
});

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);

  const dots = useMemo(() => {
    const groups = {};
    events.forEach((e, i) => {
      const k = `${e.date}|${e.impact}`;
      (groups[k] = groups[k] || []).push(i);
    });
    const pos = events.map((e) => ({ x: dateToX(e.date), y: impactToY(e.impact) }));
    Object.values(groups).forEach((idxs) => {
      const n = idxs.length;
      if (n > 1) idxs.forEach((idx, i) => { pos[idx].x += (i - (n - 1) / 2) * 20; });
    });
    return pos;
  }, []);

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: 'system-ui, -apple-system, sans-serif', padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
      <p style={{ color: '#94a3b8', marginBottom: 24, fontSize: 14 }}>April 21, 2026 — 14 Events across Tech, Healthcare, Energy &amp; Finance</p>

      <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
        {Object.entries(COLORS).map(([k, c]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: c }} />
            <span style={{ fontSize: 13, color: '#cbd5e1' }}>{k}</span>
          </div>
        ))}
      </div>

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          <rect x={PAD.l} y={PAD.t} width={TODAY_X - PAD.l} height={CH} fill="rgba(239,68,68,0.06)" />
          <rect x={TODAY_X} y={PAD.t} width={PAD.l + CW - TODAY_X} height={CH} fill="rgba(34,197,94,0.06)" />

          <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + CH} stroke="#1e293b" />
          <line x1={PAD.l} y1={PAD.t + CH} x2={PAD.l + CW} y2={PAD.t + CH} stroke="#1e293b" />

          {['High', 'Medium', 'Low'].map((imp) => (
            <g key={imp}>
              <line x1={PAD.l} y1={impactToY(imp)} x2={PAD.l + CW} y2={impactToY(imp)} stroke="#1e293b" strokeDasharray="2 4" />
              <text x={PAD.l - 12} y={impactToY(imp) + 4} textAnchor="end" fill="#64748b" fontSize={12}>{imp}</text>
            </g>
          ))}

          {DATE_LABELS.map(({ label, x }) => (
            <g key={label}>
              <line x1={x} y1={PAD.t + CH} x2={x} y2={PAD.t + CH + 6} stroke="#334155" />
              <text x={x} y={PAD.t + CH + 22} textAnchor="middle" fill="#64748b" fontSize={11}>{label}</text>
            </g>
          ))}

          <line x1={TODAY_X} y1={PAD.t - 4} x2={TODAY_X} y2={PAD.t + CH} stroke="#ef4444" strokeWidth={2} strokeDasharray="6 4" />
          <text x={TODAY_X} y={PAD.t - 12} textAnchor="middle" fill="#ef4444" fontSize={12} fontWeight={700}>TODAY</text>
          <text x={(PAD.l + TODAY_X) / 2} y={PAD.t + CH + 50} textAnchor="middle" fill="#475569" fontSize={11}>PAST</text>
          <text x={(TODAY_X + PAD.l + CW) / 2} y={PAD.t + CH + 50} textAnchor="middle" fill="#475569" fontSize={11}>UPCOMING</text>

          {events.map((e, i) => {
            const { x, y } = dots[i];
            const sel = selected?.id === e.id;
            return (
              <g key={e.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(sel ? null : e)}>
                {sel && <circle cx={x} cy={y} r={16} fill="none" stroke={COLORS[e.industry]} strokeWidth={2} opacity={0.6} />}
                <circle cx={x} cy={y} r={9} fill={COLORS[e.industry]} opacity={0.9} stroke="#0b0f1a" strokeWidth={1.5} />
                <text x={x} y={y + 22} textAnchor="middle" fill={COLORS[e.industry]} fontSize={9} fontWeight={600} opacity={0.8}>{e.ticker}</text>
              </g>
            );
          })}
        </svg>
      </div>

      {selected && (
        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${COLORS[selected.industry]}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>{selected.headline}</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ background: '#1e293b', padding: '2px 10px', borderRadius: 12, fontSize: 13, fontWeight: 600 }}>{selected.ticker}</span>
                <span style={{ color: COLORS[selected.industry], fontSize: 13 }}>{selected.industry}</span>
                <span style={{ color: '#64748b', fontSize: 13 }}>{selected.date}</span>
                <span style={{ color: '#64748b', fontSize: 13 }}>Impact: {selected.impact}</span>
              </div>
            </div>
            <span style={{ background: REC_COLORS[selected.rec], color: selected.rec === 'HOLD' ? '#000' : '#fff', padding: '4px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {selected.rec}
            </span>
          </div>
          <p style={{ color: '#cbd5e1', marginTop: 12, fontSize: 14, lineHeight: 1.6 }}>{selected.reason}</p>
        </div>
      )}

      <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 16 }}>All Events</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1e293b' }}>
              {['Date', 'Ticker', 'Headline', 'Industry', 'Impact', 'Rec'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#64748b', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} style={{ borderBottom: '1px solid rgba(30,41,59,0.5)', cursor: 'pointer' }}
                onClick={() => setSelected(selected?.id === e.id ? null : e)}
                onMouseEnter={(ev) => { ev.currentTarget.style.background = '#1e293b'; }}
                onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{e.date}</td>
                <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.ticker}</td>
                <td style={{ padding: '10px 12px' }}>{e.headline}</td>
                <td style={{ padding: '10px 12px' }}><span style={{ color: COLORS[e.industry] }}>{e.industry}</span></td>
                <td style={{ padding: '10px 12px' }}>{e.impact}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ background: REC_COLORS[e.rec], color: e.rec === 'HOLD' ? '#000' : '#fff', padding: '2px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700 }}>{e.rec}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p style={{ color: '#334155', fontSize: 11, marginTop: 20, textAlign: 'center' }}>Generated April 21, 2026. For informational purposes only — not financial advice.</p>
    </div>
  );
}
