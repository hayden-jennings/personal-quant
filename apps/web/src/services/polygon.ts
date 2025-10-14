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
const API = (
  path: string,
  params?: Record<string, string | number | boolean>
) => {
  const q = params ? "?" + new URLSearchParams(params as any).toString() : "";
  return fetch(path + q).then((r) => r.json());
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
