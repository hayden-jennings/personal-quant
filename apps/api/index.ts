import express from "express";

const app = express();
const PORT = process.env.PORT || 8787;
const POLY_BASE = "https://api.polygon.io";
const KEY = process.env.POLYGON_API_KEY;
if (!KEY) console.warn("⚠️ POLYGON_API_KEY not set — real calls will fail.");

function withKey(url: string) {
  const sep = url.includes("?") ? "&" : "?";
  return `${POLY_BASE}${url}${sep}apiKey=${KEY}`;
}

app.get("/api/health", (_, res) => res.json({ ok: true }));

// Aggregates (custom bars): /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
// Docs: Stocks Aggregates (Custom Bars). :contentReference[oaicite:0]{index=0}
app.get("/api/stocks/aggregates", async (req, res) => {
  const {
    ticker,
    multiplier = "1",
    timespan = "day",
    from,
    to,
    adjusted = "true",
    sort = "asc",
    limit = "5000",
  } = req.query as Record<string, string>;
  if (!ticker || !from || !to)
    return res.status(400).json({ error: "ticker, from, to required" });
  const url = withKey(
    `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}?adjusted=${adjusted}&sort=${sort}&limit=${limit}`
  );
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

// Previous day bar: /v2/aggs/ticker/{ticker}/prev — OHLC for prev session. :contentReference[oaicite:1]{index=1}
app.get("/api/stocks/prev", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });
  const url = withKey(`/v2/aggs/ticker/${ticker}/prev`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

// Daily open/close: /v1/open-close/{ticker}/{date}. :contentReference[oaicite:2]{index=2}
app.get("/api/stocks/open-close", async (req, res) => {
  const {
    ticker,
    date,
    adjusted = "true",
  } = req.query as Record<string, string>;
  if (!ticker || !date)
    return res.status(400).json({ error: "ticker, date required" });
  const url = withKey(`/v1/open-close/${ticker}/${date}?adjusted=${adjusted}`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

// Ticker details/overview (v3 reference). :contentReference[oaicite:3]{index=3}
app.get("/api/stocks/details", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });
  const url = withKey(`/v3/reference/tickers/${ticker}`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

// News: /v2/reference/news?ticker=XXX&limit=... :contentReference[oaicite:4]{index=4}
app.get("/api/stocks/news", async (req, res) => {
  const { ticker, limit = "10" } = req.query as Record<string, string>;
  const url = withKey(
    `/v2/reference/news?limit=${limit}${ticker ? `&ticker=${ticker}` : ""}`
  );
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

app.listen(PORT, () =>
  console.log(`API listening on http://localhost:${PORT}`)
);
