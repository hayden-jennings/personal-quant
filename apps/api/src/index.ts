import "dotenv/config";
import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.get("/api/health", (_req, res) => res.json({ ok: true }));

const POLY_BASE = "https://api.polygon.io";
const KEY = process.env.POLYGON_API_KEY;

function withKey(
  path: string,
  q: Record<string, string | number | boolean> = {}
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) params.set(k, String(v));
  if (KEY) params.set("apiKey", KEY);
  return `${POLY_BASE}${path}?${params.toString()}`;
}

/** Aggregates (custom bars) — /v2/aggs/ticker/{ticker}/range/{multiplier}/{timespan}/{from}/{to}
 * Docs: Stocks Aggregates (Custom Bars). */
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
    `/v2/aggs/ticker/${ticker}/range/${multiplier}/${timespan}/${from}/${to}`,
    { adjusted, sort, limit }
  );

  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

/** Previous Day Bar — /v2/aggs/ticker/{ticker}/prev */
app.get("/api/stocks/prev", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const url = withKey(`/v2/aggs/ticker/${ticker}/prev`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

/** Daily Open/Close — /v1/open-close/{ticker}/{date} */
app.get("/api/stocks/open-close", async (req, res) => {
  const {
    ticker,
    date,
    adjusted = "true",
  } = req.query as Record<string, string>;
  if (!ticker || !date)
    return res.status(400).json({ error: "ticker, date required" });

  const url = withKey(`/v1/open-close/${ticker}/${date}`, { adjusted });
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

/** Ticker Overview (details) — /v3/reference/tickers/{ticker} */
app.get("/api/stocks/details", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const url = withKey(`/v3/reference/tickers/${ticker}`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

/** News — /v2/reference/news?ticker=XXX&limit=... */
app.get("/api/stocks/news", async (req, res) => {
  const {
    ticker = "",
    limit = "10",
    order = "desc",
  } = req.query as Record<string, string>;
  const url = withKey(`/v2/reference/news`, { ticker, limit, order });
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

app.get("/api/stocks/prev", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });

  const url = withKey(`/v2/aggs/ticker/${ticker}/prev`);
  const r = await fetch(url);
  const j = await r.json();
  res.status(r.status).json(j);
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
