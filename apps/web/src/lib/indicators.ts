// apps/web/src/lib/indicators.ts
export type Num = number;
export type SeriesPoint = { t: number; y: number };

/** Simple Moving Average */
export function sma(values: Num[], period: number): (number | null)[] {
  const out = Array<number | null>(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential Moving Average (seeded by SMA of first `period`) */
export function ema(values: Num[], period: number): (number | null)[] {
  const out = Array<number | null>(values.length).fill(null);
  if (period <= 0) return out;
  const k = 2 / (period + 1);

  // seed with SMA
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (i < period) {
      sum += v;
      if (i === period - 1) {
        const seed = sum / period;
        out[i] = seed;
      }
    } else {
      const prev = out[i - 1] as number;
      const next = v * k + prev * (1 - k);
      out[i] = next;
    }
  }
  return out;
}

/** MACD (returns full series; last values can be read with `.at(-1)`) */
export function macd(values: Num[], fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);

  const line = values.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i]! - emaSlow[i]! : null
  );

  // signal EMA ignores leading nulls by feeding only defined segments
  const sig = ema(
    line.map((v) => (v == null ? (line.find((x) => x != null) ?? 0) : v)),
    signal
  );

  const hist = line.map((v, i) =>
    v != null && sig[i] != null ? v - (sig[i] as number) : null
  );

  return { line, signal: sig, hist };
}

/** RSI (Wilder’s smoothing) */
export function rsi(values: Num[], period = 14): (number | null)[] {
  const out = Array<number | null>(values.length).fill(null);
  if (values.length < 2 || period <= 0) return out;

  let gainSum = 0;
  let lossSum = 0;

  // seed
  for (let i = 1; i <= period && i < values.length; i++) {
    const ch = values[i] - values[i - 1];
    if (ch >= 0) gainSum += ch;
    else lossSum += -ch;
  }

  if (values.length > period) {
    const avgGain = gainSum / period;
    const avgLoss = lossSum / period;
    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    out[period] = 100 - 100 / (1 + rs);

    // smooth forward
    let prevAvgGain = avgGain;
    let prevAvgLoss = avgLoss;
    for (let i = period + 1; i < values.length; i++) {
      const ch = values[i] - values[i - 1];
      const g = Math.max(ch, 0);
      const l = Math.max(-ch, 0);
      prevAvgGain = (prevAvgGain * (period - 1) + g) / period;
      prevAvgLoss = (prevAvgLoss * (period - 1) + l) / period;
      const rs2 = prevAvgLoss === 0 ? Infinity : prevAvgGain / prevAvgLoss;
      out[i] = 100 - 100 / (1 + rs2);
    }
  }

  return out;
}

export function summarizeIndicators(closes: Num[]) {
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const sma200 = sma(closes, 200);
  const ema20 = ema(closes, 20);
  const ema50 = ema(closes, 50);
  const ema200 = ema(closes, 200);
  const macdVals = macd(closes, 12, 26, 9);
  const rsi14 = rsi(closes, 14);

  return {
    lastClose: closes.at(-1) ?? null,
    sma20: sma20.at(-1) ?? null,
    sma50: sma50.at(-1) ?? null,
    sma200: sma200.at(-1) ?? null,
    ema20: ema20.at(-1) ?? null,
    ema50: ema50.at(-1) ?? null,
    ema200: ema200.at(-1) ?? null,
    macd: {
      line: macdVals.line.at(-1) ?? null,
      signal: macdVals.signal.at(-1) ?? null,
      hist: macdVals.hist.at(-1) ?? null,
    },
    rsi14: rsi14.at(-1) ?? null,
  };
}
