// apps/web/src/lib/timeSeries.ts
export type Candle = {
  t: number; // ms since epoch
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

export type LinePoint = { t: number; y: number };

export function generateMockCandles(seed = 123, days = 120): Candle[] {
  // deterministic-ish walk for now; replace with Polygon aggregates later
  let price = 100 + (seed % 40);
  const out: Candle[] = [];
  const now = Date.now();
  for (let i = days - 1; i >= 0; i--) {
    const t = now - i * 24 * 60 * 60 * 1000;
    const drift = ((seed % 7) - 3) * 0.04;
    const noise = Math.sin((i + seed) / 3) * 0.7;
    const o = price;
    const c = Math.max(1, o + drift + noise);
    const h = Math.max(o, c) + Math.random() * 0.8;
    const l = Math.min(o, c) - Math.random() * 0.8;
    const v = 1_000_000 + ((i * 13) % 250_000);
    price = c;
    out.push({ t, o, h, l, c, v });
  }
  return out;
}

export function toLine(points: Candle[]): LinePoint[] {
  return points.map((p) => ({ t: p.t, y: p.c }));
}
