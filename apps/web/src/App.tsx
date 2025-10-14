import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

/**
 * personal-quant — Single Page App wireframe (mocked data)
 * Tech: React + TypeScript + Tailwind + Framer Motion
 *
 * What this renders:
 * - Centered Title + Ticker Input (initial state)
 * - On submit: title animates to top-left, input animates to top-right
 * - Below, a wireframe dashboard for stock info (mock data)
 * - No AI analysis yet (placeholder section left for future work)
 *
 * Notes:
 * - Keep this file self-contained for easy copy/paste into a Vite React TS app.
 * - Tailwind classes assume base Tailwind setup.
 * - All data is mocked; replace fetchMockQuote with real Polygon calls later.
 */

// ---- types (can be moved to packages/shared later) ----
export type TickerQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number; // absolute change
  changePct: number; // percentage change
  dayHigh: number;
  dayLow: number;
  prevClose: number;
  marketCap: number;
  volume: number;
  currency: string;
  asOf: string; // ISO date
};

// ---- utils (can be moved to packages/shared later) ----
const fmt = {
  num: (n: number) =>
    new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n),
  usd: (n: number) =>
    new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(n),
  pct: (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`,
  compact: (n: number) =>
    new Intl.NumberFormat(undefined, {
      notation: "compact",
      maximumFractionDigits: 2,
    }).format(n),
  time: (iso: string) => new Date(iso).toLocaleString(),
};

// ---- mock data layer ----
function fetchMockQuote(ticker: string): Promise<TickerQuote> {
  // Lightweight mock — vary the numbers a bit based on ticker hash
  const seed = [...ticker.toUpperCase()].reduce(
    (a, c) => a + c.charCodeAt(0),
    0
  );
  const base = 100 + (seed % 50);
  const change = ((seed % 7) - 3) * 0.75; // -2.25..+2.25
  const price = base + change;
  const high = price + 1.5;
  const low = price - 1.5;
  const prev = base;
  const mc = 1_000_000_000 * (5 + (seed % 100));
  const vol = 10_000_000 + (seed % 1_000_000);
  return new Promise((resolve) =>
    setTimeout(
      () =>
        resolve({
          symbol: ticker.toUpperCase(),
          name: `${ticker.toUpperCase()} Corp`,
          price,
          change,
          changePct: (change / prev) * 100,
          dayHigh: high,
          dayLow: low,
          prevClose: prev,
          marketCap: mc,
          volume: vol,
          currency: "USD",
          asOf: new Date().toISOString(),
        }),
      450
    )
  );
}

// ---- main SPA component ----
export default function PersonalQuantApp() {
  const [ticker, setTicker] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<TickerQuote | null>(null);

  async function onSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!ticker.trim()) return;
    setSubmitted(true);
    setLoading(true);
    const data = await fetchMockQuote(ticker.trim());
    setQuote(data);
    setLoading(false);
  }

  // color token for up/down
  const up = quote && quote.change >= 0;

  return (
    <div className="min-h-screen w-full bg-gray-50 text-gray-900 overflow-hidden relative">
      {/* background grid / aesthetics */}
      <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_center,white,transparent_70%)]">
        <GridBackdrop />
      </div>

      {/* top chrome (invisible until submitted) */}
      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-16 bg-white/70 backdrop-blur"
          >
            <div className="h-full flex items-center justify-between px-4 md:px-6">
              {/* Title animates into top-left corner */}
              <motion.h1
                layoutId="title"
                className="text-lg md:text-xl font-semibold tracking-tight text-gray-900"
              >
                personal-quant
              </motion.h1>

              {/* Input animates into top-right corner */}
              <motion.form
                layoutId="search"
                onSubmit={onSubmit}
                className="flex gap-2 items-center"
              >
                <TickerInput value={ticker} onChange={setTicker} />
                <SubmitButton loading={loading} label="Analyze" />
              </motion.form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* center stage: initial hero */}
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
                    personal-quant
                  </motion.h1>
                  <p className="mt-3 text-sm md:text-base text-gray-500">
                    Your single‑page AI stock assistant (mocked for now)
                  </p>

                  <motion.form
                    layoutId="search"
                    onSubmit={onSubmit}
                    className="mt-8 mx-auto flex w-full max-w-xl items-center gap-2"
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

      {/* dashboard zone */}
      <AnimatePresence>
        {submitted && (
          <motion.main
            key="dashboard"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.4 }}
            className="relative z-0 pt-20 pb-24"
          >
            <div className="mx-auto max-w-6xl px-4 md:px-6 grid gap-6 md:gap-8 md:grid-cols-3">
              {/* LEFT COLUMN (wider) */}
              <section className="md:col-span-2 grid gap-6">
                {/* Price card */}
                <Card>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-500">
                        {quote ? quote.symbol : "TICKER"}
                      </div>
                      <div className="text-xl md:text-2xl font-semibold">
                        {quote ? quote.name : "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl md:text-3xl font-bold text-gray-900">
                        {quote ? fmt.usd(quote.price) : "—"}
                      </div>
                      <div
                        className={
                          "text-sm " +
                          (up ? "text-emerald-600" : "text-rose-600")
                        }
                      >
                        {quote
                          ? `${fmt.usd(quote.change)} · ${fmt.pct(quote.changePct)}`
                          : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4">
                    <Sparkline loading={loading} value={quote?.price ?? 0} />
                  </div>
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
                      value={quote ? fmt.compact(quote.volume) : "—"}
                    />
                  </div>
                  <div className="mt-3 text-xs text-gray-500">
                    As of {quote ? fmt.time(quote.asOf) : "—"}{" "}
                    {quote?.currency ?? ""}
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
                      value={quote ? fmt.usd(quote.marketCap) : "—"}
                    />
                    <KeyStat label="52W High" value="—" muted />
                    <KeyStat label="52W Low" value="—" muted />
                    <KeyStat label="P/E (TTM)" value="—" muted />
                    <KeyStat label="EPS (TTM)" value="—" muted />
                    <KeyStat label="Dividend Yield" value="—" muted />
                  </div>
                </Card>

                {/* Placeholder: Price History/Chart area */}
                <Card>
                  <h3 className="text-base md:text-lg font-semibold mb-4">
                    Price history (placeholder)
                  </h3>
                  <div className="h-56 md:h-72 rounded-xl border border-dashed border-gray-300 grid place-items-center text-gray-500">
                    Add your chart component here
                  </div>
                </Card>
              </section>

              {/* RIGHT COLUMN */}
              <section className="grid gap-6">
                {/* Company Profile */}
                <Card>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    Company profile
                  </h3>
                  <p className="text-sm text-gray-500 leading-relaxed">
                    {quote
                      ? `${quote.name} engages in doing interesting things related to its sector. This is placeholder copy for a company description sourced from your data provider.`
                      : "Enter a ticker above to load a mocked company profile."}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                    <KeyStat label="Currency" value={quote?.currency ?? "—"} />
                    <KeyStat label="Exchange" value="—" muted />
                    <KeyStat label="Sector" value="—" muted />
                    <KeyStat label="Industry" value="—" muted />
                  </div>
                </Card>

                {/* Recent News (placeholder) */}
                <Card>
                  <h3 className="text-base md:text-lg font-semibold mb-2">
                    Recent news (placeholder)
                  </h3>
                  <div className="space-y-3">
                    <NewsItem />
                    <NewsItem />
                    <NewsItem />
                  </div>
                </Card>

                {/* AI Analysis placeholder */}
                <Card variant="outlined">
                  <h3 className="text-base md:text-lg font-semibold mb-1">
                    AI analysis
                  </h3>
                  <p className="text-sm text-gray-500">
                    Coming soon — plug in your model/agent here.
                  </p>
                </Card>
              </section>
            </div>
          </motion.main>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---- atoms & small components ----
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
      placeholder="Enter ticker (e.g., AAPL)"
      value={value}
      onChange={(e) => onChange(e.target.value.toUpperCase())}
      className="w-full flex-1 rounded-xl bg-white border border-gray-300 px-4 py-3 text-gray-900 placeholder:text-gray-400 outline-none ring-0 focus:border-slate-500"
    />
  );
}

function SubmitButton({
  loading,
  label = "Go",
}: {
  loading: boolean;
  label?: string;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="rounded-xl px-5 py-3 bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold shadow-md"
    >
      {loading ? "Loading…" : label}
    </button>
  );
}

function Card({
  children,
  variant = "filled",
}: {
  children: React.ReactNode;
  variant?: "filled" | "outlined";
}) {
  const base = "rounded-2xl p-4 md:p-6";
  const style =
    variant === "outlined"
      ? "border border-gray-200 bg-white/60"
      : "bg-white ring-1 ring-gray-200 shadow-xl shadow-black/5";
  return <div className={`${base} ${style}`}>{children}</div>;
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
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

function NewsItem() {
  return (
    <div className="p-3 rounded-xl border border-dashed border-gray-300">
      <div className="text-sm font-medium">Headline goes here</div>
      <div className="text-xs text-gray-500">Publisher · 2h ago</div>
    </div>
  );
}

function Sparkline({ loading, value }: { loading: boolean; value: number }) {
  // A super simple animated sparkline placeholder
  const points = useMemo(() => {
    const base = Array.from(
      { length: 24 },
      (_, i) => 50 + Math.sin(i / 2) * 18
    );
    const jitter = base.map((v, i) => v + ((i * 7) % 9) - 4);
    return jitter;
  }, [value]);

  return (
    <div className="h-28">
      <svg viewBox="0 0 240 80" className="w-full h-full">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-gray-400"
          points={points
            .map((y, i) => `${(i * 240) / (points.length - 1)},${80 - y}`)
            .join(" ")}
        />
      </svg>
      {loading && (
        <div className="text-xs text-gray-500 mt-1">Loading mocked data…</div>
      )}
    </div>
  );
}

function GridBackdrop() {
  return (
    <svg className="absolute inset-0 w-full h-full" aria-hidden>
      <defs>
        <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path
            d="M 32 0 L 0 0 0 32"
            fill="none"
            stroke="rgb(209 213 219 / 0.7)"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#grid)" />
    </svg>
  );
}
