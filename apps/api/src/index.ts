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

/** Company Logo — via /v3/reference/tickers/{ticker} then fetch branding.logo_url */
app.get("/api/stocks/logo", async (req, res) => {
  const { ticker } = req.query as Record<string, string>;
  if (!ticker) return res.status(400).json({ error: "ticker required" });
  if (!KEY) return res.status(500).json({ error: "missing POLYGON_API_KEY" });

  try {
    // Get details to find branding.logo_url
    const detailsUrl = withKey(`/v3/reference/tickers/${ticker}`);
    const detailsResp = await fetch(detailsUrl);
    if (!detailsResp.ok) {
      const body = await detailsResp.text();
      return res.status(detailsResp.status).send(body);
    }
    const details = await detailsResp.json();
    let logoUrl: string | undefined = details?.results?.branding?.logo_url;
    if (!logoUrl) {
      return res.status(404).json({ error: "logo not found in details" });
    }

    // Ensure apiKey is present on the logo URL itself
    const hasQuery = logoUrl.includes("?");
    const hasKey = /(?:\?|&)apiKey=/.test(logoUrl);
    if (!hasKey) {
      logoUrl =
        logoUrl + (hasQuery ? "&" : "?") + `apiKey=${encodeURIComponent(KEY!)}`;
    }

    // Fetch the image and forward it with correct headers
    const imgResp = await fetch(logoUrl);
    if (!imgResp.ok) {
      return res.status(imgResp.status).json({ error: "failed to fetch logo" });
    }
    const ct = imgResp.headers.get("content-type") ?? "image/svg+xml";
    const buf = Buffer.from(await imgResp.arrayBuffer());

    res.set("Content-Type", ct);
    res.set("Cache-Control", "public, max-age=3600");
    res.status(200).send(buf);
  } catch (err: any) {
    console.error("logo error", err);
    res.status(500).json({ error: "unexpected error" });
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
