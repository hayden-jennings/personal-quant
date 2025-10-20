export type AINewsItem = {
  id: string;
  title: string;
  published_utc?: string;
  publisher?: string;
  article_url?: string;
};

export type AIIndicators = {
  lastClose: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;
  macd: { line: number | null; signal: number | null; hist: number | null };
  rsi14: number | null;
};

export type AIPayload = {
  ticker: string;
  asOf: string; // ISO timestamp (now)
  price: {
    last: number | null;
    change: number | null;
    changePct: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    prevClose: number | null;
    volume: number | null;
    currency?: string | null;
  };
  fundamentals: {
    name?: string | null;
    marketCap?: number | null;
    exchange?: string | null;
    industry?: string | null;
    homepage?: string | null;
  };
  stats: {
    high52w?: number | null;
    low52w?: number | null;
    return1y?: number | null; // percentage (e.g. 12.34)
    avgVolume90d?: number | null;
  };
  indicators: AIIndicators;
  series: {
    timeframe: "daily";
    points: Array<{ t: number; c: number }>;
  };
  news: AINewsItem[];
};

/** Utility: round to given decimals if number, else null */
function r(n: unknown, d = 4): number | null {
  if (typeof n !== "number" || !isFinite(n)) return null;
  const f = Math.pow(10, d);
  return Math.round(n * f) / f;
}

/** Build a compact, stable LLM-friendly payload */
export function buildAIPayload(args: {
  ticker: string;
  nowISO: string;
  quote: {
    price: number | null;
    change: number | null;
    changePct: number | null;
    dayHigh: number | null;
    dayLow: number | null;
    prevClose: number | null;
    volume: number | null;
    currency?: string | null;
  };
  details?: {
    name?: string | null;
    market_cap?: number | null;
    primary_exchange?: string | null;
    industry?: string | null;
    homepage_url?: string | null;
  } | null;
  yearStats?: { high: number; low: number } | null;
  oneYearReturn?: number | null;
  avgVolume?: number | null;
  indicators: AIIndicators | null;
  chartData: Array<{ t: number; y: number }>;
  news: AINewsItem[] | null;
}): AIPayload {
  // keep at most ~180 points (about 9 months of trading days) for token economy
  const maxPoints = 180;
  const trimmed = args.chartData
    .slice(-maxPoints)
    .map((p) => ({ t: p.t, c: p.y }));

  return {
    ticker: args.ticker.toUpperCase(),
    asOf: args.nowISO,
    price: {
      last: r(args.quote.price, 4),
      change: r(args.quote.change, 4),
      changePct: r(args.quote.changePct, 4),
      dayHigh: r(args.quote.dayHigh, 4),
      dayLow: r(args.quote.dayLow, 4),
      prevClose: r(args.quote.prevClose, 4),
      volume: r(args.quote.volume, 0),
      currency: args.quote.currency ?? null,
    },
    fundamentals: {
      name: args.details?.name ?? null,
      marketCap: r(args.details?.market_cap ?? null, 0),
      exchange: args.details?.primary_exchange ?? null,
      industry: args.details?.industry ?? null,
      homepage: args.details?.homepage_url ?? null,
    },
    stats: {
      high52w: r(args.yearStats?.high ?? null, 4),
      low52w: r(args.yearStats?.low ?? null, 4),
      return1y: r(args.oneYearReturn ?? null, 4),
      avgVolume90d: r(args.avgVolume ?? null, 0),
    },
    indicators: {
      lastClose: r(args.indicators?.lastClose ?? null, 4),
      sma20: r(args.indicators?.sma20 ?? null, 4),
      sma50: r(args.indicators?.sma50 ?? null, 4),
      sma200: r(args.indicators?.sma200 ?? null, 4),
      ema20: r(args.indicators?.ema20 ?? null, 4),
      ema50: r(args.indicators?.ema50 ?? null, 4),
      ema200: r(args.indicators?.ema200 ?? null, 4),
      macd: {
        line: r(args.indicators?.macd.line ?? null, 4),
        signal: r(args.indicators?.macd.signal ?? null, 4),
        hist: r(args.indicators?.macd.hist ?? null, 4),
      },
      rsi14: r(args.indicators?.rsi14 ?? null, 4),
    },
    series: {
      timeframe: "daily",
      points: trimmed,
    },
    news: (args.news ?? []).slice(0, 8).map((n) => ({
      id: n.id,
      title: n.title,
      published_utc: n.published_utc,
      publisher: n.publisher,
      article_url: n.article_url,
    })),
  };
}
