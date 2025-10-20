// apps/web/src/services/ai.ts
const API_BASE = "http://localhost:8787";

// apps/web/src/services/ai.ts
export type AIAnalysis = {
  ok: boolean;
  source?: "mock" | "openai";
  analysis?: {
    ticker?: string;

    stance: "bullish" | "bearish" | "neutral" | string;
    confidence: number; // 0..1

    summary: string; // short thesis
    highlights: string[]; // key bullets

    // NEW, all optional
    rationale_long?: string[]; // multi-paragraph rationale, split into paragraphs
    catalysts?: string[]; // upcoming events
    scenarios?: {
      // scenario analysis
      bull?: { prob?: number; target?: string; drivers?: string[] };
      base?: { prob?: number; target?: string; drivers?: string[] };
      bear?: { prob?: number; target?: string; drivers?: string[] };
    };
    valuation?: {
      // simple valuation snapshot
      multiples?: { name: string; value: string; peer_range?: string }[];
      notes?: string[];
    };
    playbook?: {
      // how to act on it
      entry?: string; // e.g., "accumulate near 195–198"
      exits?: string[]; // profit targets
      invalidation?: string; // where thesis breaks
      position?: string; // position sizing / % risk
      timeframe?: string; // short/mid/long
    };
    watchlist?: string[]; // “what to watch” signals

    technical: {
      supports: string[];
      resistances: string[];
      signals: { name: string; status: string }[];
    };

    actions: string[]; // high-impact actions
    risks: string[]; // material risks

    horizon: string;
    asOf?: string;

    disclaimers: string[];

    // optional provenance / caveats
    confidence_notes?: string[];
    data_used?: string[]; // short lines summarizing what inputs were considered
  };
  error?: string;
};

export async function analyzeStock(payload: any): Promise<AIAnalysis> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20000); // 20s

  try {
    const r = await fetch(`${API_BASE}/api/ai/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let json: any = null;
    try {
      json = await r.json();
    } catch {
      json = { ok: false, error: "Invalid JSON from /api/ai/analyze" };
    }

    if (!r.ok || !json?.ok) {
      return {
        ok: false,
        error: json?.error || `AI error ${r.status}`,
      };
    }

    return json as AIAnalysis;
  } catch (err: any) {
    const msg =
      err?.name === "AbortError"
        ? "AI request timed out"
        : err?.message || "Network error";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(t);
  }
}
