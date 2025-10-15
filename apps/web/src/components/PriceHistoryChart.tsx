import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

export type LinePoint = { t: number; y: number };

const fmtNum = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

const fmtDateShort = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const fmtDateWithYear = (ts: number) =>
  new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });

type RangeKey = "1W" | "1M" | "3M" | "YTD" | "1Y" | "2Y";
const RANGE_LABELS: RangeKey[] = ["1W", "1M", "3M", "YTD", "1Y", "2Y"];

const MS_DAY = 24 * 60 * 60 * 1000;
const days = (n: number) => n * MS_DAY;

function getCutoff(key: RangeKey): number | null {
  const now = new Date();
  switch (key) {
    case "1W":
      return Date.now() - days(7);
    case "1M":
      return Date.now() - days(30);
    case "3M":
      return Date.now() - days(90);
    case "YTD": {
      const d = new Date(now.getFullYear(), 0, 1); // Jan 1, local tz
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
    case "1Y":
      return Date.now() - days(365);
    case "2Y":
      return Date.now() - days(365 * 2);
  }
}

export function PriceHistoryChart({
  data,
  height = 256,
}: {
  data: LinePoint[];
  height?: number;
}) {
  const [range, setRange] = useState<RangeKey>("1Y");

  const filtered = useMemo(() => {
    if (!data?.length) return [];
    const cutoff = getCutoff(range);
    if (!cutoff) return data;
    const f = data.filter((d) => d.t >= cutoff);
    // Fallback: if nothing passed the filter (e.g., free tier limits), show whatever we got
    return f.length ? f : data;
  }, [data, range]);

  const { yMin, yMax } = useMemo(() => {
    if (!filtered || filtered.length < 2) return { yMin: 0, yMax: 1 };
    let minY = Infinity;
    let maxY = -Infinity;
    for (const d of filtered) {
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    }
    if (!isFinite(minY) || !isFinite(maxY)) return { yMin: 0, yMax: 1 };
    if (minY === maxY) {
      const pad = Math.abs(minY) * 0.05 || 1;
      return { yMin: minY - pad, yMax: maxY + pad };
    }
    const pad = (maxY - minY) * 0.1;
    return { yMin: minY - pad, yMax: maxY + pad };
  }, [filtered]);

  const longRange = range === "1Y" || range === "2Y";
  const dateFmt = longRange ? fmtDateWithYear : fmtDateShort;

  return (
    <div className="w-full" style={{ height }}>
      <div className="mb-2 flex flex-wrap gap-1">
        {RANGE_LABELS.map((rk) => (
          <button
            key={rk}
            onClick={() => setRange(rk)}
            className={
              "rounded-lg px-2.5 py-1 text-xs border transition " +
              (rk === range
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100")
            }
          >
            {rk}
          </button>
        ))}
      </div>

      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={filtered}
          margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
        >
          <CartesianGrid stroke="rgb(229 231 235)" strokeDasharray="3 3" />
          <XAxis
            dataKey="t"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={dateFmt}
            stroke="rgb(107 114 128)"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "rgb(209 213 219)" }}
            tickLine={{ stroke: "rgb(209 213 219)" }}
            minTickGap={24}
          />
          <YAxis
            domain={[yMin, yMax]}
            tickFormatter={fmtNum}
            stroke="rgb(107 114 128)"
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: "rgb(209 213 219)" }}
            tickLine={{ stroke: "rgb(209 213 219)" }}
            width={56}
          />
          <Tooltip
            contentStyle={{
              borderRadius: 12,
              borderColor: "rgb(229 231 235)",
              boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
            }}
            labelFormatter={(ts) => dateFmt(Number(ts))}
            formatter={(val: any) => [fmtNum(Number(val)), "Close"]}
          />
          <Line
            type="monotone"
            dataKey="y"
            stroke="rgb(17 24 39)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
