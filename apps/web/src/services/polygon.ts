// apps/web/src/services/polygon.ts
export type Agg = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

const USE_MOCK = false;

const API_BASE = "http://localhost:8787";

const API = async (
  path: string,
  params?: Record<string, string | number | boolean>
) => {
  const q = params ? "?" + new URLSearchParams(params as any).toString() : "";
  const res = await fetch(API_BASE + path + q);
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // no body
  }
  if (!res.ok || data?.status === "ERROR") {
    const msg = data?.error ?? res.statusText ?? "Request failed";
    throw new Error(`[API] ${path} -> ${msg}`);
  }
  return data;
};

// Mocks (if you still want them available)
async function mockAggregates(ticker: string) {
  const { generateMockCandles } = await import("../lib/timeSeries");
  return generateMockCandles(ticker.charCodeAt(0), 120).map((c) => ({
    t: c.t,
    o: c.o,
    h: c.h,
    l: c.l,
    c: c.c,
    v: c.v,
  }));
}
async function mockDetails(ticker: string) {
  return {
    results: {
      name: `${ticker.toUpperCase()} Corp`,
      ticker: ticker.toUpperCase(),
      market_cap: 250_000_000_000,
      currency_name: "USD",
      industry: "Technology",
    },
  };
}
async function mockNews() {
  return {
    results: [
      {
        id: "1",
        title: "Placeholder headline",
        publisher: { name: "Newswire" },
        published_utc: new Date().toISOString(),
      },
    ],
  };
}

// LIVE (proxied)
export async function getAggregates(ticker: string, from: string, to: string) {
  if (USE_MOCK) return mockAggregates(ticker);
  return API("/api/stocks/aggregates", {
    ticker,
    from,
    to,
    timespan: "day",
    adjusted: true,
    sort: "asc",
    limit: 5000,
  });
}

export async function getDetails(ticker: string) {
  if (USE_MOCK) return mockDetails(ticker);
  return API("/api/stocks/details", { ticker });
}

export async function getNews(ticker?: string) {
  if (USE_MOCK) return mockNews();
  return API("/api/stocks/news", { ticker: ticker ?? "", limit: 10 });
}

export async function getPreviousDay(ticker: string) {
  if (USE_MOCK) {
    const { generateMockCandles } = await import("../lib/timeSeries");
    const [last] = generateMockCandles(ticker.charCodeAt(0), 1);
    // match polygon-ish shape
    return {
      results: [
        { T: ticker, o: last.o, h: last.h, l: last.l, c: last.c, v: last.v },
      ],
    };
  }
  const resp = await API("/api/stocks/prev", { ticker });
  // 🔧 normalize: results may be an array
  const arr = Array.isArray(resp?.results)
    ? resp.results
    : resp?.results
      ? [resp.results]
      : [];
  return { results: arr };
}

// add types
export type TickerDetails = {
  name?: string;
  ticker?: string;
  market_cap?: number;
  currency_name?: string;
  primary_exchange?: string;
  industry?: string;
  homepage_url?: string;
};

export type NewsItem = {
  id: string;
  title: string;
  publisher?: string;
  published_utc?: string;
  article_url?: string;
};

// normalize details (works for mock OR live)
export async function getDetailsNormalized(
  ticker: string
): Promise<TickerDetails> {
  const raw = await getDetails(ticker);
  const r = raw?.results ?? raw; // mock returns {results:{...}}
  return {
    name: r?.name,
    ticker: r?.ticker,
    market_cap: r?.market_cap,
    currency_name: r?.currency_name,
    primary_exchange: r?.primary_exchange ?? r?.primary_exchange_symbol,
    industry: r?.industry ?? r?.sic_description,
    homepage_url: r?.homepage_url,
  };
}

// normalize news
export async function getNewsNormalized(ticker?: string): Promise<NewsItem[]> {
  const raw = await getNews(ticker);
  const arr = raw?.results ?? [];
  return arr.map((n: any) => ({
    id: String(n.id ?? n.uuid ?? crypto.randomUUID()),
    title: n.title,
    publisher: n.publisher?.name ?? n.source,
    published_utc: n.published_utc,
    article_url: n.article_url ?? n.url,
  }));
}
