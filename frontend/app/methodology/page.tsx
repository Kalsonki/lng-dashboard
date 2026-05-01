export default function MethodologyPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-semibold text-white">Methodology & Data Quality</h2>
        <p className="text-sm text-text-muted mt-0.5">How the analytics are computed and what the limitations are</p>
      </div>

      {[
        {
          title: "Destination Inference",
          content: `LNG vessel destinations are inferred using a weighted signal stack:

1. AIS destination string — parsed against ~60 terminal name fragments and country codes. Weight: 2×.
2. Geofence proximity — if vessel is within 50nm of a known import terminal, classified as arriving/arrived. Weight: 3×.
3. Canal routing — position near Suez Canal northbound → Europe; near Panama → Pacific/Asia. Weight: 1.5×.
4. Route heading — bearing relative to candidate destination regions. Weight: 1×.

Confidence levels: ≥80% = high, 60–79% = moderate, <60% = low/uncertain.

Known limitations: AIS destination is often blank, wrong, or outdated. Geofence radius (50nm) can cause false positives near closely-spaced terminals. Canal routing is deterministic and may be wrong for vessels that turn back.`,
        },
        {
          title: "Europe vs Asia Pull Score",
          content: `A heuristic scoring framework (0–10 each):

EUROPE PULL:
• Storage deficit vs 5yr average: 0–3 pts. A large deficit (below 5yr avg) signals urgent import demand.
• TTF/JKM spread: 0–3 pts. When TTF > JKM (converted to common unit), Europe is paying a premium.
• Recent EU flow share (30d): 0–2 pts. Momentum signal.
• Seasonal demand factor: 0–2 pts. Winter = high, summer = low.

ASIA PULL:
• JKM/TTF spread: 0–3 pts. Mirror of Europe spread.
• Recent Asia flow share (30d): 0–2 pts.
• Pacific routing advantage: 1.2 pts constant. US Gulf to Asia is longer, but Pacific exports have structural Asian exposure.
• Asian structural demand growth proxy: 1.0 pt constant.

The dominant signal is determined when one score exceeds the other by >0.5 pts.`,
        },
        {
          title: "Data Sources",
          content: `FREE / LIVE:
• EIA API (eia.gov/opendata) — US LNG export volumes by destination country, monthly lag.
  Key: get free API key at https://www.eia.gov/opendata/
• GIE AGSI+ (agsi.gie.eu) — European gas storage, daily.
  Key: register at https://agsi.gie.eu for free API key.
• AISstream (aisstream.io) — WebSocket vessel position stream.
  Key: register at https://aisstream.io for free tier.
• stooq.com — TTF price proxy via public CSV endpoint.

ESTIMATED / SAMPLE:
• JKM prices: generated as estimated values based on seasonal patterns.
  → Replace with Platts/Argus/ICIS premium feed for live data.
• Vessel voyage data: sample data included for demo mode.
  → AISstream live feed populates this once connected.

PREMIUM CONNECTORS (not yet integrated):
• Kpler: LNG cargo tracking, terminal throughput, confirmed destinations.
• ICIS/LSEG: TTF, JKM, LNG spot prices.
• VesselsValue: enhanced vessel data and historical voyage records.
• S&P Global Commodity Insights: supply/demand analytics.`,
        },
        {
          title: "Known Limitations",
          content: `• Sample data mode: without API keys, all analytics run on synthetic but realistic sample data.
• No real-time coverage: AIS free tier is rate-limited and may miss vessels.
• AIS destination is self-reported by crew and frequently inaccurate.
• Price data uses estimated values when live feeds are unavailable.
• EIA data has a 1–2 month reporting lag.
• This tool is NOT a substitute for commercial cargo tracking platforms (Kpler, Vortexa).
• Destination inference does not handle multi-port calls or mid-voyage cargo sales.
• The pull score formula weights are manually calibrated heuristics, not statistically optimised.`,
        },
      ].map(({ title, content }) => (
        <div key={title} className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-sm font-semibold text-white mb-3">{title}</h3>
          <pre className="text-xs text-slate-300 whitespace-pre-wrap leading-relaxed font-sans">
            {content}
          </pre>
        </div>
      ))}
    </div>
  );
}
