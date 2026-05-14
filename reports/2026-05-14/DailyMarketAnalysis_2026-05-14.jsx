import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, ticker: 'CEG', headline: 'Constellation Energy Q1 Earnings', industry: 'Energy', date: '2026-05-11', impact: 'Medium', recommendation: 'HOLD', reason: 'Nuclear energy play benefits from AI data center demand' },
  { id: 2, ticker: 'PBR', headline: 'Petrobras Q1 Earnings Report', industry: 'Energy', date: '2026-05-11', impact: 'Medium', recommendation: 'HOLD', reason: 'Solid dividend yield but Brazilian political risk persists' },
  { id: 3, ticker: 'LLY', headline: 'Eli Lilly GLP-1 Sales Hit New Record', industry: 'Healthcare', date: '2026-05-12', impact: 'Medium', recommendation: 'BUY', reason: 'Obesity drug market expanding faster than expected' },
  { id: 4, ticker: 'AAPL', headline: 'Apple Shares Hit $300 All-Time High', industry: 'Tech', date: '2026-05-13', impact: 'High', recommendation: 'HOLD', reason: 'Strong momentum but valuation stretched at record highs' },
  { id: 5, ticker: 'CSCO', headline: 'Cisco Surges 17% on AI Order Boom', industry: 'Tech', date: '2026-05-13', impact: 'High', recommendation: 'BUY', reason: 'AI networking demand validates long-term growth thesis' },
  { id: 6, ticker: 'NVDA', headline: 'Nvidia CEO Joins Trump on China Trade Trip', industry: 'Tech', date: '2026-05-13', impact: 'High', recommendation: 'BUY', reason: 'Potential trade deal could unlock massive GPU export market' },
  { id: 7, ticker: 'BABA', headline: 'Alibaba Quarterly Earnings Release', industry: 'Tech', date: '2026-05-13', impact: 'Medium', recommendation: 'WATCH', reason: 'China exposure adds uncertainty amid ongoing trade talks' },
  { id: 8, ticker: 'SPY', headline: 'PPI Surges 6% YoY — Inflation Shock', industry: 'Finance', date: '2026-05-13', impact: 'High', recommendation: 'HOLD', reason: 'Wholesale inflation spike threatens Fed rate cut timeline' },
  { id: 9, ticker: 'TLT', headline: '10Y Treasury Yields Hit 2026 Highs', industry: 'Finance', date: '2026-05-13', impact: 'High', recommendation: 'SELL', reason: 'Rising yields signal higher-for-longer rate environment' },
  { id: 10, ticker: 'XLU', headline: 'Utilities Sector Drops 5% in May', industry: 'Energy', date: '2026-05-13', impact: 'Medium', recommendation: 'SELL', reason: 'Rising yields making dividend stocks less attractive' },
  { id: 11, ticker: 'AMAT', headline: 'Applied Materials Q2 Earnings Report', industry: 'Tech', date: '2026-05-14', impact: 'High', recommendation: 'WATCH', reason: 'Key semiconductor equipment bellwether reports today' },
  { id: 12, ticker: 'XRT', headline: 'Advance Retail Sales Report Due', industry: 'Finance', date: '2026-05-14', impact: 'High', recommendation: 'WATCH', reason: 'Consumer spending data critical for recession narrative' },
  { id: 13, ticker: 'UNH', headline: 'UnitedHealth Pressured by Rising Medical Costs', industry: 'Healthcare', date: '2026-05-14', impact: 'Medium', recommendation: 'HOLD', reason: 'Inflation pushing up costs but enrollment remains strong' },
  { id: 14, ticker: 'MUFG', headline: 'Mitsubishi UFJ Financial Group Earnings', industry: 'Finance', date: '2026-05-15', impact: 'Medium', recommendation: 'WATCH', reason: 'Japanese banking giant reflects global rate dynamics' },
  { id: 15, ticker: 'JNJ', headline: 'J&J Talc Settlement Hearing Scheduled', industry: 'Healthcare', date: '2026-05-16', impact: 'Medium', recommendation: 'HOLD', reason: 'Legal overhang persists but core pharma business solid' },
];

const INDUSTRY_COLORS = { Tech: '#818cf8', Healthcare: '#34d399', Energy: '#fbbf24', Finance: '#fb7185' };
const REC_COLORS = { BUY: '#22c55e', SELL: '#ef4444', HOLD: '#eab308', WATCH: '#3b82f6' };
const TODAY = '2026-05-14';

const dateToDay = (d) => {
  const base = new Date('2026-05-11');
  const cur = new Date(d);
  return (cur - base) / 86400000;
};

const CHART = { w: 800, h: 300, pt: 30, pb: 40, pl: 60, pr: 40 };
const innerW = CHART.w - CHART.pl - CHART.pr;
const innerH = CHART.h - CHART.pt - CHART.pb;
const totalDays = 8;

const xPos = (date) => CHART.pl + (dateToDay(date) / totalDays) * innerW;
const yPos = (impact) => {
  const val = impact === 'High' ? 3 : impact === 'Medium' ? 2 : 1;
  return CHART.pt + ((3 - val) / 2) * innerH;
};

function ScatterChart({ events, selected, onSelect }) {
  const todayX = xPos(TODAY);
  const dates = Array.from({ length: 9 }, (_, i) => {
    const d = new Date('2026-05-11');
    d.setDate(d.getDate() + i);
    return d.toISOString().slice(0, 10);
  });

  return (
    <svg viewBox={`0 0 ${CHART.w} ${CHART.h}`} style={{ width: '100%', maxWidth: 800, display: 'block', margin: '0 auto' }}>
      <rect x={CHART.pl} y={CHART.pt} width={todayX - CHART.pl} height={innerH} fill="rgba(239,68,68,0.06)" />
      <rect x={todayX} y={CHART.pt} width={CHART.pl + innerW - todayX} height={innerH} fill="rgba(34,197,94,0.06)" />
      <line x1={todayX} y1={CHART.pt} x2={todayX} y2={CHART.pt + innerH} stroke="#ef4444" strokeWidth="2" strokeDasharray="6 4" />
      <text x={todayX} y={CHART.pt - 8} fill="#ef4444" fontSize="11" textAnchor="middle" fontFamily="sans-serif">TODAY</text>
      {dates.map((d) => (
        <g key={d}>
          <line x1={xPos(d)} y1={CHART.pt} x2={xPos(d)} y2={CHART.pt + innerH} stroke="#1e293b" strokeWidth="1" />
          <text x={xPos(d)} y={CHART.pt + innerH + 20} fill="#64748b" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
            {d.slice(5)}
          </text>
        </g>
      ))}
      {['High', 'Medium', 'Low'].map((label) => (
        <g key={label}>
          <line x1={CHART.pl} y1={yPos(label)} x2={CHART.pl + innerW} y2={yPos(label)} stroke="#1e293b" strokeWidth="1" />
          <text x={CHART.pl - 10} y={yPos(label) + 4} fill="#64748b" fontSize="11" textAnchor="end" fontFamily="sans-serif">{label}</text>
        </g>
      ))}
      {events.map((ev) => (
        <g key={ev.id} onClick={() => onSelect(ev.id === selected ? null : ev.id)} style={{ cursor: 'pointer' }}>
          <circle cx={xPos(ev.date)} cy={yPos(ev.impact)} r={selected === ev.id ? 9 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={selected === ev.id ? 1 : 0.85} stroke={selected === ev.id ? '#fff' : 'none'} strokeWidth="2" />
          <text x={xPos(ev.date)} y={yPos(ev.impact) - 12} fill="#94a3b8" fontSize="9" textAnchor="middle" fontFamily="sans-serif">{ev.ticker}</text>
        </g>
      ))}
    </svg>
  );
}

function DetailPanel({ event }) {
  if (!event) return null;
  return (
    <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, marginTop: 16, border: '1px solid #1e293b' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: '#f1f5f9' }}>{event.ticker}</span>
        <span style={{ background: REC_COLORS[event.recommendation], color: event.recommendation === 'HOLD' ? '#000' : '#fff', padding: '3px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
          {event.recommendation}
        </span>
        <span style={{ color: INDUSTRY_COLORS[event.industry], fontSize: 12, fontWeight: 500 }}>{event.industry}</span>
      </div>
      <div style={{ color: '#e2e8f0', fontSize: 15, marginBottom: 6 }}>{event.headline}</div>
      <div style={{ color: '#94a3b8', fontSize: 13 }}>{event.reason}</div>
      <div style={{ color: '#64748b', fontSize: 12, marginTop: 8 }}>Date: {event.date} &middot; Impact: {event.impact}</div>
    </div>
  );
}

function EventTable({ events, selected, onSelect }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 24 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #1e293b' }}>
            {['Ticker', 'Headline', 'Industry', 'Date', 'Impact', 'Rec'].map((h) => (
              <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((ev) => (
            <tr key={ev.id} onClick={() => onSelect(ev.id === selected ? null : ev.id)} style={{ cursor: 'pointer', borderBottom: '1px solid #1e293b', background: selected === ev.id ? '#1e293b' : 'transparent' }}>
              <td style={{ padding: '8px 12px', color: '#f1f5f9', fontWeight: 600 }}>{ev.ticker}</td>
              <td style={{ padding: '8px 12px', color: '#cbd5e1' }}>{ev.headline}</td>
              <td style={{ padding: '8px 12px' }}><span style={{ color: INDUSTRY_COLORS[ev.industry] }}>{ev.industry}</span></td>
              <td style={{ padding: '8px 12px', color: '#94a3b8' }}>{ev.date.slice(5)}</td>
              <td style={{ padding: '8px 12px', color: ev.impact === 'High' ? '#f87171' : '#fbbf24' }}>{ev.impact}</td>
              <td style={{ padding: '8px 12px' }}>
                <span style={{ background: REC_COLORS[ev.recommendation], color: ev.recommendation === 'HOLD' ? '#000' : '#fff', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600 }}>
                  {ev.recommendation}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('All');

  const filtered = useMemo(() => {
    if (filter === 'All') return EVENTS;
    return EVENTS.filter((e) => e.industry === filter);
  }, [filter]);

  const detail = EVENTS.find((e) => e.id === selected) || null;

  return (
    <div style={{ background: '#0b0f1a', minHeight: '100vh', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', padding: '32px 16px' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: '#64748b', fontSize: 14, marginBottom: 24 }}>2026-05-14 &middot; 15 events across 4 industries</p>

        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {['All', 'Tech', 'Healthcare', 'Energy', 'Finance'].map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={{ background: filter === f ? '#334155' : '#151c2c', color: filter === f ? '#f1f5f9' : '#64748b', border: '1px solid #1e293b', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: filter === f ? 600 : 400 }}>
              {f !== 'All' && <span style={{ color: INDUSTRY_COLORS[f], marginRight: 6 }}>&bull;</span>}{f}
            </button>
          ))}
        </div>

        <div style={{ background: '#151c2c', borderRadius: 12, padding: 20, border: '1px solid #1e293b' }}>
          <ScatterChart events={filtered} selected={selected} onSelect={setSelected} />
        </div>

        <DetailPanel event={detail} />
        <EventTable events={filtered} selected={selected} onSelect={setSelected} />
      </div>
    </div>
  );
}
