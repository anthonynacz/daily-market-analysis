import { useState, useMemo } from 'react';

const EVENTS = [
  { id: 1, headline: "Alphabet Q1 Earnings Report — AI Spending Under Scrutiny", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "GOOGL", recommendation: "WATCH", reason: "AI capex justification needed; wait for results before acting" },
  { id: 2, headline: "Microsoft Q1 Earnings — Azure AI Revenue in Focus", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "MSFT", recommendation: "BUY", reason: "Azure AI revenue growth expected to drive a strong beat" },
  { id: 3, headline: "Amazon Q1 Earnings — AWS & Retail Momentum", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "AMZN", recommendation: "BUY", reason: "AWS and retail momentum suggest upside potential" },
  { id: 4, headline: "Meta Platforms Q1 Earnings — Ad Revenue vs AI Costs", industry: "Tech", date: "2026-04-29", impact: "High", ticker: "META", recommendation: "HOLD", reason: "Strong ad revenue expected but AI capex concerns linger" },
  { id: 5, headline: "OpenAI Revenue Miss Drags Oracle Cloud Stock Down 7.5%", industry: "Tech", date: "2026-04-28", impact: "High", ticker: "ORCL", recommendation: "SELL", reason: "Cloud infrastructure spending may slow as OpenAI struggles to meet targets" },
  { id: 6, headline: "Spotify Q1 Earnings — Subscriber Growth & Margins", industry: "Tech", date: "2026-04-28", impact: "Medium", ticker: "SPOT", recommendation: "WATCH", reason: "Margin improvement story needs validation from subscriber data" },
  { id: 7, headline: "AbbVie Q1 Earnings — Immunology Pipeline Update", industry: "Healthcare", date: "2026-04-29", impact: "Medium", ticker: "ABBV", recommendation: "HOLD", reason: "Humira biosimilar impact stabilizing; pipeline progress is key" },
  { id: 8, headline: "Centene Q1 Earnings — Medicaid Redetermination Impact", industry: "Healthcare", date: "2026-04-28", impact: "Medium", ticker: "CNC", recommendation: "WATCH", reason: "Medicaid headwinds may pressure membership and revenue" },
  { id: 9, headline: "BP Q1 Earnings — Energy Transition Strategy Review", industry: "Energy", date: "2026-04-28", impact: "Medium", ticker: "BP", recommendation: "HOLD", reason: "Rising oil prices provide tailwind but transition strategy under scrutiny" },
  { id: 10, headline: "Oil Prices Surge on Iran Geopolitical Tensions", industry: "Energy", date: "2026-04-27", impact: "High", ticker: "XLE", recommendation: "BUY", reason: "Geopolitical tensions and supply disruption fears support energy sector" },
  { id: 11, headline: "Visa Q1 Earnings — Cross-Border Payments Recovery", industry: "Finance", date: "2026-04-28", impact: "High", ticker: "V", recommendation: "BUY", reason: "Cross-border travel recovery and digital payments growth continue" },
  { id: 12, headline: "SoFi Technologies Q1 Earnings — Fintech Lending Growth", industry: "Finance", date: "2026-04-29", impact: "Medium", ticker: "SOFI", recommendation: "WATCH", reason: "Strong lending growth but stretched valuation warrants caution" },
  { id: 13, headline: "FOMC Interest Rate Decision — Rates Expected to Hold", industry: "Finance", date: "2026-04-29", impact: "High", ticker: "SPY", recommendation: "WATCH", reason: "Rates expected at 3.50-3.75%; forward guidance will move markets" },
  { id: 14, headline: "Core PCE Price Index Release — Key Inflation Gauge", industry: "Finance", date: "2026-04-30", impact: "High", ticker: "SPY", recommendation: "WATCH", reason: "Inflation data will shape the Fed's rate path for summer 2026" },
];

const INDUSTRY_COLORS = { Tech: "#818cf8", Healthcare: "#34d399", Energy: "#fbbf24", Finance: "#fb7185" };
const REC_COLORS = { BUY: "#22c55e", SELL: "#ef4444", HOLD: "#eab308", WATCH: "#3b82f6" };

const TODAY = "2026-04-29";

const DATES = [
  "2026-04-26","2026-04-27","2026-04-28","2026-04-29","2026-04-30","2026-05-01","2026-05-02","2026-05-03","2026-05-04"
];

const IMPACT_MAP = { Low: 1, Medium: 2, High: 3 };

function formatDate(d) {
  const parts = d.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(parts[1], 10) - 1]} ${parseInt(parts[2], 10)}`;
}

export default function DailyMarketAnalysis() {
  const [selected, setSelected] = useState(null);
  const [filterIndustry, setFilterIndustry] = useState("All");

  const filtered = useMemo(() => {
    if (filterIndustry === "All") return EVENTS;
    return EVENTS.filter(e => e.industry === filterIndustry);
  }, [filterIndustry]);

  const chartW = 800, chartH = 340, padL = 60, padR = 30, padT = 30, padB = 50;
  const plotW = chartW - padL - padR;
  const plotH = chartH - padT - padB;

  const xScale = (date) => {
    const idx = DATES.indexOf(date);
    if (idx === -1) return padL;
    return padL + (idx / (DATES.length - 1)) * plotW;
  };

  const yScale = (impact) => {
    const v = IMPACT_MAP[impact] || 2;
    return padT + plotH - ((v - 0.5) / 3) * plotH;
  };

  const todayX = xScale(TODAY);

  const jitter = (id) => {
    const seed = ((id * 7 + 3) % 11) - 5;
    return seed * 3;
  };

  return (
    <div style={{ background: "#0b0f1a", color: "#e2e8f0", minHeight: "100vh", fontFamily: "'Inter', 'Segoe UI', sans-serif", padding: "24px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Daily Market Analysis</h1>
        <p style={{ color: "#94a3b8", marginBottom: 24, fontSize: 14 }}>April 29, 2026 — Major Earnings & Economic Events</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {["All", "Tech", "Healthcare", "Energy", "Finance"].map(ind => (
            <button key={ind} onClick={() => setFilterIndustry(ind)} style={{
              padding: "6px 14px", borderRadius: 6, border: "1px solid " + (ind === "All" ? "#475569" : INDUSTRY_COLORS[ind] || "#475569"),
              background: filterIndustry === ind ? (ind === "All" ? "#1e293b" : INDUSTRY_COLORS[ind] + "22") : "transparent",
              color: ind === "All" ? "#e2e8f0" : INDUSTRY_COLORS[ind] || "#e2e8f0", cursor: "pointer", fontSize: 13, fontWeight: 500
            }}>{ind}</button>
          ))}
        </div>

        <div style={{ background: "#151c2c", borderRadius: 12, padding: 20, marginBottom: 20, overflowX: "auto" }}>
          <svg width={chartW} height={chartH} style={{ display: "block", margin: "0 auto" }}>
            <rect x={padL} y={padT} width={todayX - padL} height={plotH} fill="rgba(239,68,68,0.06)" />
            <rect x={todayX} y={padT} width={padL + plotW - todayX} height={plotH} fill="rgba(34,197,94,0.06)" />

            {[1, 2, 3].map(v => {
              const y = padT + plotH - ((v - 0.5) / 3) * plotH;
              return <g key={v}>
                <line x1={padL} x2={padL + plotW} y1={y} y2={y} stroke="#1e293b" strokeWidth={1} />
                <text x={padL - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize={11}>
                  {v === 1 ? "Low" : v === 2 ? "Med" : "High"}
                </text>
              </g>;
            })}

            {DATES.map((d, i) => {
              const x = xScale(d);
              return <g key={d}>
                <line x1={x} x2={x} y1={padT} y2={padT + plotH} stroke="#1e293b" strokeWidth={1} />
                <text x={x} y={padT + plotH + 20} textAnchor="middle" fill="#64748b" fontSize={11}>{formatDate(d)}</text>
              </g>;
            })}

            <line x1={todayX} x2={todayX} y1={padT - 5} y2={padT + plotH + 5} stroke="#ef4444" strokeWidth={2} strokeDasharray="6,4" />
            <text x={todayX} y={padT - 10} textAnchor="middle" fill="#ef4444" fontSize={11} fontWeight={600}>TODAY</text>

            {filtered.map(ev => {
              const cx = xScale(ev.date) + jitter(ev.id);
              const cy = yScale(ev.impact) + jitter(ev.id + 3);
              const isSelected = selected && selected.id === ev.id;
              return <g key={ev.id} style={{ cursor: "pointer" }} onClick={() => setSelected(isSelected ? null : ev)}>
                <circle cx={cx} cy={cy} r={isSelected ? 10 : 7} fill={INDUSTRY_COLORS[ev.industry]} opacity={isSelected ? 1 : 0.85}
                  stroke={isSelected ? "#fff" : "none"} strokeWidth={2} />
                <text x={cx} y={cy - 12} textAnchor="middle" fill="#94a3b8" fontSize={9} fontWeight={500}>{ev.ticker}</text>
              </g>;
            })}
          </svg>
        </div>

        {selected && (
          <div style={{ background: "#151c2c", borderRadius: 12, padding: 20, marginBottom: 20, borderLeft: `4px solid ${INDUSTRY_COLORS[selected.industry]}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{selected.headline}</h3>
                <p style={{ color: "#94a3b8", fontSize: 13, margin: 0 }}>
                  <span style={{ color: INDUSTRY_COLORS[selected.industry], fontWeight: 500 }}>{selected.industry}</span> &middot; {formatDate(selected.date)} &middot; {selected.ticker} &middot; Impact: {selected.impact}
                </p>
              </div>
              <span style={{
                padding: "4px 14px", borderRadius: 20, fontSize: 13, fontWeight: 600,
                background: REC_COLORS[selected.recommendation] + "22", color: REC_COLORS[selected.recommendation]
              }}>{selected.recommendation}</span>
            </div>
            <p style={{ marginTop: 12, fontSize: 14, color: "#cbd5e1", lineHeight: 1.5 }}>{selected.reason}</p>
          </div>
        )}

        <div style={{ background: "#151c2c", borderRadius: 12, padding: 20, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1e293b" }}>
                {["Date", "Ticker", "Headline", "Industry", "Impact", "Rec"].map(h => (
                  <th key={h} style={{ padding: "10px 8px", textAlign: "left", color: "#64748b", fontWeight: 500, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.05em" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(ev => (
                <tr key={ev.id} onClick={() => setSelected(ev)} style={{ borderBottom: "1px solid #1e293b11", cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.background = "#1e293b"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "10px 8px", whiteSpace: "nowrap" }}>{formatDate(ev.date)}</td>
                  <td style={{ padding: "10px 8px", fontWeight: 600 }}>{ev.ticker}</td>
                  <td style={{ padding: "10px 8px", maxWidth: 300 }}>{ev.headline}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span style={{ color: INDUSTRY_COLORS[ev.industry], fontWeight: 500 }}>{ev.industry}</span>
                  </td>
                  <td style={{ padding: "10px 8px" }}>{ev.impact}</td>
                  <td style={{ padding: "10px 8px" }}>
                    <span style={{
                      padding: "2px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600,
                      background: REC_COLORS[ev.recommendation] + "22", color: REC_COLORS[ev.recommendation]
                    }}>{ev.recommendation}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ textAlign: "center", color: "#475569", fontSize: 11, marginTop: 24 }}>
          Generated {TODAY} &middot; Data sourced from CNBC, TheStreet, Earnings Whispers, Trading Economics
        </p>
      </div>
    </div>
  );
}
