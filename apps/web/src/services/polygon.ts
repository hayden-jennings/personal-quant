// apps/web/src/services/polygon.ts
export type Agg = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};
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

const API_BASE = "http://localhost:8787";
const API = (
  path: string,
  params?: Record<string, string | number | boolean>
) => {
  const q = params ? "?" + new URLSearchParams(params as any).toString() : "";
  return fetch(API_BASE + path + q).then((r) => r.json());
};

export async function getAggregates(ticker: string, from: string, to: string) {
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
export async function getPreviousDay(ticker: string) {
  return API("/api/stocks/prev", { ticker });
}
export async function getDetails(ticker: string) {
  return API("/api/stocks/details", { ticker });
}
export async function getDetailsNormalized(ticker: string) {
  const raw = await getDetails(ticker);
  const r = raw?.results ?? raw;
  return {
    name: r?.name,
    ticker: r?.ticker,
    market_cap: r?.market_cap,
    currency_name: r?.currency_name,
    primary_exchange: r?.primary_exchange ?? r?.primary_exchange_symbol,
    industry: r?.industry ?? r?.sic_description,
    homepage_url: r?.homepage_url,
  } as TickerDetails;
}
export async function getNews(ticker?: string) {
  return API("/api/stocks/news", { ticker: ticker ?? "", limit: 10 });
}
export async function getNewsNormalized(ticker?: string) {
  const raw = await getNews(ticker);
  const arr = raw?.results ?? [];
  return arr.map((n: any) => ({
    id: String(n.id ?? n.uuid ?? crypto.randomUUID()),
    title: n.title,
    publisher: n.publisher?.name ?? n.source,
    published_utc: n.published_utc,
    article_url: n.article_url ?? n.url,
  })) as NewsItem[];
}
