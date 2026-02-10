import "dotenv/config";
import express from "express";
import cors from "cors";

import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const app = express();
const PORT = process.env.PORT || 8787;

app.use(cors());
app.use(express.json());

// Health check
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

app.post("/api/ai/analyze", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res
        .status(503)
        .json({ ok: false, error: "Missing OPENAI_API_KEY on server" });
    }

    const raw = (req.body ?? {}) as any;
    const trimmed = {
      ...raw,
      series: raw?.series
        ? {
            ...raw.series,
            points: Array.isArray(raw.series.points)
              ? raw.series.points.slice(-300)
              : [],
          }
        : undefined,
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const prompt = [
      {
        role: "system",
        content:
          "You are a cautious, concise-but-thorough equities analyst. Provide clear caveats, quantify when possible, avoid certainty.",
      },
      {
        role: "user",
        content: `Analyze the following stock snapshot and return structured JSON.
        Required:
        - stance: "bullish" | "bearish" | "neutral"
        - confidence: number (0..1)
        - summary: 2-3 sentences
        - highlights: string[]
        - technical: { supports: string[], resistances: string[], signals: { name: string, status: string }[] }
        - actions: string[] (1–3 bullets)
        - risks: string[] (1–3 bullets)
        - horizon: string
        - disclaimers: string[]

        (include when useful to justify actions financially):
        - rationale_long: string[] (2–4 short paragraphs; plain text, no markdown)
        - scenarios: {
            bull?: { prob?: number (0..1), target?: string, drivers?: string[] },
            base?: { prob?: number, target?: string, drivers?: string[] },
            bear?: { prob?: number, target?: string, drivers?: string[] }
          }
        - valuation: {
            multiples?: { name: string, value: string, peer_range?: string }[],
            notes?: string[]
          }
        - playbook?: {
            entry?: string, exits?: string[], invalidation?: string,
            position?: string, timeframe?: string
          }
        - watchlist?: string[]  // signals/events to monitor
        - confidence_notes?: string[]
        - data_used?: string[]  // what key inputs you used

        Snapshot JSON:
        ${JSON.stringify(trimmed)}`,
      },
    ];

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: prompt,
        temperature: 0.2,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res
        .status(r.status)
        .json({ ok: false, source: "openai", error: text || "OpenAI error" });
    }

    const j = await r.json();
    const content = j?.choices?.[0]?.message?.content ?? "{}";
    let analysis: any = {};
    try {
      analysis = JSON.parse(content);
    } catch {
      analysis = { summary: content };
    }

    return res.json({ ok: true, source: "openai", analysis });
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "AI request timed out"
        : err?.message || "AI analysis failed";
    console.error("AI analyze error:", err);
    return res.status(500).json({ ok: false, error: msg });
  }
});

app.post("/api/ai/analyze/stream", async (req, res) => {
  try {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      return res
        .status(503)
        .end("event: error\ndata: Missing OPENAI_API_KEY\n\n");
    }

    // same trimming you already do
    const raw = (req.body ?? {}) as any;
    const trimmed = {
      ...raw,
      series: raw?.series
        ? {
            ...raw.series,
            points: Array.isArray(raw.series.points)
              ? raw.series.points.slice(-300)
              : [],
          }
        : undefined,
    };

    // Prepare messages (reuse the richer prompt from Part 1.2)
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a cautious, concise-but-thorough equities analyst. Provide clear caveats, quantify when possible, avoid certainty.",
      },
      {
        role: "user",
        content: `Analyze the following stock snapshot and return structured JSON.
Required:
- stance: "bullish" | "bearish" | "neutral"
- confidence: number (0..1)
- summary: 3-5 sentences
- highlights: string[]
- technical: { supports: string[], resistances: string[], signals: { name: string, status: string }[] }
- actions: string[] (1–5 bullets)
- risks: string[] (1–5 bullets)
- horizon: string
- disclaimers: string[]

Optional (include when useful to justify actions financially):
- rationale_long: string[] (2–6 short paragraphs; plain text, no markdown)
- scenarios: {
    bull?: { prob?: number (0..1), target?: string, drivers?: string[] },
    base?: { prob?: number, target?: string, drivers?: string[] },
    bear?: { prob?: number, target?: string, drivers?: string[] }
  }
- valuation: {
    multiples?: { name: string, value: string, peer_range?: string }[],
    notes?: string[]
  }
- playbook?: {
    entry?: string, exits?: string[], invalidation?: string,
    position?: string, timeframe?: string
  }
- watchlist?: string[]  // signals/events to monitor
- confidence_notes?: string[]
- data_used?: string[]  // what key inputs you used

Snapshot JSON:
${JSON.stringify(trimmed)}`,
      },
    ];

    // SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // Kick off streaming with the SDK (Chat Completions with stream)
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.2,
      stream: true,
      // response_format: { type: "json_object" }, // ⟵ remove if types complain
    });

    let full = "";

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        full += delta;
        // forward token(s) to client
        res.write(`event: chunk\ndata: ${JSON.stringify(delta)}\n\n`);
      }
    }

    // done
    res.write(`event: done\ndata: ${JSON.stringify(full)}\n\n`);
    res.end();
  } catch (err: any) {
    console.error("AI analyze stream error:", err);
    // try to notify client via SSE error event
    try {
      res.write(
        `event: error\ndata: ${JSON.stringify(err?.message ?? "stream error")}\n\n`
      );
      res.end();
    } catch {}
  }
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});
