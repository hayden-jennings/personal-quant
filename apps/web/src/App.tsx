// apps/web/src/App.tsx
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PriceHistoryChart } from "./components/PriceHistoryChart";
import {
  getAggregates,
  getDetailsNormalized,
  getNewsNormalized,
  getPreviousDay,
  logoUrlFor,
} from "./services/polygon";
import type { TickerDetails as PolyDetails } from "./services/polygon";
import search from "./assets/search.svg";
import { summarizeIndicators } from "./lib/indicators";
import {
  buildAIPayload,
  type AIIndicators,
  type AIPayload,
} from "./lib/aiPayload";

// ---- types ----
export type TickerQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  marketCap: number;
  volume: number;
  currency: string;
  asOf: string;
};

// ---- formatters ----
const fmt = {
  usd: (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n),
  usdCompact: (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n),
  compactNum: (n: number) =>
    new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  time: (iso: string) => new Date(iso).toLocaleString(),
};

// ---- main SPA component ----
export default function StockSearchApp() {
  const [ticker, setTicker] = useState("");
  const [symbol, setSymbol] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<TickerQuote | null>(null);
  const [chartData, setChartData] = useState<{ t: number; y: number }[]>([]);
  const [details, setDetails] = useState<PolyDetails | null>(null);
  const [news, setNews] = useState<any[] | null>(null);
  const [indicators, setIndicators] = useState<AIIndicators | null>(null);
  const [aiPayload, setAiPayload] = useState<AIPayload | null>(null);

  const [yearStats, setYearStats] = useState<{
    high: number;
    low: number;
  } | null>(null);
  const [oneYearReturn, setOneYearReturn] = useState<number | null>(null);
  const [avgVolume, setAvgVolume] = useState<number | null>(null);

  function onSubmit(e?: React.FormEvent) {
    console.log("Submit", ticker, e);
    e?.preventDefault();
    const nextTicker = ticker.trim().toUpperCase();
    if (!nextTicker) return;
    setSubmitted(true);
    setAiPayload(null);  
    setSymbol(nextTicker);
  }

  useEffect(() => {
    const sym = symbol;
    if (!sym) return;

    setLoading(true);
    setQuote(null);
    setDetails(null);
    setNews(null);
    setYearStats(null);
    setOneYearReturn(null);
    setAvgVolume(null);
    setChartData([]);

    const to = new Date();
    const from = new Date(to);
    from.setDate(to.getDate() - 365 * 2);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    // Fetch aggregates first (chart + stats)
    (async () => {
      try {
        const aggResp = await getAggregates(sym, iso(from), iso(to));
        const rows: any[] = Array.isArray(aggResp)
          ? aggResp
          : (aggResp?.results ?? []);

        const highs = rows.map((r) => r.h ?? r.c);
        const lows = rows.map((r) => r.l ?? r.c);
        if (highs.length && lows.length) {
          setYearStats({ high: Math.max(...highs), low: Math.min(...lows) });
        }

        if (rows.length >= 2) {
          const firstClose = rows[0].c ?? rows[0].o;
          const lastClose = rows.at(-1).c ?? rows.at(-1).o;
          setOneYearReturn(
            firstClose && lastClose
              ? ((lastClose - firstClose) / firstClose) * 100
              : null
          );
        }

        const vols = rows.map((r) => Number(r.v) || 0);
        const last90 = vols.slice(-90);
        setAvgVolume(
          last90.length
            ? last90.reduce((a, b) => a + b, 0) / last90.length
            : null
        );

        const all = rows.map((r: any) => ({ t: r.t ?? r.timestamp, y: r.c }));
        setChartData(all);

        const closes = all.map((p) => p.y);
        setIndicators(summarizeIndicators(closes));
      } catch {
        setYearStats(null);
        setOneYearReturn(null);
        setAvgVolume(null);
        setChartData([]);
      }
    })();

    // Fetch remaining in parallel
    (async () => {
      try {
        const [detailsRes, newsRes, prevRes] = await Promise.allSettled([
          getDetailsNormalized(sym),
          getNewsNormalized(sym),
          getPreviousDay(sym),
        ]);

        if (detailsRes.status === "fulfilled") setDetails(detailsRes.value);
        if (newsRes.status === "fulfilled") setNews(newsRes.value);

        if (prevRes.status === "fulfilled") {
          const bar = Array.isArray(prevRes.value?.results)
            ? prevRes.value.results[0]
            : undefined;
          if (bar) {
            setQuote({
              symbol: sym,
              name: sym, // details may refine later
              price: bar.c,
              change: bar.c - bar.o,
              changePct: ((bar.c - bar.o) / bar.o) * 100,
              dayHigh: bar.h,
              dayLow: bar.l,
              prevClose: bar.o,
              marketCap: 0,
              volume: bar.v,
              currency: "USD",
              asOf: new Date().toISOString(),
            });
          }
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [symbol]);

  useEffect(() => {
    if (!symbol || !chartData.length || !quote || !indicators) {
      setAiPayload(null);
      return;
    }
    const nowISO = new Date().toISOString();
    setAiPayload(
      buildAIPayload({
        ticker: symbol, // <-- committed symbol
        nowISO,
        quote: {
          price: quote.price,
          change: quote.change,
          changePct: quote.changePct,
          dayHigh: quote.dayHigh,
          dayLow: quote.dayLow,
          prevClose: quote.prevClose,
          volume: quote.volume,
          currency: quote.currency,
        },
        details,
        yearStats,
        oneYearReturn,
        avgVolume,
        indicators,
        chartData,
        news: news ?? [],
      })
    );
  }, [
    symbol, // <-- use symbol, not ticker
    chartData,
    quote,
    details,
    yearStats,
    oneYearReturn,
    avgVolume,
    indicators,
    news,
  ]);

  const up = !!quote && quote.change >= 0;

  return (
    <div className="min-h-screen w-full bg-gray-100 text-gray-900 overflow-hidden relative">
      {/* background grid */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_80%)]">
        <GridBackdrop />
      </div>

      {/* top chrome */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            // was: "absolute top-0 left-0 right-0 h-16 ..."
            className="fixed top-0 left-0 right-0 z-50 h-16 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/60"
          >
            <div className="h-full flex items-center justify-between px-4 md:px-6 pointer-events-auto">
              <motion.h1
                layoutId="title"
                className="text-lg md:text-xl font-semibold tracking-tight text-gray-900"
              >
                stock.ai
              </motion.h1>

              <motion.form
                layoutId="search"
                onSubmit={onSubmit}
                className="flex gap-2 items-center"
              >
                <TickerInput value={ticker} onChange={setTicker} />
                <SubmitButton loading={loading} />
              </motion.form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* hero */}
      <div
        className={
          submitted
            ? "hidden"
            : "relative z-10 flex items-center justify-center min-h-screen"
        }
      >
        <div className="w-full max-w-3xl px-6">
          <div className="relative">
            <AnimatePresence>
              {!submitted && (
                <motion.div
                  key="hero"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ duration: 0.5 }}
                  className="text-center"
                >
                  <motion.h1
                    layoutId="title"
                    className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900"
                  >
                    stock.ai
                  </motion.h1>
                  <p className="mt-3 text-sm md:text-base text-gray-500">
                    Your AI stock assistant
                  </p>

                  <motion.form
                    layoutId="search"
                    onSubmit={onSubmit}
                    className="relative isolate mt-8 mx-auto flex w-full max-w-xl items-center gap-2 z-0"
                  >
                    <TickerInput
                      value={ticker}
                      onChange={setTicker}
                      autoFocus
                    />
                    <SubmitButton loading={loading} />
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* dashboard */}
      <AnimatePresence>
        {submitted && (
          <motion.main
            key="dashboard"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4 }}
            className="relative z-0 pt-30 pb-24"
          >
            <div className="mx-auto max-w-6xl px-4 md:px-6 grid gap-6 md:gap-8 md:grid-cols-3">
              {/* AI Analysis */}
              <Card variant="outlined" className="md:col-span-3">
                <h3 className="text-base md:text-lg font-semibold mb-1">
                  AI analysis
                </h3>
                <p className="text-sm text-gray-500">
                  Coming soon — plug in your model/agent here.
                </p>
              </Card>
              {aiPayload && (
                <Card variant="outlined" className="md:col-span-3">
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    AI payload (debug)
                  </h3>
                  <pre className="text-xs whitespace-pre-wrap break-all max-h-64 overflow-auto">
                    {JSON.stringify(aiPayload, null, 2)}
                  </pre>
                </Card>
              )}
              {/* LEFT */}
              <section className="md:col-span-2 grid gap-6">
                {/* Price card */}
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {symbol ? (
                        <img
                          src={logoUrlFor(symbol)}
                          alt={`${details?.name ?? symbol} logo`}
                          className="h-8 w-8 object-contain"
                          onError={(e) => {
                            (
                              e.currentTarget as HTMLImageElement
                            ).style.display = "none";
                          }}
                        />
                      ) : null}

                      <div>
                        <div className="text-sm text-gray-500">
                          {quote ? quote.symbol : (symbol ?? "TICKER")}
                        </div>
                        <div className="text-xl md:text-2xl font-semibold">
                          {quote ? quote.name : (symbol ?? "—")}
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-2xl md:text-4xl font-bold text-gray-900 leading-none">
                        {quote ? fmt.usd(quote.price) : "—"}
                      </div>
                      <div
                        className={
                          "mt-1 inline-flex items-center gap-2 py-1 text-sm " +
                          (!!quote && quote.change >= 0
                            ? "text-emerald-700"
                            : "text-rose-700")
                        }
                        title="Change since open"
                      >
                        <span>{quote ? fmt.usd(quote.change) : "—"}</span>
                        <span className="text-gray-400">·</span>
                        <span>{quote ? fmt.pct(quote.changePct) : "—"}</span>
                      </div>
                      <div className="mt-1 text-xs text-gray-500">
                        As of {quote ? fmt.time(quote.asOf) : "—"}{" "}
                        {quote?.currency ?? ""}
                      </div>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="mb-15 mt-3">
                    {chartData.length ? (
                      <PriceHistoryChart data={chartData} />
                    ) : (
                      <div className="h-48 grid place-items-center text-sm text-gray-500">
                        No price data
                      </div>
                    )}
                  </div>

                  {/* Stats row */}
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-gray-500">
                    <Stat
                      label="Day High"
                      value={quote ? fmt.usd(quote.dayHigh) : "—"}
                    />
                    <Stat
                      label="Day Low"
                      value={quote ? fmt.usd(quote.dayLow) : "—"}
                    />
                    <Stat
                      label="Prev Close"
                      value={quote ? fmt.usd(quote.prevClose) : "—"}
                    />
                    <Stat
                      label="Volume"
                      value={quote ? fmt.compactNum(quote.volume) : "—"}
                    />
                  </div>
                </Card>

                {/* Key Stats */}
                <Card>
                  <h3 className="text-base md:text-lg font-semibold mb-4">
                    Key stats
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <KeyStat
                      label="Market Cap"
                      value={
                        details?.market_cap
                          ? fmt.usdCompact(details.market_cap)
                          : quote
                            ? fmt.usdCompact(quote.marketCap)
                            : "—"
                      }
                    />
                    <KeyStat
                      label="52W High"
                      value={yearStats ? fmt.usd(yearStats.high) : "—"}
                    />
                    <KeyStat
                      label="52W Low"
                      value={yearStats ? fmt.usd(yearStats.low) : "—"}
                    />
                    <KeyStat
                      label="1Y Return"
                      value={
                        oneYearReturn != null
                          ? `${oneYearReturn >= 0 ? "+" : ""}${oneYearReturn.toFixed(2)}%`
                          : "—"
                      }
                    />
                    <KeyStat
                      label="Avg Volume (90d)"
                      value={
                        avgVolume != null ? fmt.compactNum(avgVolume) : "—"
                      }
                    />
                  </div>
                </Card>
              </section>

              {/* RIGHT */}
              <section className="flex flex-col gap-6 md:max-h-[calc(100vh-16rem)]">
                <Card>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    Company profile
                  </h3>
                  {details ? (
                    <>
                      <p className="text-sm text-gray-500 leading-relaxed">
                        <span className="font-medium text-gray-900">
                          {details.name ?? symbol ?? "—"}
                        </span>
                        {details.industry ? ` · ${details.industry}` : ""}
                        {details.primary_exchange
                          ? ` · ${details.primary_exchange}`
                          : ""}
                      </p>
                      <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                        <KeyStat label="Ticker" value={details.ticker ?? "—"} />
                        <KeyStat
                          label="Market Cap"
                          value={
                            details.market_cap
                              ? fmt.usdCompact(details.market_cap)
                              : "—"
                          }
                        />
                        <KeyStat
                          label="Currency"
                          value={
                            details.currency_name ?? quote?.currency ?? "—"
                          }
                        />
                        <KeyStat
                          label="Website"
                          value={
                            details.homepage_url ? (
                              <a
                                href={details.homepage_url}
                                target="_blank"
                                rel="noreferrer"
                                className="underline"
                              >
                                {new URL(details.homepage_url).hostname}
                              </a>
                            ) : (
                              "—"
                            )
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Loading profile…
                    </div>
                  )}
                </Card>

                <Card className="flex flex-col min-h-0">
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    Recent news
                  </h3>
                  {!news && (
                    <div className="text-sm text-gray-500">Loading news…</div>
                  )}
                  {news && news.length === 0 && (
                    <div className="text-sm text-gray-500">
                      No recent articles found.
                    </div>
                  )}
                  {news && news.length > 0 && (
                    <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
                      {news.slice(0, 30).map((n) => (
                        <a
                          key={n.id}
                          href={n.article_url}
                          target="_blank"
                          rel="noreferrer"
                          className="block p-3 rounded-xl border border-dashed border-gray-300 hover:bg-gray-50"
                        >
                          <div className="text-sm font-medium">{n.title}</div>
                          <div className="text-xs text-gray-500">
                            {n.publisher ?? "—"} ·{" "}
                            {n.published_utc
                              ? new Date(n.published_utc).toLocaleString()
                              : "—"}
                          </div>
                        </a>
                      ))}
                    </div>
                  )}
                </Card>
              </section>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- atoms ----
function TickerInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <input
      autoFocus={autoFocus}
      placeholder="Find company..."
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className={`
        relative z-10 w-full flex-1 rounded-xl
        bg-white/20 backdrop-blur-md
        border border-white/40
        text-gray-900 text-gray-400
        px-4 py-3
        shadow-xl shadow-black/20
        transition-all duration-300
        focus:bg-white/50 focus:border-white/100
        outline-none
      `}
    />
  );
}

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className={`
        relative z-9 flex items-center justify-center
        w-12 h-12 rounded-xl
        backdrop-blur-md bg-white/20
        border border-white/40
        shadow-[0_10px_25px_rgba(0,0,0,0.3)]
        transition-all duration-300
        hover:bg-white/50 hover:scale-105 hover:shadow-[0_12px_30px_rgba(0,0,0,0.4)]
        active:scale-95
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      {loading ? (
        <span className="text-xs text-gray-300 animate-pulse">Loading…</span>
      ) : (
        <img
          src={search}
          alt="Search"
          className="w-6 h-6 opacity-90 transition-opacity"
        />
      )}
    </button>
  );
}

function Card({
  children,
  variant = "filled",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "filled" | "outlined";
  className?: string;
}) {
  const base = "rounded-2xl p-4 md:p-6";
  const style =
    variant === "outlined"
      ? "border border-gray-200 bg-white/60"
      : "bg-white ring-1 ring-gray-200 shadow-xl shadow-black/5";
  return <div className={`${base} ${style} ${className}`}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-700 font-medium">{value}</span>
    </div>
  );
}

function KeyStat({
  label,
  value,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm ${muted ? "text-gray-500" : "text-gray-900"}`}>
        {value}
      </div>
    </div>
  );
}

function GridBackdrop() {
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden>
      <defs>
        <pattern id="grid" width="38" height="38" patternUnits="userSpaceOnUse">
          <path
            d="M 38 0 L 0 0 0 38"
            fill="none"
            stroke="gray"
            strokeOpacity="0.3"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}
